import { stickerCatalog } from './stickers';
import type { Device, EditorSettings, Ornament, Slide, TextStyle } from './model';
export type ImageIndex = number | null | '$current';
export interface TextConfig {
    content?: string;
    font?: string;
    size?: number;
    style?: Partial<TextStyle>;
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
}
export type BackgroundConfig = Partial<Pick<EditorSettings, 'backgroundType' | 'color' | 'gradientColor1' | 'gradientColor2' | 'gradientAngle' | 'patternType' | 'patternBaseColor' | 'patternInkColor' | 'patternScale' | 'patternOpacity'>> & {
    imageIndex?: ImageIndex;
};
export interface FrameTransform { x?: number; y?: number; width?: number; scale?: number; rotation?: number }
export type FrameConfig = Partial<Omit<Device, 'id' | 'image' | 'fileName' | 'jsonId'>> & {
    id?: string;
    transform?: FrameTransform;
    imageIndex?: ImageIndex;
};
export type OrnamentConfig = Partial<Pick<Ornament, 'kind' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'color' | 'opacity' | 'layer'>> & {
    id?: string; source?: 'catalog' | 'upload'; stickerId?: string; text?: string; lockAspect?: boolean; imageIndex?: ImageIndex;
};
export interface SlideConfig {
    id?: string;
    layout?: string;
    background?: BackgroundConfig;
    headline?: TextConfig;
    subheadline?: TextConfig;
    frames?: FrameConfig[];
    ornaments?: OrnamentConfig[];
}
export interface AssetConfig {
    index: number;
    name: string;
}
export type Command = {
    op: 'slide.add';
    value?: SlideConfig;
} | {
    op: 'slide.duplicate';
    slide: string;
    id: string;
} | {
    op: 'slide.delete' | 'slide.select' | 'slide.reset';
    slide: string;
} | {
    op: 'slide.move';
    slide: string;
    index: number;
} | {
    op: 'slide.update';
    slide: string;
    value: SlideConfig;
} | {
    op: 'frame.add';
    slide: string;
    value: FrameConfig;
} | {
    op: 'frame.update';
    slide: string;
    frame: string;
    value: FrameConfig;
} | {
    op: 'frame.duplicate';
    slide: string;
    frame: string;
    id: string;
} | {
    op: 'frame.delete' | 'frame.select';
    slide: string;
    frame: string;
} | {
    op: 'frame.arrange';
    slide: string;
    arrangement: 'cascade' | 'sideBySide';
} | {
    op: 'ornament.add' | 'sticker.add';
    slide: string;
    value: OrnamentConfig;
} | {
    op: 'ornament.update';
    slide: string;
    ornament: string;
    value: OrnamentConfig;
} | {
    op: 'ornament.delete' | 'ornament.select';
    slide: string;
    ornament: string;
} | {
    op: 'ornament.move';
    slide: string;
    ornament: string;
    direction: 'forward' | 'backward';
} | {
    op: 'ornament.duplicate'; slide: string; ornament: string; id: string;
} | {
    op: 'sticker.update'; slide: string; sticker: string; value: OrnamentConfig;
} | {
    op: 'sticker.delete' | 'sticker.select'; slide: string; sticker: string;
} | {
    op: 'sticker.duplicate'; slide: string; sticker: string; id: string;
} | {
    op: 'sticker.move' | 'sticker.reorder'; slide: string; sticker: string; direction: 'forward' | 'backward';
} | {
    op: 'ornament.reorder'; slide: string; ornament: string; direction: 'forward' | 'backward';
} | {
    op: 'preset';
    value: 'app67' | 'app65' | 'play';
} | {
    op: 'zoom';
    mode: 'screen' | 'custom';
    percent?: number;
} | {
    op: 'undo' | 'redo' | 'export.active' | 'export.all';
};
export type Config = {
    version: 1;
    kind: 'project';
    preset?: string;
    slides: SlideConfig[];
    assets?: AssetConfig[];
} | {
    version: 1;
    kind: 'template';
    preset?: string;
    slide: SlideConfig;
    assets?: AssetConfig[];
} | {
    version: 1;
    kind: 'commands';
    commands: Command[];
};
export interface Schema {
    type?: string | string[];
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: boolean;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
    pattern?: string;
    items?: Schema;
    minItems?: number;
    oneOf?: Schema[];
}
const number = (minimum = -10000, maximum = 10000): Schema => ({ type: 'number', minimum, maximum });
const choice = (...values: unknown[]): Schema => ({ enum: values });
const color: Schema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const id: Schema = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$' };
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const index: Schema = { oneOf: [{ type: 'integer', minimum: 0 }, choice(null, '$current')] };
const fonts = ['Archivo', 'IBM Plex Sans', 'Inter', 'Poppins', 'Montserrat', 'Nunito', 'Roboto', 'Open Sans', 'Lato', 'Raleway', 'Work Sans', 'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Sora', 'Space Grotesk', 'Outfit', 'Bricolage Grotesque', 'Figtree', 'Rubik', 'Urbanist', 'Quicksand', 'Comfortaa', 'Bebas Neue', 'Anton', 'Oswald', 'Playfair Display', 'Lora', 'Merriweather', 'DM Serif Display'];
const text = object({ content: { type: 'string', maxLength: 90 }, font: choice(...fonts), size: number(16, 220), style: object({ preset: choice('normal', 'shadow', 'outline', 'gradient', 'highlight', 'neon'), color: { oneOf: [color, choice(null)] }, accent: color }), x: number(), y: number(), scale: number(.35, 3), rotation: number() });
export const backgroundSchema = object({ backgroundType: choice('solid', 'gradient', 'pattern'), color, gradientColor1: color, gradientColor2: color, gradientAngle: number(-360, 360), patternType: choice('dots', 'lines', 'grid', 'upload'), patternBaseColor: color, patternInkColor: color, patternScale: number(3, 35), patternOpacity: number(0, 100), imageIndex: index });
const nullable = (schema: Schema): Schema => ({ oneOf: [schema, choice(null)] });
const legacyFrameSchema = object({ id, kind: choice('iphone-14-dark', 'iphone-14-plus-dark', 'iphone-14-pro-dark', 'iphone-14-pro-max-dark'), imageIndex: index, zoom: number(20, 250), imageFit: choice('cover', 'contain'), screenPanX: number(-100, 100), screenPanY: number(-100, 100), imageOffsetXPct: nullable(number()), imageOffsetYPct: nullable(number()), imageWidthPct: nullable(number(.1, 1000)), imageHeightPct: nullable(number(.1, 1000)), imageRotation: number(), frameZoom: number(35, 170), frameRotation: number(), frameWidthPct: nullable(number(.1, 1000)), frameHeightPct: nullable(number(.1, 1000)), frameOffsetXPct: number(), frameOffsetYPct: number(), shadowEnabled: { type: 'boolean' }, shadowColor: color, shadowOpacity: number(0, 100), shadowBlur: number(0, 40), shadowOffsetX: number(-50, 50), shadowOffsetY: number(-50, 50) });
const legacyTransformKeys = ['frameOffsetXPct','frameOffsetYPct','frameWidthPct','frameHeightPct','frameZoom','frameRotation'];
const transformSchema = object({x:number(),y:number(),width:number(.1,1000),scale:number(.35,1.7),rotation:number()});
const simpleFrameFields = {...legacyFrameSchema.properties};
for (const key of legacyTransformKeys) delete simpleFrameFields[key];
export const frameSchema: Schema = {oneOf:[legacyFrameSchema,object({...simpleFrameFields,transform:transformSchema},['transform'])]};
const ornamentFields = { id, x: number(), y: number(), width: number(.1,200), height: number(.1,200), rotation: number(), opacity: number(0,100), layer: choice('back','front') };
const shapeSchema = object({...ornamentFields,kind:choice('circle','rectangle','line','arrow','star','sparkle','blob'),color});
const stickerDimensions = {width:{type:'number',minimum:.000001},height:{type:'number',minimum:.000001}};
const catalogFields = {...ornamentFields,...stickerDimensions,kind:choice('sticker'),source:choice('catalog'),lockAspect:{type:'boolean'}};
const stickerSchemas: Schema[] = ['doodle','emoji','label'].map(category=>object({...catalogFields,
    stickerId:choice(...stickerCatalog.filter(item=>item.category===category).map(item=>item.id)),
    ...(category==='emoji'?{}:{color}), ...(category==='label'?{text:{type:'string',maxLength:40}}:{}),
},['kind','source','stickerId']));
stickerSchemas.push(object({...ornamentFields,...stickerDimensions,kind:choice('sticker'),source:choice('upload'),imageIndex:index,lockAspect:{type:'boolean'}},['kind','source','imageIndex']));
export const ornamentSchema: Schema = {oneOf:[shapeSchema,...stickerSchemas]};
const ornamentUpdateSchema = object({...ornamentFields,...stickerDimensions,kind:choice('circle','rectangle','line','arrow','star','sparkle','blob','sticker'),color,source:choice('catalog','upload'),stickerId:choice(...stickerCatalog.map(item=>item.id)),imageIndex:index,lockAspect:{type:'boolean'},text:{type:'string',maxLength:40}});
export const slideSchema = object({ id, layout: choice('top', 'left', 'bottom'), background: backgroundSchema, headline: { ...text, properties: { ...text.properties, content: { type: 'string', maxLength: 70 }, size: number(36, 220) } }, subheadline: { ...text, properties: { ...text.properties, size: number(16, 100) } }, frames: { type: 'array', items: frameSchema, minItems: 1 }, ornaments: { type: 'array', items: ornamentSchema } });
const commandSchemas: Schema[] = [];
function command(op: string, properties: Record<string, Schema> = {}, required: string[] = []) { commandSchemas.push(object({ op: choice(op), ...properties }, ['op', ...required])); }
command('slide.add', { value: slideSchema });
command('slide.duplicate', { slide: id, id }, ['slide', 'id']);
for (const op of ['slide.delete', 'slide.select', 'slide.reset'])
    command(op, { slide: id }, ['slide']);
