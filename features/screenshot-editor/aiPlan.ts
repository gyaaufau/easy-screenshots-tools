import { backgroundSchema, frameSchema, ornamentSchema, slideSchema, parseConfig, type Schema, type Config, type SlideConfig, type OrnamentConfig, type Command } from './config';
import { strictSchema, validateSchema, type Recommendation } from './ai';

type JsonSchema = Record<string, any>;
export const requiredObject = (properties: JsonSchema): JsonSchema => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable = (schema: JsonSchema): JsonSchema => ({anyOf:[schema,{type:'null'}]});
const scalar = (schema: Schema) => strictSchema(schema);
const string = {type:'string'};
const text = slideSchema.properties!.headline.properties!;
const subtext = slideSchema.properties!.subheadline.properties!;
const frame = frameSchema.oneOf![1].properties!;
const background = backgroundSchema.properties!;
const shape = ornamentSchema.oneOf![0].properties!;
const catalog = ornamentSchema.oneOf!.slice(1,4).flatMap(branch=>branch.properties!.stickerId.enum!);
export interface VisionFact {app:string;purpose:string;features:string[];text:string[];colors:string[];uncertainty:string}
export const visionSchema = requiredObject({app:string,purpose:string,features:{type:'array',items:string},text:{type:'array',items:string},colors:{type:'array',items:scalar(background.color)},uncertainty:string});
export interface PlanOrnament {kind:string;stickerId:string|null;text:string|null;color:string|null;x:number;y:number;width:number;height:number;rotation:number;opacity:number;layer:'back'|'front'}
const ornamentPlanSchema = requiredObject({kind:scalar({enum:[...shape.kind.enum!,'sticker']}),stickerId:nullable(scalar({enum:catalog})),text:nullable({type:'string',maxLength:40}),color:nullable(scalar(shape.color)),...Object.fromEntries(['x','y','width','height','rotation','opacity','layer'].map(key=>[key,scalar(shape[key])]))});
const shadowSchema = requiredObject({color:scalar(frame.shadowColor),opacity:scalar(frame.shadowOpacity),blur:scalar(frame.shadowBlur),offsetX:scalar(frame.shadowOffsetX),offsetY:scalar(frame.shadowOffsetY)});
export interface DesignPlan {
 style:string;tone:string;mood:string;
 typography:{headlineFont:string;subheadlineFont:string;headlineSize:number;subheadlineSize:number;headlineStyle:string;subheadlineStyle:string;color:string;accent:string};
 slides:{headline:string;subheadline:string;layout:string;textColor:string|null;background:{type:string;color:string;secondary:string|null;angle:number|null;pattern:string|null;ink:string|null;scale:number|null;opacity:number|null};frame:{x:number;y:number;width:number;rotation:number;kind:string|null;shadow:{color:string;opacity:number;blur:number;offsetX:number;offsetY:number}|null};ornaments:PlanOrnament[]}[];
}
export const designPlanSchema = requiredObject({style:string,tone:string,mood:string,
 typography:requiredObject({headlineFont:scalar(text.font),subheadlineFont:scalar(subtext.font),headlineSize:scalar(text.size),subheadlineSize:scalar(subtext.size),headlineStyle:scalar(text.style.properties!.preset),subheadlineStyle:scalar(subtext.style.properties!.preset),color:scalar(background.color),accent:scalar(background.color)}),
 slides:{type:'array',minItems:1,maxItems:12,items:requiredObject({headline:scalar(text.content),subheadline:scalar(subtext.content),layout:scalar(slideSchema.properties!.layout),textColor:nullable(scalar(background.color)),
 background:requiredObject({type:scalar(background.backgroundType),color:scalar(background.color),secondary:nullable(scalar(background.gradientColor2)),angle:nullable(scalar(background.gradientAngle)),pattern:nullable(scalar({enum:['dots','lines','grid']})),ink:nullable(scalar(background.patternInkColor)),scale:nullable(scalar(background.patternScale)),opacity:nullable(scalar(background.patternOpacity))}),
 frame:requiredObject({x:{type:'number',minimum:0,maximum:100},y:{type:'number',minimum:0,maximum:100},width:{type:'number',minimum:10,maximum:90},rotation:{type:'number',minimum:-15,maximum:15},kind:nullable(scalar(frame.kind)),shadow:nullable(shadowSchema)}),ornaments:{type:'array',maxItems:12,items:ornamentPlanSchema}})},
});
export interface PlanContext {preset:string;frameKind:string}
export function compileOrnament(value: PlanOrnament,id:string): OrnamentConfig {
 validateSchema(value,ornamentPlanSchema,'ornament');
 const {kind,stickerId,text:label,color,...position}=value;
 if(kind!=='sticker'){
  if(!color || stickerId!==null || label!==null)throw new Error('ornament: shapes require color and no sticker fields.');
  return {id,...position,kind:kind as OrnamentConfig['kind'],color};
 }
 if(!stickerId)throw new Error('ornament.stickerId: a catalog sticker is required.');
 const category=stickerId.split('-')[0];
 if(category!=='label' && label!==null)throw new Error('ornament.text: only label stickers accept text.');
 if(category!=='emoji' && !color)throw new Error('ornament.color: this sticker requires a color.');
 return {id,...position,kind:'sticker',source:'catalog',stickerId,lockAspect:false,...(category==='emoji'?{}:{color:color!}),...(category==='label'?{text:label || ''}:{})};
}
export function compilePlan(plan: DesignPlan,count:number,context: PlanContext): Extract<Config,{kind:'project'}> {
 validateSchema(plan,designPlanSchema,'plan');
 if(plan.slides.length!==count)throw new Error('plan.slides: generate exactly one slide per upload.');
 const t=plan.typography;
 const slides:SlideConfig[]=plan.slides.map((slide,i)=>{
  const bg=slide.background,color=slide.textColor || t.color,f=slide.frame;
  if(bg.type==='gradient' && !bg.secondary)throw new Error(`plan.slides[${i}].background.secondary: gradient requires a second color.`);
  if(bg.type==='pattern' && (!bg.pattern || !bg.ink))throw new Error(`plan.slides[${i}].background: pattern and ink are required.`);
  const id=`ai-slide-${i+1}`;
  const textConfig=(content:string,headline:boolean)=>({content,font:headline?t.headlineFont:t.subheadlineFont,size:headline?t.headlineSize:t.subheadlineSize,style:{preset:(headline?t.headlineStyle:t.subheadlineStyle) as any,color,accent:t.accent},x:0,y:0,scale:1,rotation:0});
  return {id,layout:slide.layout,background:{backgroundType:bg.type as any,color:bg.color,gradientColor1:bg.color,gradientColor2:bg.secondary || bg.color,gradientAngle:bg.angle ?? 135,patternType:(bg.pattern || 'dots') as any,patternBaseColor:bg.color,patternInkColor:bg.ink || color,patternScale:bg.scale ?? 12,patternOpacity:bg.opacity ?? 8,imageIndex:null},
   headline:textConfig(slide.headline,true),subheadline:textConfig(slide.subheadline,false),
   frames:[{id:`ai-frame-${i+1}`,kind:(f.kind || context.frameKind) as any,imageIndex:i,zoom:100,imageFit:'contain',screenPanX:0,screenPanY:0,imageOffsetXPct:null,imageOffsetYPct:null,imageWidthPct:null,imageHeightPct:null,imageRotation:0,transform:{x:f.x,y:f.y,width:f.width,scale:1,rotation:f.rotation},shadowEnabled:true,shadowColor:f.shadow?.color || '#000000',shadowOpacity:f.shadow?.opacity ?? 22,shadowBlur:f.shadow?.blur ?? 6,shadowOffsetX:f.shadow?.offsetX ?? 0,shadowOffsetY:f.shadow?.offsetY ?? 2.5}],
   ornaments:slide.ornaments.map((item,j)=>compileOrnament(item,`ai-ornament-${i+1}-${j+1}`))};
 });
 return parseConfig(JSON.stringify({version:1,kind:'project',preset:context.preset,slides})) as Extract<Config,{kind:'project'}>;
}
export function makeRecommendation(config: Extract<Config,{kind:'project'}>,plan:Pick<DesignPlan,'style'|'tone'|'mood'>,facts:VisionFact[]): Recommendation {
 const colors=new Set<string>(),fonts=new Set<string>();
 config.slides.forEach(slide=>{
  const bg=slide.background!;
  const used=bg.backgroundType==='gradient'?[bg.gradientColor1,bg.gradientColor2]:bg.backgroundType==='pattern'?[bg.patternBaseColor,bg.patternInkColor]:[bg.color];
  for(const color of [...used,slide.headline?.style?.color,slide.subheadline?.style?.color,...(slide.ornaments || []).map(o=>o.color)])if(color)colors.add(color);
  for(const text of [slide.headline,slide.subheadline])fonts.add(`${text!.font} (${text!.size}px)`);
 });
 return {app:[...new Set(facts.map(f=>f.app).filter(Boolean))].join(' / ') || 'Screenshot design',uncertainty:[...new Set(facts.map(f=>f.uncertainty).filter(Boolean))].join('\n'),style:config.slides.map((s,i)=>`Slide ${i+1}: ${s.layout} · ${s.background!.backgroundType} · ${s.frames![0].kind} · ${s.frames![0].transform!.width}%`).join('; '),tone:plan.tone,mood:plan.mood,colors:[...colors].join(', '),typography:[...fonts].join(', '),ornaments:config.slides.map((s,i)=>`Slide ${i+1}: ${(s.ornaments || []).map(o=>o.stickerId || o.kind).join(', ') || 'none'}`).join('; '),copy:config.slides.map((s,i)=>`Slide ${i+1}: ${s.headline!.content} — ${s.subheadline!.content}`).join('\n'),slideCount:config.slides.length,slides:config.slides};
}
// Patches send only the fields being changed. Null is an actual editor value,
// never an omission marker. Target IDs are checked again by the atomic runtime.
const fields:Record<string,Schema>={};
for(const [prefix,schema] of [['background',backgroundSchema],['headline',slideSchema.properties!.headline],['subheadline',slideSchema.properties!.subheadline],['frame',frameSchema.oneOf![1]]] as const){
 for(const [key,value] of Object.entries(schema.properties!)){
  if(['id','imageIndex','kind'].includes(key))continue;
  if(value.type==='object')for(const [child,childSchema] of Object.entries(value.properties!))fields[`${prefix}.${key}.${child}`]=childSchema;
  else fields[`${prefix}.${key}`]=value;
 }
}
fields['slide.layout']=slideSchema.properties!.layout;
for(const key of ['x','y','width','height','rotation','opacity','layer','color'])fields['ornament.'+key]=shape[key];
fields['ornament.text']={type:'string',maxLength:40};
fields['ornament.stickerId']={enum:catalog};
export interface Change {slide:string;element:string|null;field:string;value:unknown}
export interface OrnamentAction {op:'add'|'delete';slide:string;element:string|null;value:PlanOrnament|null}
export function designReplySchema(edit=false): JsonSchema {
 if(!edit)return requiredObject({message:string,plan:designPlanSchema});
 const changes={type:'array',maxItems:100,items:{anyOf:Object.entries(fields).map(([field,schema])=>requiredObject({slide:string,element:nullable(string),field:{type:'string',enum:[field]},value:scalar(schema)}))}};
 return requiredObject({message:string,intent:{type:'string',enum:edit?['edit','recommend','answer']:['recommend']},plan:edit?nullable(designPlanSchema):designPlanSchema,changes,ornaments:{type:'array',maxItems:30,items:requiredObject({op:{type:'string',enum:['add','delete']},slide:string,element:nullable(string),value:nullable(ornamentPlanSchema)})}});
}
export function compileChanges(changes:Change[],ornaments:OrnamentAction[],project: Config): Extract<Config,{kind:'commands'}> {
 if(project.kind!=='project')throw new Error('project: edits require a project.');
 const commands:Command[]=[];
 for(const [i,change] of changes.entries()){
  const schema=fields[change.field];if(!schema)throw new Error(`changes[${i}].field: unknown field.`);
  validateSchema(change.value,scalar(schema),`changes[${i}].value`);
  const slide=project.slides.find(s=>s.id===change.slide);if(!slide)throw new Error(`changes[${i}].slide: unknown slide.`);
  const [target,...path]=change.field.split('.');const value:Record<string,any>={};let cursor=value;
  path.forEach((key,j)=>{if(j===path.length-1)cursor[key]=change.value;else cursor=cursor[key]={};});
  if(target==='frame'){
   if(!slide.frames?.some(f=>f.id===change.element))throw new Error(`changes[${i}].element: unknown frame.`);
   commands.push({op:'frame.update',slide:change.slide,frame:change.element!,value});
  }else if(target==='ornament'){
   const item=slide.ornaments?.find(o=>o.id===change.element);if(!item)throw new Error(`changes[${i}].element: unknown ornament.`);
   if(path[0]==='text' && !item.stickerId?.startsWith('label-'))throw new Error(`changes[${i}].field: only labels accept text.`);
   if(path[0]==='stickerId' && (item.kind!=='sticker' || item.source!=='catalog' || String(change.value).split('-')[0]!==item.stickerId?.split('-')[0]))throw new Error(`changes[${i}].field: sticker category cannot change.`);
   if(path[0]==='color' && (item.source==='upload' || item.stickerId?.startsWith('emoji-')))throw new Error(`changes[${i}].field: this ornament has no editable color.`);
   commands.push({op:'ornament.update',slide:change.slide,ornament:change.element!,value});
  }else{
   if(change.element!==null)throw new Error(`changes[${i}].element: slide fields require null.`);
   commands.push({op:'slide.update',slide:change.slide,value:target==='slide'?value:{[target]:value}});
  }
 }
 for(const [i,action] of ornaments.entries()){
  const slide=project.slides.find(s=>s.id===action.slide);if(!slide)throw new Error(`ornaments[${i}].slide: unknown slide.`);
  if(action.op==='delete'){
   if(action.value!==null || !slide.ornaments?.some(o=>o.id===action.element))throw new Error(`ornaments[${i}].element: unknown ornament.`);
   commands.push({op:'ornament.delete',slide:action.slide,ornament:action.element!});
  }else{
   if(action.element!==null || !action.value)throw new Error(`ornaments[${i}]: add requires value and null element.`);
   let id=`ai-added-${i+1}`;while(slide.ornaments?.some(o=>o.id===id))id+='x';
   commands.push({op:'ornament.add',slide:action.slide,value:compileOrnament(action.value,id)});
  }
 }
 if(!commands.length)throw new Error('changes: an edit must contain at least one change.');
 return parseConfig(JSON.stringify({version:1,kind:'commands',commands})) as Extract<Config,{kind:'commands'}>;
}
