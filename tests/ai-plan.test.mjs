import test from 'node:test';
import assert from 'node:assert/strict';
import {load,plan} from './helpers/ai.mjs';
test('compact plan compiles ten ordered originals, stable IDs and explicit defaults',()=>{
 const api=load('aiPlan'),value=plan(10),context={preset:'app67',frameKind:'iphone-14-pro-dark'};
 const config=api.compilePlan(value,10,context),again=api.compilePlan(value,10,context);
 assert.equal(JSON.stringify(config),JSON.stringify(again));assert.equal(config.slides.length,10);
 for(const [i,slide] of config.slides.entries()){
  assert.equal(slide.frames[0].imageIndex,i);assert.equal(slide.frames[0].imageFit,'contain');assert.equal(slide.frames[0].zoom,100);
  assert.equal(slide.frames[0].imageWidthPct,null);assert.equal(slide.headline.x,0);assert.equal(slide.headline.font,'Nunito');
 }
 assert.equal(JSON.stringify(config).includes('__omit__'),false);
 assert.throws(()=>api.compilePlan(value,3,context),/slide/i);
 value.typography.headlineFont='Fake font';assert.throws(()=>api.compilePlan(value,10,context),/font/i);
});
test('patches target real canvas IDs and retain meaningful null values',()=>{
 const api=load('aiPlan'),config=api.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'}),slide=config.slides[0];
 const edits=[{slide:slide.id,element:slide.frames[0].id,field:'frame.imageWidthPct',value:null}];
 const commands=api.compileChanges(edits,[],config);
 assert.equal(commands.commands[0].value.imageWidthPct,null);
 edits[0].element='missing';assert.throws(()=>api.compileChanges(edits,[],config),/element/i);
});
test('compiled recommendation describes rendered settings, not model promises',()=>{
 const api=load('aiPlan'),config=api.compilePlan(plan(),1,{preset:'app67',frameKind:'iphone-14-pro-dark'});
 const rec=api.makeRecommendation(config,plan(),[{app:'STOPJUDOL',purpose:'Track abstinence',features:[],text:[],colors:[],uncertainty:'Name apparent'}]);
 assert.match(rec.style,/top.*solid.*iphone-14-pro-dark/);assert.notEqual(rec.style,plan().style);assert.match(rec.colors,/#FEF9EB/);assert.match(rec.typography,/Nunito/);assert.match(rec.ornaments,/sparkle/);assert.match(rec.copy,/Langkah 1/);
});