command('slide.move', { slide: id, index: { type: 'integer', minimum: 0 } }, ['slide', 'index']);
command('slide.update', { slide: id, value: slideSchema }, ['slide', 'value']);
for (const [prefix, schema] of [['frame', frameSchema], ['ornament', ornamentUpdateSchema], ['sticker', ornamentUpdateSchema]] as const) {
    command(`${prefix}.add`, { slide: id, value: prefix==='frame'?schema:ornamentSchema }, ['slide', 'value']);
    command(`${prefix}.update`, { slide: id, [prefix]: id, value: schema }, ['slide', prefix, 'value']);
    for (const action of ['delete', 'select'])
        command(`${prefix}.${action}`, { slide: id, [prefix]: id }, ['slide', prefix]);
}
command('frame.duplicate', {slide:id,frame:id,id}, ['slide','frame','id']);
command('frame.arrange', { slide: id, arrangement: choice('cascade', 'sideBySide') }, ['slide', 'arrangement']);
for (const prefix of ['ornament','sticker']) {
    command(`${prefix}.duplicate`,{slide:id,[prefix]:id,id},['slide',prefix,'id']);
    for(const op of ['move','reorder']) command(`${prefix}.${op}`,{slide:id,[prefix]:id,direction:choice('forward','backward')},['slide',prefix,'direction']);
}
command('preset', { value: choice('app67', 'app65', 'play') }, ['value']);
command('zoom', { mode: choice('screen', 'custom'), percent: number(20, 200) }, ['mode']);
for (const op of ['undo', 'redo', 'export.active', 'export.all'])
    command(op);
