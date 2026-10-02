import { configSchema, slideSchema, parseConfig, type Config, type Schema, type SlideConfig } from './config';

export const OMIT = '__omit__';
export type Phase = 'analyze' | 'recommend' | 'generate' | 'edit';
export interface Recommendation { app: string; uncertainty: string; style: string; colors: string; typography: string; tone: string; mood: string; ornaments: string; copy: string; slideCount: number; slides: SlideConfig[] }
export interface AiModels {vision:string;design:string}
export interface AiReply { message: string; recommendation: Recommendation | null; config: Config | null; models?:AiModels }
export interface AiRequest { phase: Phase; prompt: string; screenshots: { name: string; dataUrl: string; assetIndex: number }[]; history: { role: 'user' | 'assistant'; content: string }[]; approved: Recommendation | null; project: Config; activeSlide: string; activeFrame: string; selection: unknown }
type JsonSchema = Record<string, any>;
const object = (properties: JsonSchema): JsonSchema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
// A recommendation contains an executable art direction. Required visual choices
// prevent approved designs from quietly reverting to editor defaults.
function requireFields(schema: Schema, fields: string[]): Schema {
  return {...schema,required:[...new Set([...(schema.required || []),...fields])]};
}
const plannedText = (schema: Schema): Schema => ({
  ...requireFields(schema,['content','font','size','style','x','y','scale','rotation']),
  properties:{...schema.properties,style:{...requireFields(schema.properties!.style,['preset','color','accent']),properties:{...schema.properties!.style.properties,color:schema.properties!.style.properties!.color.oneOf![0]}}},
});
const plannedFrame = slideSchema.properties!.frames.items!.oneOf![1];
export const plannedSlideSchema: Schema = {
  ...requireFields(slideSchema,['id','layout','background','headline','subheadline','frames','ornaments']),
  properties:{...slideSchema.properties,
    background:requireFields(slideSchema.properties!.background,['backgroundType','color','gradientColor1','gradientColor2','gradientAngle','patternType','patternBaseColor','patternInkColor','patternScale','patternOpacity']),
    headline:plannedText(slideSchema.properties!.headline),subheadline:plannedText(slideSchema.properties!.subheadline),
    frames:{type:'array',minItems:1,items:{...requireFields(plannedFrame,['id','kind','imageIndex','imageFit','transform']),properties:{...plannedFrame.properties,transform:requireFields(plannedFrame.properties!.transform,['x','y','width','scale','rotation'])}}},
    ornaments:{type:'array',items:{oneOf:slideSchema.properties!.ornaments.items!.oneOf!.map(schema=>requireFields(schema,Object.keys(schema.properties!)))}},
  },
};
export const recommendationSchema = object({
  ...Object.fromEntries(['app','uncertainty','style','colors','typography','tone','mood','ornaments','copy'].map(key => [key, {type:'string'}])),
  slideCount:{type:'integer',minimum:1,maximum:12},slides:{type:'array',minItems:1,items:strictSchema(plannedSlideSchema)},
});

