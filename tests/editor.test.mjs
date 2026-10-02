import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(name, environment = {}) {
  const source = readFileSync(new URL(`../features/screenshot-editor/${name}.ts`, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: name => load(name.replace('./', '')), HTMLImageElement: FakeImage, WeakMap, console, ...environment });
  return exports;
}
class FakeImage {}
function session() {
  const ctx = { notify() {}, updateHistoryButtons() {}, refreshAfterHistory() {}, closeInlineEditor() {},
    syncSlideControls() {}, renderSlideStrip() {}, showToast() {}, render() {} };
  load('model').installModel(ctx);
  load('history').installHistory(ctx);
  return ctx;
}

test('duplicated slides have independent devices and retain their image resources', () => {
  const s = session();
  const image = new FakeImage();
  s.state.frames[0].image = image;
  const copy = s.cloneSlide(s.state);
  assert.notEqual(copy.id, s.state.id);
  assert.notEqual(copy.frames[0].id, s.state.frames[0].id);
  assert.equal(copy.frames[0].image, image);
  copy.frames[0].zoom = 150;
  assert.equal(s.state.frames[0].zoom, 100);
  assert.equal(copy.activeFrameId, copy.frames[0].id);
});

test('continuous edits create one undo entry and preserve image references', () => {
  const s = session();
  const image = new FakeImage();
  s.state.frames[0].image = image;
  const original = s.state.headline;
  s.beginSlideHistory(s.state);
  s.state.headline = 'First';
  s.beginSlideHistory(s.state);
  s.state.headline = 'Second';
  s.commitHistoryTransaction();
  assert.equal(s.slideHistory(s.state).undo.length, 1);
  s.performHistory('undo');
  assert.equal(s.state.headline, original);
  assert.equal(s.state.frames[0].image, image);
  s.performHistory('redo');
  assert.equal(s.state.headline, 'Second');
});

test('workspace and slide changes undo in sequence and redo without ID collisions', () => {
  const s = session();
  s.beginSlideHistory(); s.state.headline = 'Edited'; s.commitHistoryTransaction();
  s.beginWorkspaceHistory();
  const second = s.createBlankSlide(); s.slides.push(second); s.state = second;
  s.commitHistoryTransaction();
  assert.equal(s.newestHistoryAction('undo').scope, 'workspace');
  s.performHistory('undo');
  assert.equal(s.slides.length, 1);
  assert.equal(s.state.headline, 'Edited');
  s.performHistory('undo');
  assert.notEqual(s.state.headline, 'Edited');
  s.performHistory('redo'); s.performHistory('redo');
  assert.equal(s.slides.length, 2);
  assert.ok(s.createBlankSlide().id > second.id);
});

test('unchanged transactions do not create history entries', () => {
  const s = session();
  s.beginSlideHistory(); s.commitHistoryTransaction();
  assert.equal(s.newestHistoryAction('undo'), null);
});


test('PNG rendering uses the requested slide and preserves the active slide for every preset', async () => {
  const s = session();
  const active = s.state;
  const output = { width: 0, height: 0 };
  s.bind = () => {};
  s.ensureExportFonts = async () => {};
  s.waitForSlideAssets = async () => {};
  s.canvasBlob = async () => 'png';
  s.drawCanvas = (target, full, dimensions, slide) => {
    assert.notEqual(slide, active);
    assert.equal(s.state, active);
    assert.equal(full, true);
    target.width = dimensions.w; target.height = dimensions.h;
  };
  load('export', { document: { createElement: () => output } }).installExport(s);
  s.canvasBlob = async () => 'png';
  for (const preset of Object.keys(s.presets)) {
    const slide = s.cloneSlide(active); slide.preset = preset;
    assert.equal(await s.renderSlideBlob(slide), 'png');
    assert.equal(output.width, s.presets[preset].w);
    assert.equal(output.height, s.presets[preset].h);
    assert.equal(s.state, active);
  }
  s.waitForSlideAssets = async () => { throw new Error('image-load'); };
  await assert.rejects(() => s.renderSlideBlob(s.cloneSlide(active)), /image-load/);
  assert.equal(s.state, active);
});


