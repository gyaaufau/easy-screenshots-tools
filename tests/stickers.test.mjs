import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class FakeImage {naturalWidth=100;naturalHeight=50;}
function modules(environment={}) {
 const cache=new Map();
 function load(name){if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(`features/screenshot-editor/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>n.endsWith('.json')?JSON.parse(readFileSync(`features/screenshot-editor/${n.replace('./','')}`)):load(n.replace('./','')),HTMLImageElement:FakeImage,WeakMap,console,setTimeout,clearTimeout,window:{},...environment});return exports;}return load;
}
function setup(environment={}){const load=modules(environment),s={notify(){},render(){},closeInlineEditor(){},showToast(){},frameSpecs:{},frameSpec:()=>({aspect:2}),waitForSlideAssets:async()=>{},ensureExportFonts:async()=>{}};load('model').installModel(s);load('history').installHistory(s);return {s,load};}
const project=ornaments=>JSON.stringify({version:1,kind:'project',slides:[{id:'home',ornaments}]});
test('catalog stickers and shared uploads round-trip without browser resources in JSON',()=>{
 const {s,load}=setup(),api=load('configRuntime'),image=new FakeImage();
 const result=api.prepareConfig(s,project([{id:'wow',kind:'sticker',source:'catalog',stickerId:'label-wow',text:'COOL',color:'#ff0099'},{id:'upload',kind:'sticker',source:'upload',imageIndex:0}]),[{name:'sticker.png',image}]);
 result.slides[0].frames[0].image=image;result.slides[0].frames[0].fileName='sticker.png';
 const exported=api.serializeProject(result.slides);assert.equal(exported.assets.length,1);assert.equal(exported.config.slides[0].ornaments[1].imageIndex,0);assert.equal(exported.config.slides[0].ornaments[1].image,undefined);
 const round=api.prepareConfig(s,JSON.stringify(exported.config),exported.assets);assert.equal(round.slides[0].ornaments[1].image,image);assert.equal(round.slides[0].ornaments[0].text,'COOL');
 Object.assign(s,round.counters);const copy=s.cloneSlide(round.slides[0]);assert.notEqual(copy.ornaments[1].id,round.slides[0].ornaments[1].id);assert.equal(copy.ornaments[1].image,image);copy.ornaments[0].text='NEW';assert.equal(round.slides[0].ornaments[0].text,'COOL');
});
test('sticker defaults preserve source aspect on every output preset',()=>{
 const {s,load}=setup(),api=load('configRuntime');
 assert.equal(load('stickers').stickerCatalog.length,54);
 for(const preset of Object.keys(s.presets)){
  const config=JSON.parse(project([{kind:'sticker',source:'upload',imageIndex:0}]));config.preset=preset;
  const item=api.prepareConfig(s,JSON.stringify(config),[{name:'wide.png',image:new FakeImage()}]).slides[0].ornaments[0],p=s.presets[preset];
  assert.equal(item.x,50);assert.equal(item.width,20);assert.ok(Math.abs((item.width*p.w)/(item.height*p.h)-2)<1e-9);
 }
});
test('sticker duplicate/update aliases are one Undo and reject shape targets atomically',async()=>{
 const {s,load}=setup(),api=load('configRuntime'),image=new FakeImage();
 const commands=[{op:'sticker.add',slide:'slide-1',value:{id:'a',kind:'sticker',source:'upload',imageIndex:0}},{op:'sticker.duplicate',slide:'slide-1',sticker:'a',id:'b'},{op:'sticker.update',slide:'slide-1',sticker:'b',value:{x:75,rotation:30}},{op:'sticker.select',slide:'slide-1',sticker:'b'}];
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands}),[{name:'a.png',image}]);assert.equal(s.workspaceUndo.length,1);assert.equal(s.state.ornaments[1].image,image);assert.equal(s.state.ornaments[0].x,50);assert.equal(s.selectedOrnament,s.state.ornaments[1].id);
 s.performHistory('undo');assert.equal(s.state.ornaments.length,0);s.performHistory('redo');assert.equal(s.state.ornaments[1].rotation,30);
 const shape=s.createOrnament('star');s.state.ornaments.push(shape);
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'sticker.update',slide:'slide-1',sticker:shape.jsonId,value:{x:1}}]}),[]),/sticker/);assert.equal(shape.x,50);
});
test('sticker validation rejects wrong sources, IDs, properties and missing images',()=>{
 const {s,load}=setup(),api=load('configRuntime');
 for(const item of [{kind:'sticker',source:'catalog',stickerId:'unknown'},{kind:'sticker',source:'upload',imageIndex:9},{kind:'sticker',source:'upload',imageIndex:null},{kind:'sticker',source:'catalog',stickerId:'emoji-smile',color:'#ff0099'},{kind:'sticker',source:'catalog',stickerId:'doodle-heart',text:'BAD'},{kind:'sticker',source:'catalog',stickerId:'label-wow',text:'x'.repeat(41)}])assert.throws(()=>api.prepareConfig(s,project([item]),[]),/ornaments\[0\]/);
 assert.equal(s.state.ornaments.length,0);
});
test('transparent uploaded stickers let picks reach the element underneath',()=>{
 const {s,load}=setup({document:{createElement:()=>{const canvas={width:0,height:0};canvas.getContext=()=>({drawImage(){},putImageData(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:()=>{const data=new Uint8ClampedArray(canvas.width*canvas.height*4);data[4*(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))+3]=255;return {data};}});return canvas;}}});
 const image=new FakeImage();image.naturalWidth=100;image.naturalHeight=100;
 const p=s.presets[s.state.preset],shape=s.createOrnament('rectangle');s.state.ornaments.push(shape);
 const upload=load('stickers').createSticker(s,{source:'upload',image,fileName:'transparent.png'});s.state.ornaments.push(upload);
 const {ornamentHitAt}=load('ornaments');assert.equal(ornamentHitAt(s.state.ornaments,'front',{x:p.w*.42,y:p.h*.5},p).id,shape.id);
 assert.equal(ornamentHitAt(s.state.ornaments,'front',{x:p.w*.5,y:p.h*.5},p).id,upload.id);
 assert.equal(ornamentHitAt(s.state.ornaments,'front',{x:p.w*.505,y:p.h*.5},p).id,upload.id,'white border is selectable');
 upload.opacity=0;assert.equal(ornamentHitAt(s.state.ornaments,'front',{x:p.w*.5,y:p.h*.5},p).id,shape.id);
});
test('every catalog sticker has a pure white border, including emoji',()=>{
 const load=modules(),{stickerCatalog}=load('stickers'),{paintSticker}=load('stickerPainter');
 for(const entry of stickerCatalog){const fills=[];const ctx=new Proxy({globalAlpha:1},{get(target,key){if(key in target)return target[key];if(key==='fill'||key==='stroke')return()=>fills.push(key==='fill'?target.fillStyle:target.strokeStyle);if(key==='measureText')return()=>({width:40});return()=>{};}});
 paintSticker(ctx,{kind:'sticker',source:'catalog',stickerId:entry.id,color:'#ff0099'},200,100);
 assert.ok(fills.includes('#ffffff'),entry.id);assert.ok(!fills.includes('#fffdf6'),entry.id);
 }
});
test('upload border follows alpha contours, keeps distant holes transparent, and preserves artwork',()=>{
 const {outlineStickerPixels}=modules()('stickerPainter'),w=31,h=31,data=new Uint8ClampedArray(w*h*4);
 const pixel=(x,y)=>4*(y*w+x);
 for(let y=6;y<=24;y++)for(let x=6;x<=24;x++)if(x<9||x>21||y<9||y>21)data.set([230,40,90,255],pixel(x,y));
 const out=outlineStickerPixels(data,w,h,2);
 assert.deepEqual(Array.from(out.slice(pixel(4,15),pixel(4,15)+4)),[255,255,255,255]);
 assert.equal(out[pixel(3,15)+3],0);assert.equal(out[pixel(15,15)+3],0);
 assert.deepEqual(Array.from(out.slice(pixel(6,15),pixel(6,15)+4)),[230,40,90,255]);
 assert.equal(out[pixel(4,4)+3],0,'round contour excludes diagonal outside radius');
 assert.deepEqual(Array.from(data.slice(pixel(4,15),pixel(4,15)+4)),[0,0,0,0],'source stays unchanged');
});
test('proportional sticker resize keeps aspect and clamps both dimensions together',()=>{
 const {stickerResize}=modules()('stickers');
 for(const [width,height] of [[60,12],[.01,.01],[900,900]]){const result=stickerResize(width,height,20,5);assert.equal(result.width/result.height,4);assert.ok(result.width<=200);assert.ok(result.height>=.1);}
});
test('upload is atomic on decoding failure and inserts multiple files as one Undo',async()=>{
 const {s,load}=setup(),{uploadStickerFiles}=load('stickers');s.readStickerImage=async file=>{if(file.name==='bad.png')throw new Error('bad.png: image-load');return new FakeImage();};
 await assert.rejects(()=>uploadStickerFiles(s,[{name:'good.png'},{name:'bad.png'}]),/bad.png/);assert.equal(s.state.ornaments.length,0);assert.equal(s.newestHistoryAction('undo'),null);
 await uploadStickerFiles(s,[{name:'a.png'},{name:'b.png'}]);assert.equal(s.state.ornaments.length,2);assert.equal(s.slideHistory(s.state).undo.length,1);const image=s.state.ornaments[0].image;
 s.performHistory('undo');assert.equal(s.state.ornaments.length,0);s.performHistory('redo');assert.equal(s.state.ornaments[0].image,image);
 s.readStickerImage=async()=>{s.state.headline='Changed';return new FakeImage();};await assert.rejects(()=>uploadStickerFiles(s,[{name:'new.png'}]),/Proyek berubah/);assert.equal(s.state.ornaments.length,2);
});
test('upload type validation and remount cancellation retain the old workspace',async()=>{
 class Reader{readAsDataURL(){Promise.resolve().then(()=>this.onload?.());}abort(){}}
 class BrokenImage{complete=true;naturalWidth=0;addEventListener(type,fn){if(type==='error')Promise.resolve().then(fn);}removeEventListener(){}}
 const {s,load}=setup({FileReader:Reader,Image:BrokenImage});load('assets').installAssets(s);
 await assert.rejects(()=>s.readStickerImage({name:'bad.svg',type:'image/svg+xml'}),/PNG atau WebP/);
 await assert.rejects(()=>s.readStickerImage({name:'bad.png',type:'image/png'}),/bad.png: image-load/);
 const pending=load('stickers').uploadStickerFiles(s,[{name:'cancel.png',type:'image/png'}]);s.disposed=true;s.disposeAssets();await assert.rejects(()=>pending,/editor-disposed/);assert.equal(s.state.ornaments.length,0);
});
test('template sticker resources follow upload order and reset removes all decorations',async()=>{
 const {s,load}=setup(),api=load('configRuntime'),images=[new FakeImage(),new FakeImage()];
 await api.applyConfig(s,JSON.stringify({version:1,kind:'template',preset:'play',slide:{id:'screen',ornaments:[{kind:'sticker',source:'upload',imageIndex:'$current'}]}}),images.map((image,i)=>({name:`${i}.png`,image})));
 assert.equal(s.slides[0].ornaments[0].image,images[0]);assert.equal(s.slides[1].ornaments[0].image,images[1]);
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'slide.reset',slide:'screen-1'}]}),[]);assert.equal(s.state.ornaments.length,0);assert.equal(s.state.preset,'play');s.performHistory('undo');assert.equal(s.state.ornaments[0].image,images[0]);
});
test('all catalog painters render at every output scale, long labels fit and exports omit handles',()=>{
 const {s,load}=setup(),{stickerCatalog,createSticker}=load('stickers');
 s.bind=()=>{};s.listen=()=>{};s.frameSpec=()=>({aspect:2,sizeScale:1,screen:{x:0,y:0,w:100,h:200}});s.mockupAssets=()=>({status:'loading'});s.activeDevice=function(){return this.state.frames[0]};
 load('canvas').installCanvas(s);s.drawPhoneTransformed=()=>{};
 for(const entry of stickerCatalog)s.state.ornaments.push(createSticker(s,{source:'catalog',stickerId:entry.id},{rotation:35,opacity:60,x:99,...(entry.category==='label'?{text:'LONG LABEL '.repeat(3)}:{})}));
 const labels=[];const ctx=new Proxy({},{get(target,key){if(key in target)return target[key];if(key==='measureText')return text=>({width:text.length*Number.parseFloat(target.font.split(' ')[1])});if(key==='fillText')return text=>{if(text.startsWith('LONG'))labels.push({font:Number.parseFloat(target.font.split(' ')[1]),text});};if(key==='getTransform')return()=>({a:1,b:0,c:0,d:1});if(key==='createLinearGradient')return()=>({addColorStop(){}});return()=>{};}});
 const canvas={width:0,height:0,getContext:()=>ctx};let selection=0;s.drawSelection=()=>selection++;
 s.selectedOrnament=s.state.ornaments[0].id;
 for(const preset of Object.keys(s.presets)){s.state.preset=preset;s.drawCanvas(canvas,true);assert.equal(canvas.width,s.presets[preset].w);assert.equal(canvas.height,s.presets[preset].h);}
 assert.equal(selection,0);assert.equal(labels.length,42);assert.ok(labels.every(label=>label.font>0 && label.font<20));
});
test('canvas sticker gestures group Undo and preserve aspect through resize and rotation',()=>{
 const {s,load}=setup(),bindings=new Map(),{createSticker}=load('stickers');s.bind=(id,type,fn)=>bindings.set(id+':'+type,fn);s.listen=()=>{};
 s.activeDevice=function(){return this.state.frames[0]};s.frameSpec=()=>({aspect:2,sizeScale:1,screen:{x:0,y:0,w:100,h:200}});s.mockupAssets=()=>({status:'loading'});
 load('canvas').installCanvas(s);load('controller').installController(s,{});
 s.canvas={style:{},classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture:()=>false};s.pointerPoint=e=>e.point;
 const item=createSticker(s,{source:'catalog',stickerId:'label-wow'});s.state.ornaments.push(item);s.selectedOrnament=item.id;
 const ratio=item.width/item.height,p=s.presets[s.state.preset],cx=p.w/2,cy=p.h/2,w=item.width*p.w/100,h=item.height*p.h/100;
 const event=(x,y)=>({point:{x,y},pointerId:1,preventDefault(){},target:s.canvas});
 s.beginSlideHistory();bindings.get('preview:pointerdown')(event(cx+w/2,cy+h/2));assert.equal(s.pointerAction.type,'resize');
 s.handlePointerMove(event(cx+w,cy+h*.65));s.endPointer(event(cx+w,cy+h*.65));assert.equal(s.state.ornaments[0].width,40);assert.ok(Math.abs(s.state.ornaments[0].width/s.state.ornaments[0].height-ratio)<1e-8);assert.equal(s.slideHistory(s.state).undo.length,1);
 s.performHistory('undo');assert.equal(s.state.ornaments[0].width,20);s.performHistory('redo');assert.equal(s.state.ornaments[0].width,40);
 s.selectedOrnament=s.state.ornaments[0].id;s.beginSlideHistory();bindings.get('preview:pointerdown')(event(cx,cy-h-p.w*.07));assert.equal(s.pointerAction.type,'rotate');s.handlePointerMove(event(cx+200,cy));s.endPointer(event(cx+200,cy));assert.equal(s.state.ornaments[0].rotation,90);assert.equal(s.slideHistory(s.state).undo.length,2);
});
test('sticker command families reorder inside layers, preserve slide selection, and reject duplicate IDs',async()=>{
 const {s,load}=setup(),api=load('configRuntime');const other=s.createBlankSlide();other.jsonId='other';s.slides.push(other);const active=s.state.id;
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'sticker.add',slide:'other',value:{id:'one',kind:'sticker',source:'catalog',stickerId:'doodle-heart'}},{op:'ornament.duplicate',slide:'other',ornament:'one',id:'two'},{op:'sticker.move',slide:'other',sticker:'two',direction:'backward'},{op:'sticker.update',slide:'other',sticker:'one',value:{layer:'back'}},{op:'sticker.delete',slide:'other',sticker:'two'}]}),[]);
 assert.equal(s.state.id,active);assert.equal(s.slides[1].ornaments.length,1);assert.equal(s.slides[1].ornaments[0].layer,'back');
 await assert.rejects(()=>api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'sticker.duplicate',slide:'other',sticker:'one',id:'one'}]}),[]),/duplikat/);assert.equal(s.slides[1].ornaments.length,1);
});
test('sticker examples validate and imported uploads reject JPEG resources',()=>{
 const {s,load}=setup(),api=load('configRuntime');
 const assets=[{name:'screen.png',image:new FakeImage()},{name:'sticker.webp',image:new FakeImage(),mimeType:'image/webp'}];
 const source=readFileSync('features/screenshot-editor/configs/stickers-project.json','utf8');const prepared=api.prepareConfig(s,source,assets);s.slides=prepared.slides;s.state=s.slides[0];Object.assign(s,prepared.counters);
 const next=api.prepareConfig(s,readFileSync('features/screenshot-editor/configs/stickers-commands.json','utf8'),[]);assert.equal(next.slides[0].ornaments.length,5);
 assert.throws(()=>api.prepareConfig(s,project([{kind:'sticker',source:'upload',imageIndex:0}]),[{name:'bad.jpg',image:new FakeImage(),mimeType:'image/jpeg'}]),/PNG atau WebP/);
 const rich=api.prepareConfig(s,readFileSync('features/screenshot-editor/configs/rich-stickers-project.json','utf8'),assets);s.slides=rich.slides;s.state=s.slides[0];Object.assign(s,rich.counters);
 const enriched=api.prepareConfig(s,readFileSync('features/screenshot-editor/configs/rich-stickers-commands.json','utf8'),assets);assert.equal(enriched.slides[0].ornaments.length,8);assert.equal(enriched.slides[0].ornaments.find(item=>item.jsonId==='yay-copy').text,'NICE!');
});
test('legacy ornament update can still change shape kind',async()=>{
 const {s,load}=setup(),api=load('configRuntime');s.state.ornaments.push(s.createOrnament('circle'));
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'ornament.update',slide:'slide-1',ornament:'ornament-1',value:{kind:'star'}}]}),[]);assert.equal(s.state.ornaments[0].kind,'star');
});
test('very wide and tall uploaded stickers keep proportional defaults and round-trip',()=>{
 const {s,load}=setup(),api=load('configRuntime');
 for(const [w,h]of [[1,30000],[30000,1]]){const image=new FakeImage();image.naturalWidth=w;image.naturalHeight=h;const first=api.prepareConfig(s,project([{kind:'sticker',source:'upload',imageIndex:0}]),[{name:'extreme.png',image}]);const item=first.slides[0].ornaments[0];assert.equal(item.width,20);const result=api.serializeProject(first.slides);assert.doesNotThrow(()=>api.prepareConfig(s,JSON.stringify(result.config),result.assets));}
});
test('expanded catalog has unique IDs and explicit painters for every design',()=>{
 const load=modules(),{stickerCatalog}=load('stickers');
 assert.equal(stickerCatalog.length,54);assert.equal(new Set(stickerCatalog.map(item=>item.id)).size,54);
 for(const [category,count,module,registry]of [['doodle',24,'stickerDoodles','doodlePainters'],['emoji',16,'stickerEmoji','emojiPainters'],['label',14,'stickerLabels','labelDesigns']]){
  const entries=stickerCatalog.filter(item=>item.category===category),painters=load(module)[registry];assert.equal(entries.length,count);
  assert.deepEqual(Object.keys(painters).sort(),Array.from(entries,item=>item.id).sort());assert.ok(entries.every(item=>item.aspect>0));
 }
});
test('catalog search stays inside the active category and matches names or stable IDs',()=>{
 const {filterStickerCatalog}=modules()('stickers');
 assert.equal(filterStickerCatalog('doodle','').length,24);
 assert.equal(filterStickerCatalog('doodle','  PANAH  ').length,4);
 assert.equal(filterStickerCatalog('emoji','emoji-rocket')[0].label,'Roket');
 assert.equal(filterStickerCatalog('label','note')[0].text,'NOTE');
 assert.equal(filterStickerCatalog('doodle','emoji-rocket').length,0);
 assert.equal(filterStickerCatalog('label','not-a-sticker').length,0);
});
test('all 54 catalog designs round-trip through JSON with independent duplicates',async()=>{
 const {s,load}=setup(),api=load('configRuntime'),{stickerCatalog}=load('stickers');
 const ornaments=stickerCatalog.map((entry,i)=>({id:'catalog-'+i,kind:'sticker',source:'catalog',stickerId:entry.id,rotation:31,opacity:65,...(entry.category==='label'?{text:'A'.repeat(40),color:'#ff78aa'}:entry.category==='doodle'?{color:'#6ebfee'}:{})}));
 await api.applyConfig(s,project(ornaments),[]);const exported=api.serializeProject(s.slides);const imported=api.prepareConfig(s,JSON.stringify(exported.config),[]);
 assert.equal(imported.slides[0].ornaments.length,54);
 assert.deepEqual(Array.from(imported.slides[0].ornaments,item=>item.stickerId),Array.from(stickerCatalog,item=>item.id));
 const original=s.state.ornaments.find(item=>item.stickerId==='label-yay');
 await api.applyConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'sticker.duplicate',slide:'home',sticker:original.jsonId,id:'yay-copy'},{op:'sticker.update',slide:'home',sticker:'yay-copy',value:{text:'YAY!',color:'#9bda8c'}}]}),[]);
 assert.equal(s.state.ornaments.find(item=>item.jsonId===original.jsonId).text,'A'.repeat(40));assert.equal(s.state.ornaments.find(item=>item.jsonId==='yay-copy').text,'YAY!');
 s.performHistory('undo');assert.equal(s.state.ornaments.length,54);s.performHistory('redo');assert.equal(s.state.ornaments.length,55);
});
