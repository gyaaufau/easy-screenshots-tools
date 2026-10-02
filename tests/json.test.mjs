import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class FakeImage {}
function load(name, overrides={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(`features/screenshot-editor/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>n.endsWith('.json')?JSON.parse(readFileSync(`features/screenshot-editor/${n.replace('./','')}`,'utf8')):load(n.replace('./',''),overrides),console,WeakMap,window:{},HTMLImageElement:FakeImage,setTimeout,clearTimeout,...overrides});return exports;
}
test('project config rejects unknown fields and invalid image indices with paths',()=>{
 const {parseConfig}=load('config');
 assert.throws(()=>parseConfig('{"version":2,"kind":"project","slides":[]}'),/version/);
 assert.throws(()=>parseConfig(JSON.stringify({version:1,kind:'project',slides:[{id:'home',bad:true}]})),/slides\[0\].bad/);
 assert.throws(()=>parseConfig(JSON.stringify({version:1,kind:'project',slides:[{id:'home',frames:[{imageIndex:-1}]}]})),/imageIndex/);
});

function session(){const s={notify(){},render(){},closeInlineEditor(){},showToast(){},frameSpecs:{},frameSpec:()=>({aspect:2}),waitForSlideAssets:async()=>{},ensureExportFonts:async()=>{},setCanvasZoom(){}};load('model').installModel(s);load('history').installHistory(s);return s;}
test('STOPJUDOL package imports ten ordered originals and restores them in one redo',async()=>{
 const source=readFileSync('designs/stopjudol/project.json','utf8');
 const config=load('config').parseConfig(source),s=session(),api=load('configRuntime');
 const assets=config.assets.map(({index,name})=>{
  assert.equal(index,config.assets.findIndex(asset=>asset.name===name));
  const bytes=readFileSync(`designs/stopjudol/assets/${name}`);
  assert.equal(bytes.readUInt32BE(16),1206);assert.equal(bytes.readUInt32BE(20),2622);
  const png=readFileSync(`designs/stopjudol/png/${String(index+1).padStart(2,'0')}-stopjudol.png`);
  assert.equal(png.readUInt32BE(16),1290);assert.equal(png.readUInt32BE(20),2796);
  return {name,image:new FakeImage()};
 });
 await api.applyConfig(s,source,assets);
 assert.equal(s.slides.length,10);assert.equal(s.workspaceUndo.length,1);
 for(const [index,slide] of s.slides.entries()){
  const frame=slide.frames[0];
  assert.equal(slide.jsonId,config.slides[index].id);assert.equal(frame.jsonId,config.slides[index].frames[0].id);
  assert.equal(frame.image,assets[index].image);assert.equal(slide.preset,'app67');
 }
 s.performHistory('undo');assert.equal(s.slides.length,1);
 s.performHistory('redo');assert.equal(s.slides.length,10);
 for(const [index,slide] of s.slides.entries())assert.equal(slide.frames[0].image,assets[index].image);
});
test('project round-trip preserves all styles, images and generated geometry',()=>{
 const s=session(), api=load('configRuntime'),image=new FakeImage();
 s.state.frames[0].image=image;s.state.frames[0].fileName='same.png';s.state.frames.push(s.cloneDeviceForSlide(s.state.frames[0]));
 s.state.headlineStyle.preset='neon';s.state.headlineOffsetX=33;s.state.frames[0].frameRotation=45;s.state.patternImage=image;s.state.patternFileName='same.png';s.state.ornaments.push(s.createOrnament('star'));
 const {config,assets}=api.serializeProject(s.slides);assert.equal(assets.length,1);
 const prepared=api.prepareConfig(s,JSON.stringify(config),assets),copy=prepared.slides[0];
 assert.equal(copy.frames[0].image,image);assert.equal(copy.frames[1].image,image);assert.equal(copy.patternImage,image);
 assert.equal(copy.headlineStyle.preset,'neon');assert.equal(copy.headlineOffsetX,33);assert.equal(copy.frames[0].frameRotation,45);assert.equal(copy.ornaments[0].kind,'star');
 assert.equal(copy.jsonId,config.slides[0].id);assert.notEqual(copy.id,s.state.id);
});
test('template uses upload order and independent slide defaults',()=>{
 const s=session(),images=[new FakeImage(),new FakeImage()],assets=images.map((image,i)=>({image,name:`${i}.png`}));
 const source=JSON.stringify({version:1,kind:'template',preset:'play',slide:{frames:[{imageIndex:'$current'}],headline:{content:'Hello'}}});
 const result=load('configRuntime').prepareConfig(s,source,assets);
 assert.equal(result.slides.length,2);assert.equal(result.slides[0].frames[0].image,images[0]);assert.equal(result.slides[1].frames[0].image,images[1]);
 result.slides[0].headlineStyle.preset='shadow';assert.equal(result.slides[1].headlineStyle.preset,'normal');assert.equal(result.slides[1].preset,'play');
 assert.throws(()=>load('configRuntime').prepareConfig(s,source,[]),/template/);
});
test('invalid references and duplicate IDs leave active workspace unchanged',()=>{
 const s=session(),before=s.state,api=load('configRuntime');
 assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'project',slides:[{id:'a',frames:[{imageIndex:2}]}]}),[]),/slides\[0\].frames\[0\].imageIndex/);
 assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'project',slides:[{id:'a'},{id:'a'}]}),[]),/duplikat/);
 assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'project',slides:[{frames:[{imageIndex:'$current'}]}]}),[]),/template/);
 assert.equal(s.state,before);assert.equal(s.slides.length,1);
});
test('import and command batch are one workspace undo with image references retained',async()=>{
 const s=session(),api=load('configRuntime'),image=new FakeImage(),original=s.state;
 await api.applyConfig(s,JSON.stringify({version:1,kind:'project',slides:[{id:'home',frames:[{id:'phone',imageIndex:0}]}]}),[{name:'0.png',image}]);
 assert.equal(s.workspaceUndo.length,1);s.performHistory('undo');assert.equal(s.state.id,original.id);s.performHistory('redo');assert.equal(s.state.frames[0].image,image);
 const commands={version:1,kind:'commands',commands:[{op:'slide.update',slide:'home',value:{headline:{content:'Updated'}}},{op:'frame.update',slide:'home',frame:'phone',value:{frameRotation:33}},{op:'ornament.add',slide:'home',value:{id:'star',kind:'star'}}]};
 await api.applyConfig(s,JSON.stringify(commands),[]);assert.equal(s.workspaceUndo.length,2);assert.equal(s.state.headline,'Updated');assert.equal(s.state.frames[0].frameRotation,33);
 s.performHistory('undo');assert.notEqual(s.state.headline,'Updated');assert.equal(s.state.ornaments.length,0);s.performHistory('redo');assert.equal(s.state.ornaments[0].jsonId,'star');
});
test('late invalid command and asset decoding failure are atomic',async()=>{
 const s=session(),api=load('configRuntime'),before=s.state.headline;
 const commands={version:1,kind:'commands',commands:[{op:'slide.update',slide:'slide-1',value:{headline:{content:'No'}}},{op:'frame.delete',slide:'slide-1',frame:'wrong'}]};
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify(commands),[]),/commands\[1\].frame/);assert.equal(s.state.headline,before);assert.equal(s.workspaceUndo.length,0);
 s.waitForSlideAssets=async()=>{throw new Error('image-load')};
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify({version:1,kind:'project',slides:[{}]}),[]),/image-load/);assert.equal(s.state.headline,before);
});

test('command groups resolve ordered IDs, arrange, select, reset and preserve global preset',async()=>{
 const s=session(),api=load('configRuntime');
 const commands=[
  {op:'slide.add',value:{id:'new',frames:[{id:'a',frameWidthPct:40}]}},
  {op:'frame.add',slide:'new',value:{id:'b'}},
  {op:'frame.arrange',slide:'new',arrangement:'sideBySide'},
  {op:'frame.select',slide:'new',frame:'a'},
  {op:'ornament.add',slide:'new',value:{id:'one'}},
  {op:'ornament.add',slide:'new',value:{id:'two',layer:'front'}},
  {op:'ornament.update',slide:'new',ornament:'one',value:{rotation:80}},
  {op:'ornament.move',slide:'new',ornament:'one',direction:'forward'},
  {op:'ornament.select',slide:'new',ornament:'one'},
  {op:'slide.update',slide:'new',value:{background:{backgroundType:'gradient'},subheadline:{style:{preset:'outline'}}}},
  {op:'slide.duplicate',slide:'new',id:'copy'},
  {op:'slide.move',slide:'copy',index:0},
  {op:'slide.select',slide:'new'},
  {op:'preset',value:'app65'},
  {op:'zoom',mode:'custom',percent:75}
 ];
 let zoom;s.setCanvasZoom=(mode,percent)=>{zoom={mode,percent}};
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands}),[]);
 assert.equal(s.state.jsonId,'new');assert.equal(s.slides[0].jsonId,'copy');assert.equal(s.state.ornaments[0].jsonId,'two');assert.equal(s.state.ornaments[1].rotation,80);
 assert.ok(s.state.frames[0].frameOffsetXPct<s.state.frames[1].frameOffsetXPct);assert.equal(s.slides[0].frames[0].image,s.state.frames[0].image);assert.deepEqual(zoom,{mode:'custom',percent:75});assert.ok(s.slides.every(slide=>slide.preset==='app65'));
 s.slides[0].ornaments[0].opacity=5;assert.equal(s.state.ornaments[0].opacity,100);
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[
  {op:'frame.delete',slide:'new',frame:'b'},
  {op:'ornament.delete',slide:'new',ornament:'one'},
  {op:'slide.reset',slide:'new'},
  {op:'slide.delete',slide:'copy'}
 ]}),[]);
 assert.equal(s.state.ornaments.length,0);assert.equal(s.state.frames.length,1);assert.equal(s.state.subtitleStyle.preset,'normal');assert.equal(s.state.preset,'app65');assert.equal(s.workspaceUndo.length,2);
});
test('standalone history/export commands stay separate and preserve selection',async()=>{
 const s=session(),api=load('configRuntime'),selection=s.state;
 let exported;s.downloadPng=async all=>{exported=all};
 for(const [op,all] of [['export.active',false],['export.all',true]]){await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op}]}),[]);assert.equal(exported,all);assert.equal(s.state,selection);}
 for(const op of ['undo','redo','export.active','export.all'])assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op},{op:'preset',value:'play'}]}),[]),/tunggal/);
 assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'zoom',mode:'custom'}]}),[]),/percent/);
 assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'frame.update',slide:'slide-1',frame:'frame-1',value:{zoom:-1}}]}),[]),/commands\[0\].value.zoom/);
});
test('prototype keys are rejected and extended gesture sizes round-trip',()=>{
 const api=load('configRuntime'),s=session();
 assert.throws(()=>load('config').parseConfig('{"version":1,"kind":"project","slides":[{"__proto__":{"polluted":true}}]}'),/properti tidak dikenal/);
 s.state.frames[0].frameWidthPct=450;s.state.frames[0].frameRotation=270;
 const exported=api.serializeProject(s.slides);assert.equal(api.prepareConfig(s,JSON.stringify(exported.config),exported.assets).slides[0].frames[0].frameWidthPct,450);
});

test('visual edits and JSON replacements undo/redo chronologically and branch safely',async()=>{
 const s=session(),api=load('configRuntime'),original=s.state.headline;
 s.beginInputHistory();s.state.headline='Visual';s.commitInputHistory();
 await api.applyConfig(s,JSON.stringify({version:1,kind:'project',slides:[{id:'imported',headline:{content:'JSON'}}]}),[]);
 s.performHistory('undo');assert.equal(s.state.headline,'Visual');s.performHistory('undo');assert.equal(s.state.headline,original);
 s.performHistory('redo');assert.equal(s.state.headline,'Visual');s.performHistory('redo');assert.equal(s.state.headline,'JSON');
 s.performHistory('undo');s.beginInputHistory();s.state.headline='New branch';s.commitInputHistory();assert.equal(s.newestHistoryAction('redo'),null);
 const previousCounter=s.slideCounter;s.performHistory('undo');const slide=s.createBlankSlide();assert.ok(slide.id>previousCounter);
});
test('visual constructors avoid user JSON IDs and schema examples stay in sync',()=>{
 const s=session();s.state.jsonId='slide-2';s.state.frames[0].jsonId='frame-2';s.state.ornaments.push({...s.createOrnament('circle'),jsonId:'ornament-2'});
 assert.notEqual(s.createBlankSlide().jsonId,'slide-2');assert.notEqual(s.createOrnament('star').jsonId,'ornament-2');
 const {parseConfig,configSchema,examples}=load('config');
 assert.equal(JSON.stringify(JSON.parse(readFileSync('features/screenshot-editor/configs/schema.json','utf8'))),JSON.stringify(configSchema));
 for(const kind of Object.keys(examples)){const value=readFileSync(`features/screenshot-editor/configs/${kind}.json`,'utf8');assert.equal(parseConfig(value).kind,kind);}
});

test('full example round-trips every setting in all presets with shared screenshot/pattern',()=>{
 const source=JSON.parse(readFileSync('features/screenshot-editor/configs/complete-project.json','utf8'));
 const s=session(),api=load('configRuntime'),assets=[{name:'screenshot.png',image:new FakeImage()}];
 for(const preset of ['app67','app65','play']){
  source.preset=preset;const first=api.prepareConfig(s,JSON.stringify(source),assets);
  const serialized=api.serializeProject(first.slides);
  const second=api.prepareConfig(s,JSON.stringify(serialized.config),serialized.assets);
  assert.equal(JSON.stringify(api.serializeProject(second.slides).config),JSON.stringify(serialized.config));
  assert.equal(second.slides[0].patternImage,second.slides[0].frames[0].image);assert.equal(serialized.assets.length,1);
 }
});
test('late browser resource updates prevent replacement instead of losing edits',async()=>{
 const s=session(),api=load('configRuntime');s.waitForSlideAssets=async()=>{s.state.headline='Late uploaded image edit'};
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify({version:1,kind:'project',slides:[{}]}),[]),/Proyek berubah/);
 assert.equal(s.state.headline,'Late uploaded image edit');assert.equal(s.workspaceUndo.length,0);
});
test('JSON image loading rejects corrupt files, wrong types and unmount cancellation',async()=>{
 class Reader {readAsDataURL(){Promise.resolve().then(()=>this.onload?.());}abort(){}}
 class BrokenImage {complete=true;naturalWidth=0;addEventListener(type,fn){if(type==='error')Promise.resolve().then(fn)}removeEventListener(){}}
 const s=session();load('assets',{FileReader:Reader,Image:BrokenImage}).installAssets(s);
 await assert.rejects(()=>s.readConfigImage({name:'bad.png',type:'image/png'}),/bad.png: image-load/);
 await assert.rejects(()=>s.readConfigImage({name:'bad.gif',type:'image/gif'}),/PNG/);
 const pending=s.readConfigImage({name:'cancel.png',type:'image/png'});s.disposed=true;s.disposeAssets();await assert.rejects(()=>pending,/editor-disposed/);
});

test('simple frame transforms position, resize and rotate independent mockups',()=>{
 const s=session(),api=load('configRuntime'),image=new FakeImage();
 for(const preset of ['app67','app65','play']){
  const prepared=api.prepareConfig(s,JSON.stringify({version:1,kind:'project',preset,slides:[{id:'hero',frames:[{id:'left',imageIndex:0,transform:{x:32,y:55,width:38,scale:1,rotation:-12}},{id:'right',imageIndex:0,transform:{x:108,y:-5,width:38,scale:.9,rotation:12}}]}]}),[{name:'same.png',image}]);
  const [left,right]=prepared.slides[0].frames;
  assert.equal(left.frameOffsetXPct,-18);assert.equal(left.frameOffsetYPct,5);assert.equal(left.frameWidthPct,38);assert.equal(left.frameRotation,-12);assert.equal(right.frameZoom,90);assert.equal(right.frameOffsetXPct,58);assert.equal(right.image,left.image);
  const exported=api.serializeProject(prepared.slides);assert.equal(exported.config.slides[0].frames[0].transform.x,32);assert.equal(exported.config.slides[0].frames[0].frameZoom,undefined);
  const roundtrip=api.prepareConfig(s,JSON.stringify(exported.config),exported.assets);assert.equal(roundtrip.slides[0].frames[1].frameRotation,12);
 }
});
test('duplicate frame and partial transform update form one atomic transaction',async()=>{
 const s=session(),api=load('configRuntime'),image=new FakeImage();s.state.frames[0].image=image;
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'frame.duplicate',slide:'slide-1',frame:'frame-1',id:'copy'},{op:'frame.update',slide:'slide-1',frame:'copy',value:{transform:{x:75,rotation:30}}}]}),[]);
 const [original,copy]=s.state.frames;assert.equal(copy.image,image);assert.notEqual(copy.id,original.id);assert.equal(copy.frameOffsetXPct,25);assert.equal(copy.frameZoom,original.frameZoom);assert.equal(original.frameRotation,0);assert.equal(s.state.activeFrameId,copy.id);assert.equal(s.workspaceUndo.length,1);
 s.performHistory('undo');assert.equal(s.state.frames.length,1);s.performHistory('redo');assert.equal(s.state.frames[1].image,image);
});
test('transform conflicts, duplicate IDs and bad numeric values abort the whole batch',async()=>{
 const s=session(),api=load('configRuntime');
 for(const value of [{transform:{x:50},frameRotation:12},{transform:{width:0}},{transform:{scale:0}},{transform:{x:'no'}}])assert.throws(()=>api.prepareConfig(s,JSON.stringify({version:1,kind:'project',slides:[{frames:[value]}]}),[]),/frames/);
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'frame.duplicate',slide:'slide-1',frame:'frame-1',id:'copy'},{op:'frame.duplicate',slide:'slide-1',frame:'frame-1',id:'copy'}]}),[]),/duplikat/);assert.equal(s.state.frames.length,1);
});

test('renderer and JSON round-trip share geometry after gestures and arrangements',()=>{
 const s=session(),api=load('configRuntime'),specs=JSON.parse(readFileSync('features/screenshot-editor/frame-specs.json','utf8'));
 s.frameSpec=kind=>specs[kind];s.bind=()=>{};s.listen=()=>{};s.mockupAssets=()=>({status:'loading'});s.activeDevice=function(){return this.state.frames.find(frame=>frame.id===this.state.activeFrameId)};
 load('canvas').installCanvas(s);const shapes=[];s.drawPhoneTransformed=(_ctx,shape)=>shapes.push(shape);
 const ctx=new Proxy({},{get(_target,key){if(key==='measureText')return text=>({width:text.length*40});if(key==='getTransform')return()=>({a:1,b:0});return()=>{};}});
 const canvas={width:0,height:0,getContext:()=>ctx};
 for(const preset of ['app67','app65','play'])for(const layout of ['top','left','bottom']){
  s.state=s.createBlankSlide();s.state.preset=preset;s.state.layout=layout;s.slides=[s.state];s.state.frames.push(s.createDevice());
  for(const arrange of ['default','gesture','cascade','sideBySide']){
   if(arrange==='gesture')Object.assign(s.state.frames[0],{frameOffsetXPct:-20,frameOffsetYPct:15,frameWidthPct:43,frameHeightPct:null,frameZoom:75,frameRotation:45});
   if(arrange==='cascade')s.arrangeCascade(false);if(arrange==='sideBySide')s.arrangeSideBySide();
   shapes.length=0;s.drawCanvas(canvas,true);const before=JSON.stringify(shapes);
   const exported=api.serializeProject(s.slides);const imported=api.prepareConfig(s,JSON.stringify(exported.config),exported.assets);shapes.length=0;s.drawCanvas(canvas,true,undefined,imported.slides[0]);
   const after=shapes;const expected=JSON.parse(before);for(let i=0;i<after.length;i++)for(const key of ['cx','cy','w','h','rotation'])assert.ok(Math.abs(after[i][key]-expected[i][key])<1e-8,`${preset}/${layout}/${arrange}/${key}`);
   assert.equal(s.state,s.slides[0]);assert.equal(canvas.width,s.presets[preset].w);assert.equal(canvas.height,s.presets[preset].h);
  }
 }
});