// Keep the editor's optional properties without confusing omission with native null.
export function strictSchema(schema: Schema): JsonSchema {
  if (schema.oneOf) return { anyOf: schema.oneOf.map(strictSchema) };
  if (schema.type === 'object') return object(Object.fromEntries(Object.entries(schema.properties || {}).map(([key, child]) => [key, (schema.required || []).includes(key) ? strictSchema(child) : { anyOf: [strictSchema(child), {type:'string',enum:[OMIT]}] }])));
  if (schema.type === 'array') return {type:'array',items:strictSchema(schema.items!),...(schema.minItems ? {minItems:schema.minItems} : {})};
  if (schema.enum) {
    const types = [...new Set(schema.enum.map(value => value === null ? 'null' : typeof value))];
    return {type:types.length === 1 ? types[0] : types,enum:schema.enum};
  }
  return Object.fromEntries(Object.entries(schema).filter(([key])=>['type','minimum','maximum','maxLength','pattern'].includes(key)));
}
function approvedValueSchema(value: any): JsonSchema {
  if(Array.isArray(value))return {type:'array',minItems:value.length,maxItems:value.length,items:value.length?{anyOf:value.map(approvedValueSchema)}:{type:'string'}};
  if(value && typeof value==='object')return object(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,approvedValueSchema(item)])));
  return {type:value===null?'null':typeof value,enum:[value]};
}
function targetedEditSchema(project?: Config): Schema {
  const commands=configSchema.oneOf[2];
  if(project?.kind!=='project')return commands;
  const branches=commands.properties!.commands.items!.oneOf!.flatMap(branch=>{
    const op=branch.properties!.op.enum![0];
    if(op!=='sticker.update' && op!=='ornament.update')return [branch];
    return project.slides.flatMap(slide=>(slide.ornaments || []).filter(item=>op==='ornament.update' || item.kind==='sticker').map(item=>{
      const properties={...branch.properties!.value.properties};
      // Runtime preserves the element's kind/source. Restrict editable fields to
      // its real category: doodles cannot acquire label text or emoji settings.
      delete properties.kind;delete properties.source;
      if(item.kind!=='sticker')for(const key of ['stickerId','text','imageIndex','lockAspect'])delete properties[key];
      else if(item.source==='upload')for(const key of ['stickerId','text','color'])delete properties[key];
      else {
        delete properties.imageIndex;
        if(!item.stickerId?.startsWith('label-'))delete properties.text;
        if(item.stickerId?.startsWith('emoji-'))delete properties.color;
        const catalog=slideSchema.properties!.ornaments.items!.oneOf!.find(schema=>schema.properties?.stickerId?.enum?.includes(item.stickerId));
        if(catalog)properties.stickerId=catalog.properties!.stickerId;
      }
      const target=op==='sticker.update'?'sticker':'ornament';
      return {...branch,properties:{...branch.properties,slide:{enum:[slide.id]},[target]:{enum:[item.id]},value:{...branch.properties!.value,properties}}};
    }));
  });
  return {...commands,properties:{...commands.properties,commands:{...commands.properties!.commands,items:{oneOf:branches}}}};
}
export function replySchema(phase: Phase, approved?: Recommendation | null, project?: Config): JsonSchema {
  const projectSchema={...configSchema.oneOf[0],properties:{...configSchema.oneOf[0].properties,slides:{type:'array',minItems:1,items:plannedSlideSchema}}};
  const config = phase === 'generate' ? strictSchema(projectSchema) : phase === 'edit' ? strictSchema(targetedEditSchema(project)) : {type:'null'};
  if(phase==='generate' && approved)config.properties.slides=approvedValueSchema(normalizeConfig(approved.slides));
  const schema=object({message:{type:'string'},recommendation:phase==='generate'?{type:'null'}:{anyOf:[recommendationSchema,{type:'null'}]},config:phase === 'edit' ? {anyOf:[config,{type:'null'}]} : config});
  // Commands reuse slide/frame/ornament schemas. References prevent those enums
  // being counted repeatedly against the provider's 1,000-value schema limit.
  const definitions: JsonSchema={}, known=new Map<string,string>();
  function visit(value: any,root=false): any {
    if(Array.isArray(value))return value.map(item=>visit(item));
    if(!value || typeof value!=='object')return value;
    if(value.type==='object' && !root){
      const key=JSON.stringify(value),existing=known.get(key);
      if(existing)return {$ref:'#/$defs/'+existing};
      const name='object'+known.size;known.set(key,name);
      definitions[name]=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
      return {$ref:'#/$defs/'+name};
    }
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
  }
  return {...visit(schema,true),$defs:definitions};
}
export function normalizeConfig(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeConfig);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==OMIT).map(([k,v])=>[k,normalizeConfig(v)]));
  return value;
}
export function validateSchema(value: any, schema: JsonSchema, path = 'response', root = schema): void {
  if(schema.$ref){
    const definition=root.$defs?.[schema.$ref.replace('#/$defs/','')];
    if(!definition)throw new Error(path+': unknown schema reference.');
    validateSchema(value,definition,path,root);return;
  }
  if (schema.anyOf) {
    const discriminator=['field','op','kind'].find(key=>value && typeof value==='object' && schema.anyOf.some((branch:JsonSchema)=>branch.properties?.[key]?.enum?.includes(value[key])));
    const matched=discriminator && schema.anyOf.filter((branch:JsonSchema)=>branch.properties?.[discriminator]?.enum?.includes(value[discriminator]));
    if(matched && matched.length===1){validateSchema(value,matched[0],path,root);return;}
    if (schema.anyOf.some((branch: JsonSchema) => {try {validateSchema(value,branch,path,root);return true;}catch{return false;}})) return;
    throw new Error(path+': does not match response schema.');
  }
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.includes(type) && !(types.includes('integer') && Number.isInteger(value))) throw new Error(path+': invalid type.');
  if (schema.enum && !schema.enum.includes(value)) throw new Error(path+': invalid choice.');
  if(typeof value==='number' && (!Number.isFinite(value) || value<(schema.minimum ?? -Infinity) || value>(schema.maximum ?? Infinity)))throw new Error(path+': out of range.');
  if(typeof value==='string' && (value.length>(schema.maxLength ?? Infinity) || (schema.pattern && !new RegExp(schema.pattern).test(value))))throw new Error(path+': invalid format or length.');
  if(Array.isArray(value) && value.length<(schema.minItems || 0))throw new Error(path+': empty array.');
  if(Array.isArray(value) && value.length>(schema.maxItems ?? Infinity))throw new Error(path+': too many items.');
  if (type === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value,key)) throw new Error(path+'.'+key+': required.');
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties,key)) throw new Error(path+'.'+key+': unknown field.');
      validateSchema(value[key],schema.properties[key],path+'.'+key,root);
    }
  }
  if (type === 'array') value.forEach((item: unknown,i: number)=>validateSchema(item,schema.items,path+'['+i+']',root));
}
export function validateRequest(value: AiRequest): AiRequest {
  if (!value || !['analyze','recommend','generate','edit'].includes(value.phase)) throw new Error('Invalid request phase.');
  if (value.phase === 'generate' && !value.approved) throw new Error('An approved recommendation is required.');
  if (value.approved) {
    if(!value.approved.slides || value.approved.slideCount!==value.approved.slides.length)throw new Error('Invalid approved recommendation.');
    parseConfig(JSON.stringify({version:1,kind:'project',slides:normalizeConfig(value.approved.slides)}));
  }
  if (!Array.isArray(value.screenshots) || value.screenshots.length > 12 || (!value.screenshots.length && value.phase !== 'edit')) throw new Error('Upload 1–12 screenshots.');
  for (const item of value.screenshots) if (typeof item.name !== 'string' || !Number.isInteger(item.assetIndex) || item.assetIndex<0 || !/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(item.dataUrl) || item.dataUrl.length > 6_000_000) throw new Error('Invalid compressed screenshot.');
  if (!Array.isArray(value.history) || value.history.length > 40 || value.history.some(item=>!['user','assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 12000)) throw new Error('Conversation is too long. Start a new chat.');
  if (typeof value.prompt !== 'string' || value.prompt.length > 4000) throw new Error('Use a message under 4,000 characters.');
  parseConfig(JSON.stringify(value.project));
  return value;
}
function canonical(value: any): string {
  const sort = (item: any): any => Array.isArray(item) ? item.map(sort) : item && typeof item==='object' ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,sort(item[key])])) : item;
  return JSON.stringify(sort(normalizeConfig(value)));
}
function describeVisualChoices(recommendation: Recommendation, slides: SlideConfig[]): void {
  const colors=new Set<string>(),fonts=new Set<string>();
  slides.forEach(slide=>{
    const background=slide.background!;
    const palette=background.backgroundType==='gradient'?[background.gradientColor1,background.gradientColor2]:background.backgroundType==='pattern'?[background.patternBaseColor,background.patternInkColor]:[background.color];
    for(const color of [...palette,slide.headline?.style?.color,slide.subheadline?.style?.color,...(slide.ornaments || []).map(item=>item.color)])if(color)colors.add(color);
    for(const text of [slide.headline,slide.subheadline])if(text)fonts.add(`${text.font} (${text.size}px)`);
  });
  // Describe what will actually render, rather than advertise effects the model
  // mentioned in prose but never included in its plan.
  recommendation.colors=[...colors].join(', ');
  recommendation.typography=[...fonts].join(', ');
  recommendation.ornaments=slides.map((slide,i)=>`Slide ${i+1}: ${slide.ornaments?.length ? slide.ornaments.map(item=>item.stickerId || item.kind).join(', ') : 'none'}`).join('; ');
  recommendation.copy=slides.map((slide,i)=>`Slide ${i+1}: ${slide.headline?.content}${slide.subheadline?.content?' — '+slide.subheadline.content:''}`).join('\n');
}
export function validateReply(value: AiReply, phase: Phase, count: number, approved?: Pick<Recommendation,'slides'> | null): AiReply {
  if (!value || Object.keys(value).some(key=>!['message','recommendation','config','models'].includes(key)) || typeof value.message !== 'string' || !value.message.trim()) throw new Error('Invalid response schema.');
  if(value.config!==null && value.recommendation!==null)throw new Error('A canvas change cannot include a new recommendation.');
  if (value.recommendation !== null) {
    validateSchema(value.recommendation,recommendationSchema);
    if(value.recommendation.slideCount !== count || value.recommendation.slides.length !== count)throw new Error('Recommendation slide count must match uploads.');
    const plan=parseConfig(JSON.stringify({version:1,kind:'project',slides:normalizeConfig(value.recommendation.slides)}));
    if(plan.kind==='project'){
      plan.slides.forEach((slide,i)=>{if(!slide.frames?.some(frame=>frame.imageIndex===i))throw new Error('Recommended slides must use their matching upload.');});
      describeVisualChoices(value.recommendation,plan.slides);
    }
  }
  if (phase === 'analyze' || phase === 'recommend') {
    if (value.config !== null) throw new Error('Recommendation config must be null.');
    if (!value.recommendation) throw new Error('A design recommendation is required.');
  }
  if (value.config !== null) {
    value.config = parseConfig(JSON.stringify(normalizeConfig(value.config)));
    if (phase === 'generate') {
      if (value.config.kind !== 'project' || value.config.slides.length !== count) throw new Error('Generate one slide per upload.');
      value.config.slides.forEach((slide,i)=>{if(!slide.frames?.some(frame=>frame.imageIndex===i))throw new Error('Each slide must use its matching upload index.');});
      if(approved && canonical(value.config.slides)!==canonical(approved.slides))throw new Error('Generated design differs from the approved recommendation. Please retry.');
    } else if (phase === 'edit' && value.config.kind !== 'commands') throw new Error('Edits must use commands.');
  } else if (phase === 'generate') throw new Error('Generation config is required.');
  return value;
}