test('canvas draws an explicit slide without changing active state or live geometry', () => {
  const s = session();
  const active = s.state;
  s.bind = () => {}; s.listen = () => {};
  s.activeDevice = function () { return this.state.frames.find(device => device.id === this.state.activeFrameId); };
  s.frameSpec = () => ({aspect: 2, sizeScale: 1, screen: {x:0,y:0,w:100,h:200}});
  s.mockupAssets = () => ({status: 'loading'});
  s.previewPhones = []; s.previewImages = []; s.previewTextZones = [];
  s.previewPhone = null;
  const text = [];
  const context = new Proxy({}, { get(target, name) {
    if (name === 'measureText') return value => ({width: value.length * 40});
    if (name === 'fillText') return value => text.push(value);
    if (name === 'getTransform') return () => ({a:1,b:0});
    return () => {};
  }});
  const canvas = {width:0,height:0,getContext:()=>context};
  load('canvas', {window:{}}).installCanvas(s);
  s.drawCanvas(canvas, false);
  const liveGeometry = s.previewPhones;
  const slide = s.cloneSlide(active); slide.headline = 'Other slide'; slide.color = '#ffffff';
  text.length = 0;
  s.drawCanvas(canvas, true, undefined, slide);
  assert.ok(text.includes('Other slide'));
  assert.equal(s.state, active);
  assert.equal(s.previewPhones, liveGeometry);
  assert.equal(canvas.width, s.presets[slide.preset].w);
  assert.equal(canvas.height, s.presets[slide.preset].h);
});


test('ornaments and text styles clone independently with unique ornament IDs', () => {
  const s = session();
  const ornament = s.createOrnament('star'); s.state.ornaments.push(ornament);
  s.state.headlineStyle.preset = 'neon';
  const copy = s.cloneSlide(s.state);
  assert.notEqual(copy.ornaments[0].id, ornament.id);
  copy.ornaments[0].color = '#112233'; copy.headlineStyle.preset = 'outline';
  assert.equal(ornament.color, '#e84f2f');
  assert.equal(s.state.headlineStyle.preset, 'neon');
  const blank = s.createBlankSlide();
  assert.equal(blank.ornaments.length, 0); assert.equal(blank.headlineStyle.preset, 'normal');
});

test('ornament gestures group into one transaction and restore geometry and styles', () => {
  const s = session(); s.state.ornaments.push(s.createOrnament('circle'));
  s.beginSlideHistory();
  for (let x = 51; x <= 70; x++) { s.beginSlideHistory(); s.state.ornaments[0].x = x; }
  s.state.ornaments[0].rotation = 45; s.state.subtitleStyle.preset = 'shadow';
  s.commitHistoryTransaction();
  assert.equal(s.slideHistory(s.state).undo.length, 1);
  s.performHistory('undo'); assert.equal(s.state.ornaments[0].x, 50); assert.equal(s.state.subtitleStyle.preset, 'normal');
  s.performHistory('redo'); assert.equal(s.state.ornaments[0].x, 70); assert.equal(s.state.ornaments[0].rotation, 45);
});


test('ornament hit testing respects rotation and shape boundaries', () => {
  const { ornamentShape, ornamentContains } = load('ornaments');
  const item = {id:1,kind:'circle',x:50,y:50,width:20,height:20,rotation:45,color:'#fff',opacity:100,layer:'front'};
  const output = {w:1000,h:1000};
  assert.equal(ornamentContains(item, {x:500,y:500}, output), true);
  assert.equal(ornamentContains(item, {x:640,y:640}, output), false);
  assert.equal(ornamentShape(item,output).rotation, Math.PI / 4);
});


test('picking follows front ornaments, frame, text, then rear ornaments', () => {
 const s=session(), {canvasHitAt}=load('ornaments');
 s.state.ornaments.push(s.createOrnament('rectangle'));
 const item=s.state.ornaments[0], p=s.presets[s.state.preset], point={x:p.w/2,y:p.h/2};
 s.phoneHitAt=()=>({id:1,phone:{}}); s.imageHitAt=()=>null; s.textZoneAt=()=>({type:'headline'});
 assert.equal(canvasHitAt(s,point).type,'ornament');
 item.layer='back'; assert.equal(canvasHitAt(s,point).type,'frame');
 s.phoneHitAt=()=>null; assert.equal(canvasHitAt(s,point).type,'text');
 s.textZoneAt=()=>null; assert.equal(canvasHitAt(s,point).type,'ornament');
});

