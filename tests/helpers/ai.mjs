import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
export function load(name,extra={}) {
 const exports={};
 const {require:external,...environment}=extra;
 vm.runInNewContext(ts.transpileModule(readFileSync(`features/screenshot-editor/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>n.startsWith('.')?(n.endsWith('.json')?JSON.parse(readFileSync(`features/screenshot-editor/${n.slice(2)}`,'utf8')):load(n.slice(2),extra)):external(n),console,...environment});return exports;
}
export function plan(count=1){return {
 style:'Warm bold editorial',tone:'Supportive',mood:'Optimistic',
 typography:{headlineFont:'Nunito',subheadlineFont:'Nunito',headlineSize:120,subheadlineSize:44,headlineStyle:'normal',subheadlineStyle:'normal',color:'#27332B',accent:'#F6C15C'},
 slides:Array.from({length:count},(_,i)=>({headline:`Langkah ${i+1}`,subheadline:'Gas lagi, bre.',layout:'top',textColor:null,
  background:{type:'solid',color:'#FEF9EB',secondary:null,angle:null,pattern:null,ink:null,scale:null,opacity:null},
  frame:{x:50,y:64,width:62,rotation:-4,kind:null,shadow:null},
  ornaments:[{kind:'sparkle',stickerId:null,text:null,color:'#3E7455',x:85,y:26,width:5,height:2.3,rotation:12,opacity:100,layer:'front'}]}))
};}
