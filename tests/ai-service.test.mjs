import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {load,plan} from './helpers/ai.mjs';
function service(fetch){return load('aiService',{fetch,Response,AbortSignal,Date,require:n=>n==='node:crypto'?crypto:null,process:{env:{SUMOPOD_API_KEY:'private-test-key'}},setTimeout,clearTimeout});}
const input={phase:'analyze',prompt:'Pakai bahasa Indonesia',screenshots:[{name:'app.png',dataUrl:'data:image/webp;base64,YQ==',assetIndex:0}],history:[],approved:null,project:{version:1,kind:'project',preset:'app67',slides:[{id:'home',frames:[{id:'phone',kind:'iphone-14-pro-dark',imageIndex:0}]}]},activeSlide:'home',activeFrame:'phone',selection:null};
const fact={app:'STOPJUDOL',purpose:'Streak tracker',features:['Streak'],text:['STOPJUDOL'],colors:['#3E7455'],uncertainty:''};
const completed=value=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
test('hybrid sends image bytes only to vision and caches facts across recommendations',async()=>{
 const calls=[],api=service(async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return completed(body.model==='gpt-4o-mini'?fact:{message:'Siap',plan:plan()});});
 const reply=await api.runAi(input,new AbortController().signal);
 assert.equal(reply.config,null);assert.equal(reply.recommendation.slideCount,1);
 assert.equal(calls[0].response_format.json_schema.strict,true);assert.equal(calls[1].response_format.json_schema.strict,true);
 assert.equal(calls[1].model,'deepseek-v4.1-flash:netra');assert.equal(calls[1].thinking.type,'disabled');
 assert.equal(JSON.stringify(calls[1]).includes('data:image'),false);
 await api.runAi({...input,phase:'recommend'},new AbortController().signal);
 assert.equal(calls.filter(c=>c.model==='gpt-4o-mini').length,1);
 assert.equal(JSON.stringify(reply).includes('private-test-key'),false);
});
test('approval returns the exact compiled slides without contacting any provider',async()=>{
 const api=service(()=>{throw new Error('Provider must not be called');});
 const p=load('aiPlan'),config=p.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'});
 const approved=p.makeRecommendation(config,plan(),[fact]);
 const reply=await api.runAi({...input,phase:'generate',approved},new AbortController().signal);
 assert.equal(JSON.stringify(reply.config.slides),JSON.stringify(approved.slides));assert.equal(reply.recommendation,null);
});
test('invalid outputs repair at most twice and report validation paths',async()=>{
 let calls=0;const seen=[];
 const api=service(async(url,options)=>{const b=JSON.parse(options.body);if(b.model==='gpt-4o-mini')return completed(fact);calls++;seen.push(b);const p=plan();p.typography.headlineFont='Invalid';return completed({message:'Siap',plan:p});});
 await assert.rejects(()=>api.runAi(input,new AbortController().signal),e=>e.code==='SCHEMA_INVALID' && /headlineFont/.test(e.detail));
 assert.equal(calls,3);assert.match(JSON.stringify(seen[1].messages),/headlineFont/);
});
test('auth, refusal and unsupported strict schema never retry or relax output',async()=>{
 for(const response of [Response.json({}, {status:401}),Response.json({error:{message:'response_format unavailable'}},{status:400}),Response.json({choices:[{message:{refusal:'No'}}]})]){
  let calls=0;const api=service(async()=>{calls++;return response.clone()});
  await assert.rejects(()=>api.runAi(input,new AbortController().signal));assert.equal(calls,1);
 }
});
test('JSON errors, truncation and invalid asset references repair within the same request',async()=>{
 for(const first of [Response.json({choices:[{finish_reason:'stop',message:{content:'```json'}}]}),Response.json({choices:[{finish_reason:'length',message:{content:'{"partial":'}}]})]){
  let calls=0;const api=service(async()=>++calls===1?first:completed(fact));
  const value=await api.providerJson('gpt-4o-mini',load('aiPlan').visionSchema,[],new AbortController().signal,1024,v=>v);
  assert.equal(value.app,'STOPJUDOL');assert.equal(calls,2);
 }
 const api=service(()=>{}),p=load('aiPlan'),config=p.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'});
 config.slides[0].frames[0].imageIndex=99;assert.throws(()=>api.validateAssets(config,1),/imageIndex/);
});
test('cancelled work never reaches the provider and changed bytes invalidate vision cache',async()=>{
 let vision=0;const api=service(async(url,options)=>{const body=JSON.parse(options.body);if(body.model==='gpt-4o-mini'){vision++;return completed(fact);}return completed({message:'Siap',plan:plan()});});
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(()=>api.runAi(input,cancelled.signal));assert.equal(vision,0);
 await api.runAi(input,new AbortController().signal);
 await api.runAi({...input,screenshots:[{...input.screenshots[0],dataUrl:'data:image/webp;base64,Yg=='}]},new AbortController().signal);assert.equal(vision,2);
});
test('targeted edits are staged against the actual project before leaving the server',async()=>{
 const p=load('aiPlan'),project=p.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'});project.assets=[{index:0,name:'app.png'}];
 let requests=0;const api=service(async(url,options)=>{const b=JSON.parse(options.body);if(b.model==='gpt-4o-mini')return completed(fact);requests++;return completed({message:'Latar sudah biru.',intent:'edit',plan:null,changes:[{slide:project.slides[0].id,element:null,field:'background.color',value:'#2255cc'}],ornaments:[]});});
 const reply=await api.runAi({...input,phase:'edit',project},new AbortController().signal);assert.equal(reply.config.commands[0].value.background.color,'#2255cc');assert.equal(requests,1);
});

test('new design direction returns a recommendation without canvas commands',async()=>{
 const api=service(async(url,options)=>{const b=JSON.parse(options.body);return completed(b.model==='gpt-4o-mini'?fact:{message:'New direction',intent:'recommend',plan:plan(),changes:[],ornaments:[]});});
 const reply=await api.runAi({...input,phase:'edit'},new AbortController().signal);
 assert.equal(reply.config,null);assert.equal(reply.recommendation.slideCount,1);
});
test('unavailable edit targets are repaired before commands can leave the server',async()=>{
 let calls=0;const api=service(async(url,options)=>{const b=JSON.parse(options.body);if(b.model==='gpt-4o-mini')return completed(fact);calls++;return completed({message:'Edit',intent:'edit',plan:null,changes:[{slide:'missing-slide',element:null,field:'background.color',value:'#2255cc'}],ornaments:[]});});
 await assert.rejects(()=>api.runAi({...input,phase:'edit'},new AbortController().signal),e=>e.code==='DESIGN_INVALID');assert.equal(calls,3);
});

test('recommended frames must fit inside canvas after rotation',()=>{
 const api=service(()=>{}),p=load('aiPlan'),config=p.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'});
 config.slides[0].frames[0].transform.y=95;
 assert.throws(()=>api.validateEditorOutput(config,input.project,1),/frame.*canvas bounds/);
});
