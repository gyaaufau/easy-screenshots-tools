import { installModel, type Slide, type Device, type Ornament } from './model';
import { installCanvas } from './canvas';
import { createSticker } from './stickers';
import { frameGeometry } from './frameGeometry';
import * as frameSpecs from './frame-specs.json';
import { presets } from './model';
import type { EditorSession } from './session';
import { parseConfig, validate, ornamentSchema, backgroundSchema, type Config, type SlideConfig, type FrameConfig, type OrnamentConfig, type TextConfig, type ImageIndex } from './config';
export interface ConfigAsset {
    name: string;
    image: HTMLImageElement;
    mimeType?: string;
}
const slideId = (slide: Slide) => slide.jsonId || `slide-${slide.id}`;
const frameId = (frame: Device) => frame.jsonId || `frame-${frame.id}`;
const ornamentId = (item: Ornament) => item.jsonId || `ornament-${item.id}`;
function reference(index: ImageIndex | undefined, assets: ConfigAsset[], path: string, current?: number): ConfigAsset | null {
    if (index === undefined || index === null)
        return null;
    const resolved = index === '$current' ? current : index;
    if (resolved === undefined)
        throw new Error(`${path}: $current hanya untuk template`);
    if (!assets[resolved])
        throw new Error(`${path}: gambar index ${resolved} belum tersedia`);
    return assets[resolved];
}
function text(slide: Slide, key: 'headline' | 'subtitle', value: TextConfig) {
    if (value.content !== undefined)
        slide[key] = value.content;
    if (value.font !== undefined)
        slide[`${key}Font`] = value.font;
    if (value.size !== undefined)
        slide[`${key}FontSize`] = value.size;
    Object.assign(slide[`${key}Style`], value.style);
    for (const [field, suffix] of [['x', 'OffsetX'], ['y', 'OffsetY'], ['scale', 'Scale'], ['rotation', 'Rotation']] as const)
        if (value[field] !== undefined)
            slide[`${key}${suffix}`] = value[field]!;
}
function frame(s: EditorSession, value: FrameConfig, assets: ConfigAsset[], path: string, current?: number, existing?: Device): Device {
    const item = existing || s.createDevice();
    const { id, imageIndex, transform, ...fields } = value;
    if (id !== undefined)
        item.jsonId = id;
    Object.assign(item, fields);
    if (transform) {
        if (transform.x !== undefined) item.frameOffsetXPct = transform.x - 50;
        if (transform.y !== undefined) item.frameOffsetYPct = transform.y - 50;
        if (transform.width !== undefined) {item.frameWidthPct = transform.width;item.frameHeightPct = null;}
        if (transform.scale !== undefined) item.frameZoom = transform.scale * 100;
        if (transform.rotation !== undefined) item.frameRotation = transform.rotation;
    }
    if (imageIndex !== undefined) {
        const asset = reference(imageIndex, assets, `${path}.imageIndex`, current);
        item.image = asset?.image || null;
        item.fileName = asset?.name || '';
    }
    return item;
}
function ornamentValue(item: Ornament, imageIndex: (image: HTMLImageElement, name: string) => number | null): OrnamentConfig {
    const {x,y,width,height,rotation,opacity,layer,kind}=item;
    const base={id:ornamentId(item),kind,x,y,width,height,rotation,opacity,layer};
    if(item.kind!=='sticker') return {...base,color:item.color};
    if(item.source==='upload') return {...base,source:'upload',lockAspect:item.lockAspect,imageIndex:imageIndex(item.image,item.fileName)};
    const category=item.stickerId.split('-')[0];
    return {...base,source:'catalog',stickerId:item.stickerId,lockAspect:item.lockAspect,...(category==='emoji'?{}:{color:item.color}),...(category==='label'?{text:item.text}:{})};
}
function ornament(s: EditorSession, value: OrnamentConfig, assets: ConfigAsset[], path: string, current?: number, existing?: Ornament): Ornament {
    const candidate={...(existing?ornamentValue(existing,()=>0):{}),...value};
    if(existing && (value.kind!==undefined && (value.kind==='sticker')!==(existing.kind==='sticker') || value.source!==undefined && (existing.kind!=='sticker' || value.source!==existing.source)))
        throw new Error(`${path}: jenis dan sumber elemen tidak dapat diubah; hapus lalu tambah elemen baru`);
    validate(candidate,ornamentSchema,path);
    const {id,imageIndex,...fields}=value;
    let item: Ornament;
    if(candidate.kind==='sticker') {
        if(candidate.source==='upload') {
            const asset=imageIndex===undefined && existing?.kind==='sticker' && existing.source==='upload'?{image:existing.image,name:existing.fileName}:reference(imageIndex,assets,`${path}.imageIndex`,current);
            if(asset?.mimeType && !['image/png','image/webp'].includes(asset.mimeType))throw new Error(`${path}.imageIndex: stiker upload harus PNG atau WebP`);
            if(!asset) throw new Error(`${path}.imageIndex: stiker upload memerlukan gambar`);
            item=existing || createSticker(s,{source:'upload',image:asset.image,fileName:asset.name},fields);
            if(item.kind==='sticker' && item.source==='upload'){item.image=asset.image;item.fileName=asset.name;}
        } else {
            item=existing || createSticker(s,{source:'catalog',stickerId:candidate.stickerId!},fields);
        }
    } else item=existing || s.createOrnament(value.kind || 'circle');
    Object.assign(item,fields);
    if(id!==undefined)item.jsonId=id;
    return item;
}
function updateSlide(s: EditorSession, slide: Slide, value: SlideConfig, assets: ConfigAsset[], path: string, current?: number) {
    s.state = slide;
    if (value.id !== undefined)
        slide.jsonId = value.id;
    if (value.layout !== undefined)
        slide.layout = value.layout;
    if (value.headline)
        text(slide, 'headline', value.headline);
    if (value.subheadline)
        text(slide, 'subtitle', value.subheadline);
    if (value.background) {
        const { imageIndex, ...fields } = value.background;
        Object.assign(slide, fields);
        if (imageIndex !== undefined) {
            const asset = reference(imageIndex, assets, `${path}.background.imageIndex`, current);
            slide.patternImage = asset?.image || null;
            slide.patternFileName = asset?.name || '';
        }
    }
    if (value.frames) {
        slide.frames = value.frames.map((value, i) => frame(s, value, assets, `${path}.frames[${i}]`, current));
        slide.activeFrameId = slide.frames[0].id;
    }
    if (value.ornaments)
        slide.ornaments = value.ornaments.map((value,i) => ornament(s, value,assets,`${path}.ornaments[${i}]`,current));
}
function unique(slides: Slide[]) {
    function check(ids: string[], path: string) { const seen = new Set<string>(); for (const id of ids) {
        if (seen.has(id))
            throw new Error(`${path}: ID duplikat ${id}`);
        seen.add(id);
    } }
    check(slides.map(slideId), 'slides');
    slides.forEach((slide, i) => { check(slide.frames.map(frameId), `slides[${i}].frames`); check(slide.ornaments.map(ornamentId), `slides[${i}].ornaments`); if (slide.patternType === 'upload' && slide.backgroundType === 'pattern' && !slide.patternImage)
        throw new Error(`slides[${i}].background.imageIndex: pattern upload memerlukan gambar`); });
}
export function serializeProject(slides: Slide[]) {
    const assets: ConfigAsset[] = [];
    function imageIndex(image: HTMLImageElement | null, name: string) { if (!image)
        return null; let index = assets.findIndex(item => item.image === image); if (index < 0) {
        index = assets.length;
        assets.push({ image, name, mimeType:image.src?.match(/^data:(image\/[a-z+]+);/)?.[1] });
    } return index; }
    function textValue(slide: Slide, key: 'headline' | 'subtitle'): TextConfig { return { content: slide[key], font: slide[`${key}Font`], size: slide[`${key}FontSize`], style: { ...slide[`${key}Style`] }, x: slide[`${key}OffsetX`], y: slide[`${key}OffsetY`], scale: slide[`${key}Scale`], rotation: slide[`${key}Rotation`] }; }
    const config: Config = { version: 1, kind: 'project', preset: slides[0].preset, slides: slides.map(slide => {
            const background: Record<string, unknown> = {};
            for (const key of Object.keys(backgroundSchema.properties!))
                if (key !== 'imageIndex')
                    background[key] = slide[key as keyof Slide];
            return { id: slideId(slide), layout: slide.layout, background: { ...background, imageIndex: imageIndex(slide.patternImage, slide.patternFileName) }, headline: textValue(slide, 'headline'), subheadline: textValue(slide, 'subtitle'), frames: slide.frames.map(item => { const { id, jsonId, image, fileName, frameOffsetXPct, frameOffsetYPct, frameWidthPct, frameHeightPct, frameZoom, frameRotation, ...fields } = item;
                const p = presets[slide.preset], shape = frameGeometry(slide,item,p,frameSpecs[item.kind as keyof typeof frameSpecs]);
                return { ...fields, id: frameId(item), imageIndex: imageIndex(image, fileName),transform:{x:50+frameOffsetXPct,y:50+frameOffsetYPct,width:frameWidthPct ?? shape.w/p.w*100/(frameZoom/100),scale:frameZoom/100,rotation:frameRotation} }; }), ornaments: slide.ornaments.map(item => ornamentValue(item,imageIndex)) };
        }), assets: [] };
    config.assets = assets.map((asset, index) => ({ index, name: asset.name }));
    return { config, assets };
}
export interface PreparedConfig {
    config: Config;
    slides: Slide[];
    activeId: number;
    selectedOrnament: number | null;
    selectedText: 'headline' | 'subtitle' | null;
    activeObject: string;
    counters: {
        slideCounter: number;
        frameCounter: number;
        ornamentCounter: number;
    };
    zoom?: {
        mode: string;
        percent?: number;
    };
}
export function prepareConfig(session: EditorSession, source: string, assets: ConfigAsset[]): PreparedConfig {
    const config = parseConfig(source);
    // Constructors and all mutations operate on a detached session. Browser resources remain shared.
    const s = {} as EditorSession;
    installModel(s);
    s.defaults = { ...session.defaults };
    s.presets = session.presets;
    s.slideCounter = session.slideCounter;
    s.frameCounter = session.frameCounter;
    s.ornamentCounter = session.ornamentCounter;
    s.slides = session.slides.map(slide => session.snapshotSlide(slide));
    s.state = s.slides.find(slide => slide.id === session.state.id)!;
    s.frameSpecs = session.frameSpecs;
    s.frameSpec = session.frameSpec;
    s.activeDevice = function () { return this.state.frames.find(frame => frame.id === this.state.activeFrameId) || this.state.frames[0]; };
    s.bind = () => { };
    s.listen = () => { };
    s.render = () => { };
    s.showToast = () => { };
    s.previewPhones = [];
    s.previewImages = [];
    s.previewTextZones = [];
    installCanvas(s);
    s.selectedOrnament = session.selectedOrnament;
    s.selectedText = session.selectedText;
    s.activeObject = session.activeObject;
    let zoom: PreparedConfig['zoom'];
    if (config.kind !== 'commands') {
        if (config.kind === 'template' && !assets.length)
            throw new Error('images: template memerlukan setidaknya satu gambar');
        const values = config.kind === 'project' ? config.slides : assets.map((_, i) => ({ ...config.slide, id: `${config.slide.id || 'slide'}-${i + 1}` }));
        s.slides = values.map((value, i) => { const slide = s.createBlankSlide(); slide.preset = config.preset || 'app67'; updateSlide(s, slide, value, assets, `slides[${i}]`, config.kind === 'template' ? i : undefined); return slide; });
        s.state = s.slides[0];
        s.selectedOrnament = null;
        s.selectedText = null;
        s.activeObject = 'phone';
    }
    else {
        for (const [i, c] of config.commands.entries()) {
            const path = `commands[${i}]`;
            const slide = 'slide' in c ? s.slides.find(slide => slideId(slide) === c.slide) : s.state;
            if (!slide)
                throw new Error(`${path}.slide: ID tidak ditemukan`);
            // Applying properties on another slide must not implicitly select it.
            const previous = s.state;
            s.state = slide;
            const targetFrame = 'frame' in c ? slide.frames.find(item => frameId(item) === c.frame) : undefined;
            const targetId='ornament' in c?c.ornament:'sticker' in c?c.sticker:undefined;
            const targetOrnament=targetId?slide.ornaments.find(item=>ornamentId(item)===targetId):undefined;
            if ('frame' in c && !targetFrame)
                throw new Error(`${path}.frame: ID tidak ditemukan`);
            if (targetId && !targetOrnament)
                throw new Error(`${path}.${'sticker' in c?'sticker':'ornament'}: ID tidak ditemukan`);
            if(c.op.startsWith('sticker.') && targetOrnament?.kind!=='sticker' && c.op!=='sticker.add')throw new Error(`${path}.sticker: target harus stiker`);
            switch (c.op) {
                case 'slide.add': {
                    const added = s.createBlankSlide();
                    added.preset = previous.preset;
                    updateSlide(s, added, c.value || {}, assets, `${path}.value`);
                    s.slides.push(added);
                    s.state = added;
                    break;
                }
                case 'slide.duplicate': {
                    const copy = s.cloneSlide(slide);
                    copy.jsonId = c.id;
                    s.slides.splice(s.slides.indexOf(slide) + 1, 0, copy);
                    s.state = copy;
                    break;
                }
                case 'slide.delete':
                    if (s.slides.length === 1)
                        throw new Error(`${path}: screenshot terakhir tidak boleh dihapus`);
                    s.slides = s.slides.filter(item => item !== slide);
                    s.state = previous === slide ? s.slides[0] : previous;
                    break;
                case 'slide.select':
                    s.state = slide;
                    break;
                case 'slide.move': {
                    if (c.index >= s.slides.length)
                        throw new Error(`${path}.index: di luar daftar slide`);
                    s.slides.splice(s.slides.indexOf(slide), 1);
                    s.slides.splice(c.index, 0, slide);
                    s.state = previous;
                    break;
                }
                case 'slide.reset': {
                    const blank = s.createBlankSlide();
                    Object.assign(slide, blank, { id: slide.id, jsonId: slide.jsonId, preset: slide.preset });
                    s.state = previous;
                    break;
                }
                case 'slide.update':
                    updateSlide(s, slide, c.value, assets, `${path}.value`);
                    s.state = previous;
                    break;
                case 'frame.add': {
                    const added = frame(s, c.value, assets, `${path}.value`);
                    slide.frames.push(added);
                    slide.activeFrameId = added.id;
                    s.state = previous;
                    break;
                }
                case 'frame.duplicate': {
                    const copy = s.cloneDeviceForSlide(targetFrame!);
                    copy.jsonId = c.id;
                    slide.frames.splice(slide.frames.indexOf(targetFrame!)+1,0,copy);
                    slide.activeFrameId = copy.id;
                    s.state = previous;
                    if (slide === previous) {s.activeObject='phone';s.selectedOrnament=null;s.selectedText=null;}
                    break;
                }
                case 'frame.update':
                    frame(s, c.value, assets, `${path}.value`, undefined, targetFrame);
                    s.state = previous;
                    break;
                case 'frame.delete':
                    if (slide.frames.length === 1)
                        throw new Error(`${path}: frame terakhir tidak boleh dihapus`);
                    slide.frames = slide.frames.filter(item => item !== targetFrame);
                    if (slide.activeFrameId === targetFrame!.id)
                        slide.activeFrameId = slide.frames[0].id;
                    s.state = previous;
                    break;
                case 'frame.select':
                    slide.activeFrameId = targetFrame!.id;
                    s.activeObject = 'phone';
                    s.selectedOrnament = null;
                    s.selectedText = null;
                    break;
                case 'frame.arrange':
                    if (c.arrangement === 'cascade')
                        s.arrangeCascade(false);
                    else
                        s.arrangeSideBySide();
                    s.state = previous;
                    break;
                case 'sticker.add':
                case 'ornament.add': {
                    if(c.op==='sticker.add' && c.value.kind!=='sticker')throw new Error(`${path}.value.kind: harus sticker`);
                    const added = ornament(s, c.value,assets,`${path}.value`);
                    slide.ornaments.push(added);
                    if(slide===previous){s.selectedOrnament=added.id;s.selectedText=null;s.activeObject='ornament';}
                    s.state = previous;
                    break;
                }
                case 'sticker.update':
                case 'ornament.update':
                    ornament(s, c.value,assets,`${path}.value`,undefined,targetOrnament);
                    s.state = previous;
                    break;
                case 'sticker.duplicate':
                case 'ornament.duplicate': {
                    const copy=s.createOrnament(targetOrnament!.kind,{...targetOrnament!,x:targetOrnament!.x+2,y:targetOrnament!.y+2});
                    copy.jsonId=c.id;slide.ornaments.splice(slide.ornaments.indexOf(targetOrnament!)+1,0,copy);
                    s.state=previous;
                    if(slide===previous){s.selectedOrnament=copy.id;s.selectedText=null;s.activeObject='ornament';}
                    break;
                }
                case 'sticker.delete':
                case 'ornament.delete':
                    slide.ornaments = slide.ornaments.filter(item => item !== targetOrnament);
                    s.state = previous;
                    break;
                case 'sticker.select':
                case 'ornament.select':
                    s.selectedOrnament = targetOrnament!.id;
                    s.selectedText = null;
                    s.activeObject = 'ornament';
                    break;
                case 'sticker.move':
                case 'sticker.reorder':
                case 'ornament.reorder':
                case 'ornament.move': {
                    const items = slide.ornaments, peers = items.filter(item => item.layer === targetOrnament!.layer), next = peers[peers.indexOf(targetOrnament!) + (c.direction === 'forward' ? 1 : -1)];
                    if (next) {
                        const a = items.indexOf(targetOrnament!), b = items.indexOf(next);
                        [items[a], items[b]] = [items[b], items[a]];
                    }
                    s.state = previous;
                    break;
                }
                case 'preset':
                    s.slides.forEach(slide => slide.preset = c.value);
                    break;
                case 'zoom':
                    zoom = { mode: c.mode, percent: c.percent };
                    break;
                case 'undo':
                case 'redo':
                case 'export.active':
                case 'export.all': break;
            }
            unique(s.slides);
        }
    }
    unique(s.slides);
    if (!s.state.ornaments.some(item => item.id === s.selectedOrnament))
        s.selectedOrnament = null;
    return { config, slides: s.slides, activeId: s.state.id, selectedOrnament: s.selectedOrnament, selectedText: s.selectedText, activeObject: s.activeObject, counters: { slideCounter: s.slideCounter, frameCounter: s.frameCounter, ornamentCounter: s.ornamentCounter }, zoom };
}
export async function applyConfig(session: EditorSession, source: string, assets: ConfigAsset[]) {
    const prepared = prepareConfig(session, source, assets);
    if (session.exporting || session.pointerAction)
        throw new Error('Editor sedang mengekspor atau melakukan gesture. Coba lagi setelah selesai.');
    if (prepared.config.kind === 'commands' && prepared.config.commands.length === 1) {
        const op = prepared.config.commands[0].op;
        if (op === 'undo' || op === 'redo') {
            session.performHistory(op);
            return;
        }
        if (op === 'export.active' || op === 'export.all') {
            await session.downloadPng(op === 'export.all');
            return;
        }
    }
    const baseline = session.historySignature(session.snapshotWorkspace());
    await Promise.all(prepared.slides.map(slide => session.waitForSlideAssets(slide)));
    await Promise.all(prepared.slides.map(slide => session.ensureExportFonts(slide)));
    if (session.disposed)
        throw new Error('Editor sudah dilepas.');
    if (session.historySignature(session.snapshotWorkspace()) !== baseline)
        throw new Error('Proyek berubah saat memuat asset. Terapkan JSON kembali.');
    // User input is disabled while awaiting assets by the hook's busy flag.
    session.commitInputHistory();
    session.commitHistoryTransaction();
    const before = session.snapshotWorkspace();
    session.slides = prepared.slides;
    session.state = session.slides.find(slide => slide.id === prepared.activeId)!;
    Object.assign(session, prepared.counters);
    session.selectedOrnament = prepared.selectedOrnament;
    session.selectedText = prepared.selectedText;
    session.activeObject = prepared.activeObject;
    session.closeInlineEditor();
    session.pointerAction = null;
    session.recordWorkspaceHistory(before);
    if (prepared.zoom)
        session.setCanvasZoom(prepared.zoom.mode, prepared.zoom.percent);
    session.render();
}
