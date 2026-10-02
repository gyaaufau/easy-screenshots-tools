import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

// Explicit live integration check; sends only compressed repository sample images.
const url=process.env.AI_TEST_URL || 'http://localhost:3000/api/ai/chat';
const count=Number(process.env.AI_TEST_COUNT || 1);
const names=JSON.parse(readFileSync('designs/stopjudol/project.json','utf8')).assets.map(asset=>asset.name);
const images=names.slice(0,count).map(name=>'designs/stopjudol/assets/'+name);
const screenshots=await Promise.all(images.map(async (name,assetIndex)=>({name,assetIndex,dataUrl:'data:image/webp;base64,'+(await sharp(name).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer()).toString('base64')})));
const project={version:1,kind:'project',preset:'app67',slides:[{id:'slide-1',frames:[{id:'frame-1',kind:'iphone-14-pro-dark'}]}]};
async function request(phase,extra={}) {
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({phase,prompt:'Gunakan bahasa Indonesia. App STOPJUDOL: bantu pantau waktu bebas judol. Desain editorial berani, krem #FEF9EB, hijau #3E7455, kuning #F6C15C, tinta #27332B. Nunito, headline120/sub44, tiga sparkle kecil per slide di area kosong, satu lingkaran transparan belakang frame. Variasikan top/bottom, frame contain tanpa crop.',screenshots,history:[],approved:null,project,activeSlide:'slide-1',activeFrame:'frame-1',selection:null,...extra})});
 const body=await response.json();
 if(!response.ok)throw new Error(phase+': '+body.error+(body.validation?' '+body.validation:''));
 console.log(phase+': validated response');return body;
}
const recommendation=await request('analyze');
const generated=await request('generate',{approved:recommendation.recommendation});
const config=generated.config;
console.log('Generated slide count: '+config.slides.length);
writeFileSync(`/tmp/screenshot-ai-${count}.json`,JSON.stringify(config,null,2));
writeFileSync(`/tmp/screenshot-ai-recommendation-${count}.json`,JSON.stringify(recommendation,null,2));
const modules=new Map();
class OriginalImage {constructor(src){this.src=src;}}
function load(name) {
 if(modules.has(name))return modules.get(name);
 const exports={};modules.set(name,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(`features/screenshot-editor/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>n.endsWith('.json')?JSON.parse(readFileSync(`features/screenshot-editor/${n.slice(2)}`,'utf8')):load(n.slice(2)),console,HTMLImageElement:OriginalImage,window:{},setTimeout,clearTimeout});return exports;
}
const session={notify(){},render(){},closeInlineEditor(){},showToast(){},frameSpecs:{},frameSpec:()=>({aspect:2}),waitForSlideAssets:async()=>{},ensureExportFonts:async()=>{}};
load('model').installModel(session);load('history').installHistory(session);
const original=session.state,assets=images.map(name=>({name,image:new OriginalImage(name)}));
await load('configRuntime').applyConfig(session,JSON.stringify(config),assets);
if(session.slides.length!==images.length || session.slides.some((slide,i)=>!slide.frames.some(frame=>frame.image===assets[i].image)))throw new Error('Original image mapping failed');
session.performHistory('undo');if(session.state.id!==original.id)throw new Error('Undo failed');
session.performHistory('redo');if(session.slides.length!==images.length)throw new Error('Redo failed');
console.log('Canvas apply, original asset mapping, Undo and Redo: passed');
const editable=load('configRuntime').serializeProject(session.slides);
const edit=await request('edit',{prompt:'Make only the first slide background solid blue #2255cc.',project:editable.config,activeSlide:editable.config.slides[0].id,activeFrame:editable.config.slides[0].frames[0].id});
writeFileSync(`/tmp/screenshot-ai-edit-${count}.json`,JSON.stringify(edit,null,2));
await load('configRuntime').applyConfig(session,JSON.stringify(edit.config),editable.assets);
if(session.slides[0].color.toLowerCase()!=='#2255cc' || session.slides[0].backgroundType!=='solid')throw new Error(`Targeted edit failed: ${session.slides[0].backgroundType} ${session.slides[0].color}`);
if(edit.config.commands.some(c=>c.slide && c.slide!==editable.config.slides[0].id))throw new Error('Edit targeted an unrelated slide');
console.log('Targeted edit: passed');