function canvasSession() {
 const s=session(), marks=[];
 s.bind=()=>{}; s.listen=()=>{};
 s.activeDevice=function(){return this.state.frames[0]};
 s.frameSpec=()=>({aspect:2,sizeScale:1,screen:{x:0,y:0,w:100,h:200}});
 s.previewPhones=[];s.previewImages=[];s.previewTextZones=[];s.previewPhone=null;
 load('canvas',{window:{}}).installCanvas(s);
 s.drawBackground=()=>marks.push('background');
 s.drawPhoneTransformed=()=>marks.push('frame');
 s.drawSelection=()=>marks.push('selection');s.drawTextSelection=()=>marks.push('selection');
 const context=new Proxy({}, {get(target,name){
   if(name in target) return target[name];
   if(name==='measureText') return text=>({width:text.length*35});
   if(name==='fillText') return ()=>marks.push('text');
   if(name==='fill') return ()=>marks.push(target.fillStyle);
   if(name==='createLinearGradient') return ()=>({addColorStop(){}});
   if(name==='getTransform') return ()=>({a:.5,b:0,c:0,d:.5});
   return ()=>{};
 }});
 return {s,marks,canvas:{width:0,height:0,getContext:()=>context}};
}

test('all shapes and text presets render in every output size without export handles', () => {
 const {s,marks,canvas}=canvasSession();
 const kinds=['circle','rectangle','line','arrow','star','sparkle','blob'];
 for(const kind of kinds) s.state.ornaments.push(s.createOrnament(kind));
 s.state.ornaments[0].layer='back';s.state.ornaments[0].color='#123456';
 s.selectedOrnament=s.state.ornaments[1].id;
 for(const preset of Object.keys(s.presets)) for(const style of ['normal','shadow','outline','gradient','highlight','neon']) {
   s.state.preset=preset;s.state.headlineStyle.preset=style;s.state.subtitleStyle.preset=style;
   s.state.headlineRotation=20;s.state.ornaments[1].opacity=42;s.state.ornaments[1].x=99;
   marks.length=0;s.drawCanvas(canvas,true);
   assert.equal(canvas.width,s.presets[preset].w);assert.equal(canvas.height,s.presets[preset].h);
   assert.equal(marks[0],'background');assert.equal(marks[1],'#123456');
   assert.ok(marks.indexOf('text')<marks.indexOf('frame'));
   assert.ok(marks.lastIndexOf('#e84f2f')>marks.indexOf('frame'));
   assert.ok(!marks.includes('selection'));
 }
 marks.length=0;s.drawCanvas(canvas,false);assert.equal(marks.at(-1),'selection');
});

test('canvas ornament pointer gestures and reset undo as one action', () => {
 const {s,canvas}=canvasSession(), bindings=new Map();
 s.bind=(id,type,handler)=>bindings.set(id+':'+type,handler);
 s.listen=()=>{};
 load('controller',{window:{},document:{getElementById:()=>({value:''})}}).installController(s,{});
 s.canvas={...canvas,style:{},classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture:()=>false};
 s.pointerPoint=e=>e.point;
 s.state.ornaments.push(s.createOrnament('rectangle'));
 const p=s.presets[s.state.preset], x=p.w/2,y=p.h/2;
 const event=point=>({point,pointerId:1,preventDefault(){},target:s.canvas});
 s.beginSlideHistory();bindings.get('preview:pointerdown')(event({x,y}));
 assert.equal(s.pointerAction.target,'ornament');
 s.handlePointerMove(event({x:x+100,y:y+100}));s.handlePointerMove(event({x:x+200,y:y+200}));
 s.endPointer(event({x:x+200,y:y+200}));
 assert.equal(s.slideHistory(s.state).undo.length,1);
 assert.ok(s.state.ornaments[0].x>50);
 s.performHistory('undo');assert.equal(s.state.ornaments[0].x,50);
 s.performHistory('redo');assert.ok(s.state.ornaments[0].x>50);
 s.state.headlineStyle.preset='neon';s.state.preset='play';
 s.beginWorkspaceHistory();bindings.get('resetBtn:click')();s.commitHistoryTransaction();
 assert.equal(s.state.ornaments.length,0);assert.equal(s.state.headlineStyle.preset,'normal');assert.equal(s.state.preset,'play');
 s.performHistory('undo');assert.equal(s.state.ornaments.length,1);assert.equal(s.state.headlineStyle.preset,'neon');
});