const assets: Schema = { type: 'array', items: object({ index: { type: 'integer', minimum: 0 }, name: { type: 'string' } }, ['index', 'name']) };
export const configSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Screenshot Editor Config v1', oneOf: [
        object({ version: choice(1), kind: choice('project'), preset: choice('app67', 'app65', 'play'), slides: { type: 'array', items: slideSchema, minItems: 1 }, assets }, ['version', 'kind', 'slides']),
        object({ version: choice(1), kind: choice('template'), preset: choice('app67', 'app65', 'play'), slide: slideSchema, assets }, ['version', 'kind', 'slide']),
        object({ version: choice(1), kind: choice('commands'), commands: { type: 'array', items: { oneOf: commandSchemas }, minItems: 1 } }, ['version', 'kind', 'commands'])
    ] };
export function validate(value: unknown, schema: Schema, path = 'config'): void {
    if (schema.oneOf) {
        const operation = (value as {
            op?: string;
        })?.op;
        const exact = schema.oneOf.find(branch => branch.properties?.op?.enum?.includes(operation));
        if (exact) {
            validate(value, exact, path);
            return;
        }
        const errors: Error[] = [];
        for (const branch of schema.oneOf) {
            try {
                validate(value, branch, path);
                return;
            }
            catch (error) {
                errors.push(error as Error);
            }
        }
        throw errors.sort((a, b) => b.message.length - a.message.length)[0];
    }
    const fail = (message: string): never => { throw new Error(`${path}: ${message}`); };
    if (schema.enum && !schema.enum.includes(value))
        fail(`pilihan tidak valid (${schema.enum.join(', ')})`);
    if (!schema.type)
        return;
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            fail('harus object');
        const fields = value as Record<string, unknown>;
        for (const key of schema.required || [])
            if (!(key in fields))
                fail(`field ${key} wajib diisi`);
        for (const key of Object.keys(fields)) {
            const child = Object.prototype.hasOwnProperty.call(schema.properties, key) ? schema.properties?.[key] : undefined;
            if (!child)
                throw new Error(`${path ? path + "." : ""}${key}: properti tidak dikenal`);
            validate(fields[key], child, `${path ? path + "." : ""}${key}`);
        }
    }
    else if (schema.type === 'array') {
        if (!Array.isArray(value))
            fail('harus array');
        const items = value as unknown[];
        if (items.length < (schema.minItems || 0))
            fail('array tidak boleh kosong');
        items.forEach((item, i) => validate(item, schema.items!, `${path}[${i}]`));
    }
    else if (schema.type === 'number' || schema.type === 'integer') {
        if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)))
            fail('harus angka valid');
        if ((value as number) < (schema.minimum ?? -Infinity) || (value as number) > (schema.maximum ?? Infinity))
            fail(`angka di luar rentang ${schema.minimum}–${schema.maximum}`);
    }
    else {
        if (typeof value !== schema.type)
            fail(`harus ${schema.type}`);
        if (typeof value === 'string' && ((schema.maxLength && value.length > schema.maxLength) || (schema.pattern && !new RegExp(schema.pattern).test(value))))
            fail('format atau panjang tidak valid');
    }
}
export function parseConfig(source: string): Config {
    let value: unknown;
    try {
        value = JSON.parse(source);
    }
    catch {
        throw new Error('JSON: sintaks tidak valid');
    }
    const kind = (value as {
        kind?: string;
    })?.kind;
    const branch = configSchema.oneOf.find(schema => schema.properties?.kind.enum?.includes(kind));
    if (!branch)
        throw new Error('kind: gunakan project, template, atau commands');
    validate(value, branch, '');
    const config = value as Config;
    if (config.kind === 'commands' && config.commands.length > 1 && config.commands.some(c => ['undo', 'redo', 'export.active', 'export.all'].includes(c.op)))
        throw new Error('commands: undo, redo, dan export harus command tunggal');
    if (config.kind === 'commands')
        for (const [i, c] of config.commands.entries())
            if (c.op === 'zoom' && c.mode === 'custom' && c.percent === undefined)
                throw new Error(`commands[${i}].percent: wajib untuk zoom custom`);
    return config;
}
export const examples: Record<Config['kind'], Config> = {
    project: { version: 1, kind: 'project', preset: 'app67', slides: [{ id: 'home', headline: { content: 'Desain siap tayang', style: { preset: 'shadow' } }, background: { backgroundType: 'gradient' }, frames: [{ id: 'phone', imageIndex: 0, transform:{x:32,y:55,width:38,scale:1,rotation:-12} },{id:'phone-right',imageIndex:0,transform:{x:68,y:58,width:38,scale:.9,rotation:12}}], ornaments: [{ id: 'spark', kind: 'sparkle', x: 85, y: 25, color: '#f5b93f' },{id:'wow',kind:'sticker',source:'catalog',stickerId:'label-wow',text:'WOW!',color:'#ff78aa',x:80,y:35,rotation:-12}] }] },
    template: { version: 1, kind: 'template', preset: 'play', slide: { headline: { content: 'Cerita aplikasi kamu' }, frames: [{ imageIndex: '$current' }], background: { backgroundType: 'solid', color: '#1d68d7' } } },
    commands: { version: 1, kind: 'commands', commands: [{op:'frame.duplicate',slide:'home',frame:'phone',id:'phone-copy'},{op:'frame.update',slide:'home',frame:'phone-copy',value:{transform:{x:50,y:65,width:30,scale:.8,rotation:0}}},{ op: 'slide.update', slide: 'home', value: { headline: { content: 'Headline baru', style: { preset: 'neon' } } } }] }
};
