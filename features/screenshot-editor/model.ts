export type ShapeKind = 'circle' | 'rectangle' | 'line' | 'arrow' | 'star' | 'sparkle' | 'blob';
export type OrnamentKind = ShapeKind | 'sticker';
export type TextPreset = 'normal' | 'shadow' | 'outline' | 'gradient' | 'highlight' | 'neon';
export interface TextStyle { preset: TextPreset; color: string | null; accent: string }
export interface OrnamentBase {
    jsonId?: string; id: number; x: number; y: number; width: number; height: number;
    rotation: number; color: string; opacity: number; layer: 'back' | 'front';
}
export interface ShapeOrnament extends OrnamentBase { kind: ShapeKind }
export interface CatalogSticker extends OrnamentBase {
    kind: 'sticker'; source: 'catalog'; stickerId: string; text?: string; lockAspect: boolean;
}
export interface UploadSticker extends OrnamentBase {
    kind: 'sticker'; source: 'upload'; image: HTMLImageElement; fileName: string; lockAspect: boolean;
}
export type Sticker = CatalogSticker | UploadSticker;
export type Ornament = ShapeOrnament | Sticker;
export type OrnamentPatch = Partial<OrnamentBase & {source: 'catalog' | 'upload'; stickerId: string; text: string; lockAspect: boolean; image: HTMLImageElement; fileName: string}>;
export type ElementSelection = { type: 'frame'; id: number } | { type: 'text'; key: 'headline' | 'subtitle' } | { type: 'ornament'; id: number } | null;
export type TextTransformKey = `${'headline' | 'subtitle'}${'OffsetX' | 'OffsetY' | 'Scale' | 'Rotation'}`;
export interface EditorSettings {
    headlineStyle: TextStyle;
    subtitleStyle: TextStyle;
    preset: string;
    frame: string;
    layout: string;
    color: string;
    backgroundType: string;
    gradientColor1: string;
    gradientColor2: string;
    gradientAngle: number;
    patternType: string;
    patternBaseColor: string;
    patternInkColor: string;
    patternScale: number;
    patternOpacity: number;
    patternImage: HTMLImageElement | null;
    patternFileName: string;
    headlineOffsetX: number;
    headlineOffsetY: number;
    headlineScale: number;
    headlineRotation: number;
    subtitleOffsetX: number;
    subtitleOffsetY: number;
    subtitleScale: number;
    subtitleRotation: number;
    headline: string;
    headlineFont: string;
    headlineFontSize: number;
    subtitle: string;
    subtitleFont: string;
    subtitleFontSize: number;
    zoom: number;
    imageFit: string;
    screenPanX: number;
    screenPanY: number;
    imageOffsetXPct: number | null;
    imageOffsetYPct: number | null;
    imageWidthPct: number | null;
    imageHeightPct: number | null;
    imageRotation: number;
    frameZoom: number;
    frameRotation: number;
    frameWidthPct: number | null;
    frameHeightPct: number | null;
    frameOffsetXPct: number;
    frameOffsetYPct: number;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowOpacity: number;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
}
export interface Device extends Pick<EditorSettings, 'zoom' | 'imageFit' | 'screenPanX' | 'screenPanY' | 'imageOffsetXPct' | 'imageOffsetYPct' | 'imageWidthPct' | 'imageHeightPct' | 'imageRotation' | 'frameZoom' | 'frameRotation' | 'frameWidthPct' | 'frameHeightPct' | 'frameOffsetXPct' | 'frameOffsetYPct' | 'shadowEnabled' | 'shadowColor' | 'shadowOpacity' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY'> {
    jsonId?: string;
    id: number;
    kind: string;
    image: HTMLImageElement | null;
    fileName: string;
}
export interface Slide extends EditorSettings {
    jsonId?: string;
    id: number;
    ornaments: Ornament[];
    frames: Device[];
    activeFrameId: number;
}
import type { EditorSession } from './session';
export const presets: Record<string, {
    w: number;
    h: number;
    name: string;
}> = {
    app67: { w: 1290, h: 2796, name: 'app-store-6-7' },
    app65: { w: 1242, h: 2208, name: 'app-store-6-5' },
    play: { w: 1080, h: 1920, name: 'play-store-portrait' }
};
export function installModel(session: EditorSession) {
    session.presets = presets;
    session.defaults = {
        headlineStyle: { preset: 'normal', color: null, accent: '#f5b93f' },
        subtitleStyle: { preset: 'normal', color: null, accent: '#f5b93f' },
        preset: 'app67', frame: 'iphone-14-pro-dark', layout: 'top', color: '#ef5d42',
        backgroundType: 'solid', gradientColor1: '#ef5d42', gradientColor2: '#f5b93f', gradientAngle: 135,
        patternType: 'dots', patternBaseColor: '#ef5d42', patternInkColor: '#ffffff', patternScale: 10,
        patternOpacity: 24, patternImage: null, patternFileName: '',
        headlineOffsetX: 0, headlineOffsetY: 0, headlineScale: 1, headlineRotation: 0,
        subtitleOffsetX: 0, subtitleOffsetY: 0, subtitleScale: 1, subtitleRotation: 0,
        headline: 'Lorem ipsum dolor sit amet', headlineFont: 'Archivo', headlineFontSize: 110,
        subtitle: 'Consectetur adipiscing elit, sed do eiusmod tempor incididunt.', subtitleFont: 'IBM Plex Sans', subtitleFontSize: 40, zoom: 100,
        imageFit: 'cover', screenPanX: 0, screenPanY: 0,
        imageOffsetXPct: null, imageOffsetYPct: null, imageWidthPct: null, imageHeightPct: null, imageRotation: 0,
        frameZoom: 100, frameRotation: 0, frameWidthPct: null, frameHeightPct: null,
        frameOffsetXPct: 0, frameOffsetYPct: 0, shadowEnabled: true, shadowColor: '#000000',
        shadowOpacity: 32, shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 3.5
    };
    function freshJsonId(prefix: 'slide' | 'frame' | 'ornament', numericId: number): string {
        const slides = session.slides || [];
        const items: {id:number;jsonId?:string}[] = prefix === 'slide' ? slides : prefix === 'frame' ? slides.flatMap(slide => slide.frames) : slides.flatMap(slide => slide.ornaments);
        const used = new Set(items.map(item => item.jsonId || `${prefix}-${item.id}`));
        let candidate = `${prefix}-${numericId}`;
        while (used.has(candidate)) candidate += '-new';
        return candidate;
    }
    session.ornamentCounter = 0;
    session.createOrnament = (kind, copy) => ({
        kind, x: 50, y: 50, width: 20,
        height: (kind === 'line' ? 2 : kind === 'arrow' ? 8 : 20) * session.presets[session.state.preset].w / session.presets[session.state.preset].h,
        rotation: 0, color: '#e84f2f', opacity: 100, layer: 'front', ...copy, id: ++session.ornamentCounter, jsonId: freshJsonId('ornament',session.ornamentCounter),
    } as Ornament);
    session.frameCounter = 0;
    session.createDevice = function (copy?: Device): Device {
        session.frameCounter += 1;
        return {
            id: session.frameCounter,
            jsonId: freshJsonId('frame',session.frameCounter),
            kind: copy ? copy.kind : session.defaults.frame,
            image: null,
            fileName: '',
            zoom: copy ? copy.zoom : session.defaults.zoom,
            imageFit: copy ? copy.imageFit : session.defaults.imageFit,
            screenPanX: copy ? copy.screenPanX : session.defaults.screenPanX,
            screenPanY: copy ? copy.screenPanY : session.defaults.screenPanY,
            imageOffsetXPct: session.defaults.imageOffsetXPct,
            imageOffsetYPct: session.defaults.imageOffsetYPct,
            imageWidthPct: session.defaults.imageWidthPct,
            imageHeightPct: session.defaults.imageHeightPct,
            imageRotation: session.defaults.imageRotation,
            frameZoom: copy ? copy.frameZoom : session.defaults.frameZoom,
            frameRotation: copy ? copy.frameRotation : session.defaults.frameRotation,
            frameWidthPct: copy ? copy.frameWidthPct : session.defaults.frameWidthPct,
            frameHeightPct: copy ? copy.frameHeightPct : session.defaults.frameHeightPct,
            frameOffsetXPct: copy ? copy.frameOffsetXPct : session.defaults.frameOffsetXPct,
            frameOffsetYPct: copy ? copy.frameOffsetYPct : session.defaults.frameOffsetYPct,
            shadowEnabled: copy ? copy.shadowEnabled : session.defaults.shadowEnabled,
            shadowColor: copy ? copy.shadowColor : session.defaults.shadowColor,
            shadowOpacity: copy ? copy.shadowOpacity : session.defaults.shadowOpacity,
            shadowBlur: copy ? copy.shadowBlur : session.defaults.shadowBlur,
            shadowOffsetX: copy ? copy.shadowOffsetX : session.defaults.shadowOffsetX,
            shadowOffsetY: copy ? copy.shadowOffsetY : session.defaults.shadowOffsetY
        };
    };
    session.slideCounter = 0;
    session.createBlankSlide = function (): Slide {
        let firstDevice = session.createDevice();
        session.slideCounter += 1;
        return Object.assign({}, session.defaults, { id: session.slideCounter, jsonId: freshJsonId('slide',session.slideCounter), ornaments: [], headlineStyle: {...session.defaults.headlineStyle}, subtitleStyle: {...session.defaults.subtitleStyle}, frames: [firstDevice], activeFrameId: firstDevice.id });
    };
    session.cloneDeviceForSlide = function (source: Device): Device {
        let clone: Device = Object.assign({}, source);
        session.frameCounter += 1;
        clone.id = session.frameCounter;
        clone.jsonId = freshJsonId('frame',clone.id);
        return clone;
    };
    session.cloneSlide = function (source: Slide): Slide {
        session.slideCounter += 1;
        let cloned: Slide = Object.assign({}, source, { id: session.slideCounter });
        cloned.jsonId = freshJsonId('slide',cloned.id);
        cloned.headlineStyle = {...source.headlineStyle};
        cloned.subtitleStyle = {...source.subtitleStyle};
        cloned.ornaments = source.ornaments.map(item => ({...item, id: ++session.ornamentCounter, jsonId: freshJsonId('ornament',session.ornamentCounter)}));
        cloned.frames = source.frames.map(session.cloneDeviceForSlide);
        let activeIndex = source.frames.findIndex(function (device: Device) { return device.id === source.activeFrameId; });
        cloned.activeFrameId = cloned.frames[Math.max(0, activeIndex)].id;
        return cloned;
    };
    session.state = session.createBlankSlide();
    session.slides = [session.state];
}