test('ornament commands undo insertion, duplication, layer-local order, and deletion', () => {
 const s=session(), {performOrnamentCommand: command}=load('ornaments');
 command(s,'add',undefined,'circle');const first=s.state.ornaments[0].id;
 command(s,'duplicate',first);const second=s.state.ornaments[1].id;
 assert.notEqual(first,second);assert.equal(s.selectedOrnament,second);
 command(s,'backward',second);assert.equal(s.state.ornaments[0].id,second);
 s.performHistory('undo');assert.equal(s.state.ornaments[1].id,second);
 s.performHistory('redo');assert.equal(s.state.ornaments[0].id,second);
 command(s,'delete',second);assert.equal(s.state.ornaments.length,1);
 s.performHistory('undo');assert.equal(s.state.ornaments.length,2);
 s.beginSlideHistory();s.state.ornaments[0].layer='back';s.commitHistoryTransaction();
 const before=s.state.ornaments.map(item=>item.id).join();
 command(s,'forward',second);assert.equal(s.state.ornaments.map(item=>item.id).join(),before);
});


test('active and batch exports keep selection and produce ordered filenames', async () => {
 const s=session(), handlers=new Map(), names=[];
 s.bind=(id,type,handler)=>handlers.set(id,handler);
 s.ensureExportFonts=async()=>{};s.waitForSlideAssets=async()=>{};s.wait=async()=>{};
 s.activeSlideIndex=()=>s.slides.indexOf(s.state);s.showToast=()=>{};
 const second=s.cloneSlide(s.state);s.slides.push(second);s.state=second;
 s.selectedOrnament=99;s.selectedText=null;s.activeObject='ornament';
 load('export').installExport(s);
 s.renderSlideBlob=async slide=>({id:slide.id});
 s.downloadBlob=async(blob,name)=>names.push(name);
 const run=async id=>{
  await new Promise(resolve=>{s.notify=()=>{if(!s.exporting)resolve()};handlers.get(id)()});
  assert.equal(s.state,second);assert.equal(s.selectedOrnament,99);
 };
 await run('downloadBtn');assert.equal(names.join(),'screenshot-02.png');
 names.length=0;await run('downloadAllBtn');assert.equal(names.join(),'screenshot-01.png,screenshot-02.png');
});


test('ornament resize and rotation preserve a single undo entry each', () => {
 const {s,canvas}=canvasSession(), bindings=new Map();
 s.bind=(id,type,handler)=>bindings.set(id+':'+type,handler);s.listen=()=>{};
 load('controller',{window:{},document:{getElementById:()=>({value:''})}}).installController(s,{});
 s.canvas={...canvas,style:{},classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture:()=>false};
 s.pointerPoint=e=>e.point;
 const item=s.createOrnament('rectangle');s.state.ornaments.push(item);s.selectedOrnament=item.id;
 const p=s.presets[s.state.preset],cx=p.w/2,cy=p.h/2,w=p.w*.2,h=p.w*.2;
 const event=(x,y)=>({point:{x,y},pointerId:1,preventDefault(){},target:s.canvas});
 s.beginSlideHistory();bindings.get('preview:pointerdown')(event(cx+w/2,cy+h/2));
 assert.equal(s.pointerAction.type,'resize');
 s.handlePointerMove(event(cx+w,cy+h));s.endPointer(event(cx+w,cy+h));
 assert.equal(s.state.ornaments[0].width,40);assert.equal(s.slideHistory(s.state).undo.length,1);
 s.beginSlideHistory();bindings.get('preview:pointerdown')(event(cx,cy-h-p.w*.07));
 assert.equal(s.pointerAction.type,'rotate');
 s.handlePointerMove(event(cx+200,cy));s.endPointer(event(cx+200,cy));
 assert.equal(s.state.ornaments[0].rotation,90);assert.equal(s.slideHistory(s.state).undo.length,2);
 s.performHistory('undo');assert.equal(s.state.ornaments[0].rotation,0);assert.equal(s.state.ornaments[0].width,40);
 s.performHistory('undo');assert.equal(s.state.ornaments[0].width,20);
});


test('text shadow offsets rotate and scale with the text transform', () => {
 const {paintText}=load('textStyles'), seen=[];
 const c={save(){},restore(){},measureText:()=>({width:200}),getTransform:()=>({a:0,b:.5,c:-.5,d:0}),fillText(){seen.push({x:this.shadowOffsetX,y:this.shadowOffsetY,blur:this.shadowBlur})}};
 paintText(c,'Text',0,0,{preset:'shadow',color:'#fff',accent:'#000'},100);
 assert.equal(seen[0].x,-3);assert.equal(seen[0].y,2.25);assert.equal(seen[0].blur,4);
});
