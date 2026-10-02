import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import {load as loadHybrid,plan} from './helpers/ai.mjs';
function load(name, overrides={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(`features/screenshot-editor/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>n==='react'?overrides.React:n.endsWith('.json')?JSON.parse(readFileSync(`features/screenshot-editor/${n.slice(2)}`,'utf8')):load(n.slice(2),overrides),console,...overrides});
 return exports;
}
function route(fetch) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync('app/api/ai/chat/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>loadHybrid(n.split('/').at(-1),{fetch,Response,AbortSignal,Date,require:n=>n==='node:crypto'?crypto:null,process:{env:{SUMOPOD_API_KEY:'test-server-key'}},setTimeout,clearTimeout}),fetch,Response,AbortSignal,AbortController,process:{env:{SUMOPOD_API_KEY:'test-server-key'}},console});return exports;
}
function recommendationFixture() {
 const ai=load('ai');
 function fill(schema,value) {
  if(schema.anyOf){
   if(value===undefined && schema.anyOf.some(s=>s.enum?.includes(ai.OMIT)))return ai.OMIT;
   const branch=schema.anyOf.find(s=>s.type==='object' && value && typeof value==='object') || schema.anyOf[0];return fill(branch,value);
  }
  if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).map(([key,child])=>[key,fill(child,value?.[key])]));
  if(schema.type==='array')return (value || []).map(item=>fill(schema.items,item));
  if(value!==undefined)return value;
  if(schema.enum)return schema.enum[0];
  if(schema.type==='number' || schema.type==='integer')return Math.max(0,schema.minimum || 0);
  if(schema.type==='boolean')return false;
  if(schema.pattern?.startsWith('^#'))return '#ff78aa';
  return 'test';
 }
 return fill(ai.recommendationSchema,{slideCount:1,slides:[{id:'slide-1',frames:[{id:'phone-1',imageIndex:0,transform:{x:50,y:65,width:60,scale:1,rotation:-6}}]}]});
}
const requestBody={phase:'analyze',prompt:'Identify this app',screenshots:[{name:'sample.png',dataUrl:'data:image/webp;base64,YQ==',assetIndex:0}],history:[],approved:null,project:{version:1,kind:'project',slides:[{}]},activeSlide:'slide-1',activeFrame:'frame-1',selection:null};
test('API exposes configured model metadata and requires approval before any provider call',async()=>{
 let contacted=false;const api=route(async()=>{contacted=true;});
 assert.equal((await (await api.GET()).json()).models.design,'deepseek-v4.1-flash:netra');
 const response=await api.POST(new Request('http://localhost/api/ai/chat',{method:'POST',body:JSON.stringify({...requestBody,phase:'generate'})}));
 assert.equal(response.status,400);assert.equal(contacted,false);
});
test('API returns structured provider errors without credentials',async()=>{
 const api=route(async()=>Response.json({}, {status:429}));
 const response=await api.POST(new Request('http://localhost/api/ai/chat',{method:'POST',body:JSON.stringify(requestBody)}));
 const body=await response.json();assert.equal(response.status,429);assert.equal(body.code,'RATE_LIMITED');assert.equal(body.retryable,true);assert.equal(JSON.stringify(body).includes('test-server-key'),false);
});
test('strict schema requires fields and omission normalization preserves meaningful nulls',()=>{
 const ai=load('ai');
 const schema=ai.strictSchema({type:'object',properties:{imageIndex:{oneOf:[{type:'integer'},{enum:[null]}]},color:{type:'string'}},required:[],additionalProperties:false});
 assert.equal(schema.required.length,2);
 const value=ai.normalizeConfig({imageIndex:null,color:ai.OMIT});
 assert.equal(value.imageIndex,null);assert.equal('color' in value,false);
});
test('vision resize preserves aspect ratio and never enlarges small images',()=>{
 const {visionSize}=load('aiImages');
 for(const [width,height,w,h] of [[3000,6000,800,1600],[6000,3000,1600,800],[200,100,200,100],[1600,1600,1600,1600]]){
  const result=visionSize(width,height);assert.equal(result.width,w);assert.equal(result.height,h);
 }
 assert.throws(()=>visionSize(0,200),/dimensions/);
});
test('compression caches only the AI copy and leaves the original untouched',async()=>{
 let encodes=0,drawn;
 const canvas={getContext:()=>({drawImage(...args){drawn=args;}}),toDataURL(type,quality){encodes++;assert.equal(type,'image/webp');assert.equal(quality,.8);return 'data:image/webp;base64,YQ==';}};
 const {compressForVision}=load('aiImages',{document:{createElement:()=>canvas}});
 const original={naturalWidth:3000,naturalHeight:6000,src:'data:image/png;base64,ORIGINAL'};
 assert.equal(await compressForVision(original),'data:image/webp;base64,YQ==');
 await compressForVision(original);assert.equal(encodes,1);assert.equal(canvas.width,800);assert.equal(canvas.height,1600);
 assert.equal(drawn[0],original);assert.equal(original.src,'data:image/png;base64,ORIGINAL');
});
test('compression preserves transparency through PNG fallback and retries failures without sending originals',async()=>{
 const types=[];let fail=true;
 const canvas={getContext:()=>fail?null:{drawImage(){}},toDataURL(type){types.push(type);return 'data:image/png;base64,YQ==';}};
 const {compressForVision}=load('aiImages',{document:{createElement:()=>canvas}}),image={naturalWidth:100,naturalHeight:100,src:'original'};
 await assert.rejects(()=>compressForVision(image),/compression/);
 fail=false;assert.equal(await compressForVision(image),'data:image/png;base64,YQ==');
 assert.deepEqual(types,['image/webp','image/png']);assert.equal(image.src,'original');
});
test('analysis cannot mutate canvas and generation needs approved direction',()=>{
 const ai=load('ai');
 assert.throws(()=>ai.validateReply({message:'Hi',recommendation:null,config:{version:1,kind:'project',slides:[{}]}},'analyze',1),/config/);
 assert.throws(()=>ai.validateRequest({phase:'generate',screenshots:[],history:[],project:{version:1,kind:'project',slides:[{}]}}),/approval|approved/i);
});
test('generation count and ordered asset mapping are enforced; edits require commands',()=>{
 const ai=load('ai');
 const config={version:1,kind:'project',slides:[{frames:[{imageIndex:0}]}]};
 assert.throws(()=>ai.validateReply({message:'Done',recommendation:null,config},'generate',2),/slide/);
 assert.throws(()=>ai.validateReply({message:'Done',recommendation:null,config},'edit',1),/commands/);
 const reply=ai.validateReply({message:'Done',recommendation:null,config},'generate',1);
 assert.equal(reply.config.slides[0].frames[0].imageIndex,0);
});
test('unknown reply fields and invalid editor settings are rejected',()=>{
 const ai=load('ai');
 assert.throws(()=>ai.validateReply({message:'Done',recommendation:null,config:null,extra:true},'analyze',1),/extra|schema/);
 assert.throws(()=>ai.validateReply({message:'Done',recommendation:null,config:{version:1,kind:'commands',commands:[{op:'preset',value:'unknown'}]}},'edit',1),/value/);
});
test('generated designs cannot reopen recommendation approval',()=>{
 const ai=load('ai'),recommendation=recommendationFixture();
 assert.throws(()=>ai.validateReply({message:'Done',recommendation,config:{version:1,kind:'project',slides:[{frames:[{imageIndex:0}]}]}},'generate',1),/recommendation/);
});
test('generation cannot drift from approved colors, typography, copy or composition',()=>{
 const ai=load('ai');
 const slide={background:{backgroundType:'solid',color:'#ff78aa'},headline:{content:'Your story',font:'Sora',size:96,style:{color:'#ffffff'}},frames:[{imageIndex:0,transform:{x:50,y:62,width:65,scale:1,rotation:-6}}],ornaments:[]};
 const approved={slides:[slide]};
 const reply=()=>({message:'Done',recommendation:null,config:{version:1,kind:'project',slides:[JSON.parse(JSON.stringify(slide))]}});
 for(const change of [s=>s.background.color='#ef5d42',s=>s.headline.font='Archivo',s=>s.headline.content='Generic title',s=>delete s.frames[0].transform]){
  const value=reply();change(value.config.slides[0]);assert.throws(()=>ai.validateReply(value,'generate',1,approved),/approved/i);
 }
 assert.equal(ai.validateReply(reply(),'generate',1,approved).config.slides[0].background.color,'#ff78aa');
});
test('recommendations require executable styling rather than default omission markers',()=>{
 const ai=load('ai'),valid=recommendationFixture();
 ai.validateReply({message:'Review this direction',recommendation:valid,config:null},'analyze',1);
 for(const change of [s=>s.background.color=ai.OMIT,s=>s.headline.font=ai.OMIT,s=>s.headline.style.color=null,s=>s.frames[0].transform.width=ai.OMIT]){
  const recommendation=JSON.parse(JSON.stringify(valid));change(recommendation.slides[0]);
  assert.throws(()=>ai.validateReply({message:'Review',recommendation,config:null},'analyze',1));
 }
});
test('recommendation describes rendered palette, fonts, copy and ornaments',()=>{
 const ai=load('ai'),recommendation=recommendationFixture();
 recommendation.colors='A blue gradient';recommendation.ornaments='Stars everywhere';
 const reply=ai.validateReply({message:'Review',recommendation,config:null},'analyze',1);
 assert.match(reply.recommendation.colors,/#ff78aa/);assert.doesNotMatch(reply.recommendation.colors,/blue/);
 assert.equal(reply.recommendation.ornaments,'Slide 1: none');assert.match(reply.recommendation.typography,/Archivo/);assert.match(reply.recommendation.copy,/test/);
});
test('server approval ignores provider drift and returns the exact approved slides',async()=>{
 let calls=0;const approved=recommendationFixture();
 const api=route(async()=>{calls++;throw new Error('Must not contact provider');});
 const response=await api.POST(new Request('http://localhost/api/ai/chat',{method:'POST',body:JSON.stringify({...requestBody,phase:'generate',approved})}));
 assert.equal(response.status,200);assert.equal(calls,0);assert.equal(JSON.stringify((await response.json()).config.slides),JSON.stringify(load('ai').normalizeConfig(approved.slides)));
});
test('generation schema locks approved visual values before the provider chooses output',()=>{
 const ai=load('ai'),approved=recommendationFixture(),schema=ai.replySchema('generate',approved);
 const value={message:'Done',recommendation:null,config:{version:1,kind:'project',preset:ai.OMIT,assets:ai.OMIT,slides:ai.normalizeConfig(approved.slides)}};
 ai.validateSchema(value,schema);
 value.config.slides[0].headline.font='Sora';
 assert.throws(()=>ai.validateSchema(value,schema));
});
test('edit schema stays within provider enum limit while retaining all commands',()=>{
 const schema=load('ai').replySchema('edit');let enums=0;
 function visit(value){if(!value || typeof value!=='object')return;if(Array.isArray(value.enum))enums+=value.enum.length;Object.values(value).forEach(visit);}
 visit(schema);assert.ok(enums<=1000,`Schema contains ${enums} enum values`);
});
test('AI apply rejects stale canvas state and accepted replacements undo as one transaction',async()=>{
 const refs=[],React={useRef(value){const ref={current:value};refs.push(ref);return ref;},useState(value){return [typeof value==='function'?value():value,()=>{}];},useEffect(){},useLayoutEffect(){}};
 const {actions}=load('useEditor',{React,window:{}}).useEditor();
 const session={notify(){},render(){},closeInlineEditor(){},showToast(){},frameSpecs:{},frameSpec:()=>({aspect:2}),waitForSlideAssets:async()=>{},ensureExportFonts:async()=>{}};
 load('model').installModel(session);load('history').installHistory(session);session.activeDevice=()=>session.state.frames[0];refs[1].current=session;
 session.state.frames[0].jsonId='custom-phone';session.activeObject='phone';assert.equal(actions.getProject().selection.id,'custom-phone');
 const project=actions.getProject(),source=JSON.stringify({version:1,kind:'project',slides:[{id:'new',headline:{content:'Generated'}}]});
 session.state.headline='Manual edit while AI is working';
 await assert.rejects(()=>actions.applyJson(source,[],project.signature),/Canvas changed/);
 assert.equal(session.state.headline,'Manual edit while AI is working');assert.equal(session.workspaceUndo.length,0);
 await actions.applyJson(source,[],actions.getProject().signature);assert.equal(session.state.headline,'Generated');assert.equal(session.workspaceUndo.length,1);
 session.performHistory('undo');assert.equal(session.state.headline,'Manual edit while AI is working');session.performHistory('redo');assert.equal(session.state.headline,'Generated');
});
test('generated catalog accents support precise size edits',()=>{
 const s={frameSpecs:{},frameSpec:()=>({aspect:2})};load('model').installModel(s);load('history').installHistory(s);
 const runtime=load('configRuntime',{window:{}});
 const prepared=runtime.prepareConfig(s,JSON.stringify({version:1,kind:'project',slides:[{id:'slide-1',ornaments:[{id:'sparkle',kind:'sticker',source:'catalog',stickerId:'doodle-sparkles',color:'#ffffff',x:12,y:8,width:20,height:20,rotation:0,opacity:100,layer:'front',lockAspect:false}]}]}),[]);
 s.slides=prepared.slides;s.state=s.slides[0];
 const edited=runtime.prepareConfig(s,JSON.stringify({version:1,kind:'commands',commands:[{op:'sticker.update',slide:'slide-1',sticker:'sparkle',value:{x:88,y:24,width:7,height:3.2,lockAspect:false}}]}),[]);
 assert.equal(edited.slides[0].ornaments[0].width,7);assert.equal(edited.slides[0].ornaments[0].height,3.2);
});
test('AI sticker edits use fields and IDs appropriate to the actual catalog category',()=>{
 const ai=load('ai'),schema=ai.replySchema('edit',null,{version:1,kind:'project',slides:[{id:'slide-1',ornaments:[{id:'sparkle',kind:'sticker',source:'catalog',stickerId:'doodle-sparkles'}]}]});
 const branch=Object.values(schema.$defs).find(s=>s.properties?.op?.enum?.[0]==='sticker.update');
 const valueSchema=schema.$defs[branch.properties.value.$ref.replace('#/$defs/','')];
 for(const key of ['text','kind','source','imageIndex'])assert.equal(key in valueSchema.properties,false);
 const value=Object.fromEntries(Object.keys(valueSchema.properties).map(key=>[key,ai.OMIT]));value.width=7;value.height=3.2;
 const reply={message:'Done',recommendation:null,config:{version:1,kind:'commands',commands:[{op:'sticker.update',slide:'slide-1',sticker:'sparkle',value}]}};
 ai.validateSchema(reply,schema);
 value.stickerId='emoji-smile';assert.throws(()=>ai.validateSchema(reply,schema));
});
