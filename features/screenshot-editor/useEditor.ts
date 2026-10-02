'use client';

import { useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import { installModel, type Slide, type Ornament, type OrnamentKind, type OrnamentPatch, type TextStyle, type TextTransformKey } from './model';
import { installHistory } from './history';
import { installCanvas, type TextZone } from './canvas';
import { installAssets, frameSpecs } from './assets';
import { installExport } from './export';
import { applyConfig, prepareConfig, serializeProject, type ConfigAsset } from './configRuntime';
import { addStickers, uploadStickerFiles } from './stickers';
import { performOrnamentCommand } from './ornaments';
import { installController } from './controller';
import type { EditorSession, EditorSnapshot } from './session';
import type { Config } from './config';

export interface ProjectSnapshot { config: Config; assets: ConfigAsset[]; signature: string; activeSlide: string; activeFrame: string; selection: unknown }

export interface EditorActions {
  event(id: string, type: string, event: SyntheticEvent): void;
  document(type: string, event: SyntheticEvent): void;
  selectSlide(id: number): void;
  editText(value: string): void;
  closeText(cancel?: boolean): void;
  ornament(command: 'add' | 'select' | 'duplicate' | 'delete' | 'forward' | 'backward', id?: number, kind?: OrnamentKind): void;
  updateOrnament(id: number, patch: OrnamentPatch): void;
  addSticker(stickerId: string): void;
  uploadStickers(files: File[]): Promise<void>;
  textStyle(key: 'headline' | 'subtitle', patch: Partial<TextStyle>, discrete?: boolean): void;
  textTransform(key: TextTransformKey, value: number): void;
  finishChange(): void;
  loadJsonImages(files: File[]): Promise<ConfigAsset[]>;
  validateJson(source: string, assets: ConfigAsset[]): void;
  applyJson(source: string, assets: ConfigAsset[], expectedSignature?: string): Promise<void>;
  getProject(): ProjectSnapshot;
  exportJson(): Promise<{source:string; assets:ConfigAsset[]}>;
  downloadJson(value: unknown, name: string): Promise<void>;
}
export interface EditorProps { snapshot: EditorSnapshot; actions: EditorActions }
type Handler = (this: any, event: any) => void;

function copySlide(slide: Slide): Slide {
  return { ...slide, ornaments: slide.ornaments.map(item => ({...item})), headlineStyle: {...slide.headlineStyle}, subtitleStyle: {...slide.subtitleStyle}, frames: slide.frames.map(device => ({ ...device })) };
}
function snapshot(session: EditorSession): EditorSnapshot {
  const p = session.presets[session.state.preset];
  return {
    selection: session.selectedOrnament != null ? {type: 'ornament', id: session.selectedOrnament} : session.selectedText ? {type: 'text', key: session.selectedText} : session.activeObject === 'phone' ? {type: 'frame', id: session.state.activeFrameId} : null,
    slide: copySlide(session.state), slides: session.slides.map(copySlide),
    device: { ...session.activeDevice() }, frameSpecs,
    canUndo: !!session.newestHistoryAction('undo'), canRedo: !!session.newestHistoryAction('redo'),
    toast: session.toast, exporting: session.exporting,
    zoomMode: session.canvasZoomMode, zoomPercent: session.canvasZoomPercent,
    inline: session.inline,
    frameWidth: session.previewPhone ? (session.previewPhone.w / p.w * 100).toFixed(1) : '',
    frameHeight: session.previewPhone ? (session.previewPhone.h / p.h * 100).toFixed(1) : '',
  };
}
function initialSnapshot(): EditorSnapshot {
  const session = {} as EditorSession;
  installModel(session);
  return { selection: {type: 'frame', id: session.state.activeFrameId}, slide: session.state, slides: session.slides, device: session.state.frames[0], frameSpecs,
    canUndo: false, canRedo: false, toast: '', exporting: false, zoomMode: 'screen', zoomPercent: 100,
    inline: null, frameWidth: '', frameHeight: '' };
}

export function useEditor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<EditorSession | null>(null);
  const handlers = useRef(new Map<string, Handler[]>());
  const busyRef = useRef(false);
  const [jsonBusy, setJsonBusy] = useState(false);
  const [view, setView] = useState<EditorSnapshot>(initialSnapshot);

  function invoke(id: string, type: string, event: Event, target?: EventTarget | null) {
    const session = sessionRef.current;
    if (!session || session.disposed || busyRef.current) return;
    for (const handler of handlers.current.get(id + ':' + type) || []) {
      handler.call(target || session.$(id), event);
    }
    session.notify();
  }

  useEffect(() => {
    const disposers: (() => void)[] = [];
    const session = { disposed: false, toast: '', exporting: false, inline: null, toastTimer: null } as EditorSession;
    handlers.current.clear();
    sessionRef.current = session;
    session.notify = () => { if (!session.disposed) setView(snapshot(session)); };
    session.bind = (id, type, handler) => {
      const key = id + ':' + type;
      handlers.current.set(key, [...(handlers.current.get(key) || []), handler]);
    };
    session.listen = (target, type, handler, options) => {
      const listener = (event: Event) => { handler.call(session, event); };
      target.addEventListener(type, listener, options);
      disposers.push(() => target.removeEventListener(type, listener, options));
    };
    session.closeInlineEditor = () => { session.inline = null; session.notify(); };
    session.openInlineEditor = (zone: TextZone) => {
      session.commitInputHistory(); session.beginInputHistory();
      const rect = session.canvas.getBoundingClientRect(), p = session.presets[session.state.preset];
      const left = Math.max(8, rect.left + (zone.cx - zone.w / 2) / p.w * rect.width);
      session.inline = {
        type: zone.type, original: session.state[zone.type as 'headline' | 'subtitle'],
        style: {
          left, top: Math.max(8, rect.top + (zone.cy - zone.h / 2) / p.h * rect.height),
          width: Math.max(120, Math.min(zone.w / p.w * rect.width, window.innerWidth - left - 8)),
          height: Math.max(40, zone.h / p.h * rect.height),
          fontFamily: session.fontFamily(zone.type === 'headline' ? session.state.headlineFont : session.state.subtitleFont),
          fontWeight: zone.type === 'headline' ? 800 : 500,
          fontSize: Math.max(14, Math.min(28, zone.h / p.h * rect.height * (zone.type === 'headline' ? .55 : .72))),
        },
      };
      session.notify();
    };
    session.showToast = (message: string) => {
      if (session.disposed) return;
      session.toast = message;
      if (session.toastTimer) clearTimeout(session.toastTimer);
      session.toastTimer = setTimeout(() => { session.toast = ''; session.notify(); }, 2200);
      session.notify();
    };
    session.renderSlideThumbnail = (slide: Slide) => {
      const target = rootRef.current?.querySelector<HTMLCanvasElement>('[data-slide-thumb="' + slide.id + '"]');
      if (!target) return;
      const p = session.presets[slide.preset];
      session.drawCanvas(target, true, { w: 52, h: Math.max(1, Math.round(52 * p.h / p.w)) }, slide);
    };
    session.renderPreviewFilmstrip = () => {
      if (session.disposed) return;
      const root = rootRef.current;
      if (!root) return;
      session.canvas = root.querySelector<HTMLCanvasElement>('#preview')!;
      if (!session.canvas) return;
      for (const slide of session.slides) {
        const target = root.querySelector<HTMLCanvasElement>('[data-preview-slide-id="' + slide.id + '"]');
        if (!target) continue;
        const p = session.presets[slide.preset];
        session.drawCanvas(target, slide.id !== session.state.id, { w: Math.round(p.w / 2), h: Math.round(p.h / 2) }, slide);
        session.renderSlideThumbnail(slide);
      }
      session.fitPreviewCanvases();
    };
    session.render = () => {
      if (session.disposed) return;
      session.notify();
      cancelAnimationFrame(session.raf);
      session.raf = requestAnimationFrame(() => {
        session.renderPreviewFilmstrip();
        // Geometry-derived dimensions update controls without recreating canvases.
        session.notify();
      });
    };
    installModel(session);
    installHistory(session);
    installAssets(session);
    installCanvas(session);
    installExport(session);
    installController(session, frameSpecs);
    session.$ = (id: string) => rootRef.current?.querySelector('[id="' + id + '"]');
    session.canvas = rootRef.current!.querySelector<HTMLCanvasElement>('#preview')!;
    session.listen(document, 'keydown', function (event: KeyboardEvent) {
      if((event.target as Element).closest?.('[data-json-panel]'))return;
      invoke('document', 'keydown', event, document);
    });
    session.listen(window, 'pointerup', () => session.commitHistoryTransaction());
    session.listen(window, 'pointercancel', () => session.commitHistoryTransaction());
    const observer = new ResizeObserver(() => session.fitPreviewCanvases());
    observer.observe(rootRef.current!.querySelector('#canvasWrap')!);
    disposers.push(() => observer.disconnect());
    session.render();
    session.ensureSelectedFonts().then(() => session.render());
    return () => {
      session.disposed = true;
      cancelAnimationFrame(session.raf);
      if (session.toastTimer) clearTimeout(session.toastTimer);
      disposers.forEach(dispose => dispose());
      session.disposeAssets?.();
      session.disposeExports?.();
      if (sessionRef.current === session) sessionRef.current = null;
      handlers.current.clear();
    };
  }, []);

  useLayoutEffect(() => { sessionRef.current?.renderPreviewFilmstrip(); }, [view]);

  const actions: EditorActions = {
    event(id, type, event) {
      const session = sessionRef.current;
      if (!session) return;
      if (type === 'change' && event.currentTarget instanceof HTMLSelectElement) {
        if (id === 'preset') session.beginWorkspaceHistory();
        else session.beginSlideHistory();
      }
      if (type === 'input') invoke('document', 'input', event.nativeEvent, document);
      invoke(id, type, event.nativeEvent, event.currentTarget);
      if (type === 'change') invoke('document', 'change', event.nativeEvent, document);
      if (['dragenter', 'dragover'].includes(type)) event.currentTarget.classList.add('drag');
      if (['dragleave', 'drop'].includes(type)) event.currentTarget.classList.remove('drag');
    },
    document(type, event) { if ((event.target as Element).closest?.('[data-json-panel]')) return; invoke('document', type, event.nativeEvent, document); },
    selectSlide(id) { sessionRef.current?.switchSlide(id); },
    editText(value) {
      const session = sessionRef.current;
      if (!session?.inline) return;
      session.state[session.inline.type] = value;
      session.render();
    },
    async loadJsonImages(files) {
      const session=sessionRef.current;if(!session || session.disposed)throw new Error('Editor belum siap.');
      return Promise.all(files.map(async file=>({name:file.name,mimeType:file.type,image:await session.readConfigImage(file)})));
    },
    validateJson(source, assets) {
      const session=sessionRef.current;if(!session)throw new Error('Editor belum siap.');
      prepareConfig(session,source,assets);
    },
    getProject() {
      const session=sessionRef.current;if(!session)throw new Error('Editor belum siap.');
      const result=serializeProject(session.slides);
      const activeSlide=session.state.jsonId || 'slide-'+session.state.id,activeFrame=session.activeDevice().jsonId || 'frame-'+session.activeDevice().id;
      const ornament=session.state.ornaments.find(item=>item.id===session.selectedOrnament);
      const selection=ornament?{type:'ornament',id:ornament.jsonId || 'ornament-'+ornament.id}:session.selectedText?{type:'text',key:session.selectedText}:session.activeObject==='phone'?{type:'frame',id:activeFrame}:null;
      return {...result,signature:session.historySignature(session.snapshotWorkspace())+':'+session.state.id+':'+session.state.activeFrameId+':'+session.selectedText+':'+session.selectedOrnament+':'+session.activeObject,activeSlide,activeFrame,selection};
    },
    async applyJson(source,assets,expectedSignature) {
      const session=sessionRef.current;if(!session || busyRef.current)throw new Error('Editor sedang memproses JSON.');
      if(expectedSignature && actions.getProject().signature!==expectedSignature)throw new Error('Canvas changed while AI was working. Please retry.');
      // Finish existing visual edits before taking the detached workspace snapshot.
      session.commitInputHistory();session.commitHistoryTransaction();
      busyRef.current=true;setJsonBusy(true);
      try {await applyConfig(session,source,assets);}
      finally {if(sessionRef.current===session){busyRef.current=false;setJsonBusy(false);}}
    },
    async exportJson() {
      const session=sessionRef.current;if(!session)throw new Error('Editor belum siap.');
      const result=serializeProject(session.slides),source=JSON.stringify(result.config,null,2);
      await session.downloadBlob(new Blob([source],{type:'application/json'}),'screenshot-project.json');
      return {source,assets:result.assets};
    },
    async downloadJson(value,name) {
      const session=sessionRef.current;if(!session)throw new Error('Editor belum siap.');
      await session.downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);
    },
    finishChange() { sessionRef.current?.commitHistoryTransaction(); },
    ornament(command, id, kind) {
      const session = sessionRef.current; if (session) performOrnamentCommand(session,command,id,kind);
    },
    addSticker(stickerId) {
      const session=sessionRef.current;if(!session || busyRef.current || session.exporting || session.pointerAction)return;
      addStickers(session,[{source:'catalog',stickerId}]);
      void session.ensureFont('Plus Jakarta Sans',800).then(()=>{if(!session.disposed)session.render();});
    },
    async uploadStickers(files) {
      const session=sessionRef.current;if(!session || busyRef.current || session.exporting || session.pointerAction)throw new Error('Editor sedang sibuk.');
      busyRef.current=true;setJsonBusy(true);
      try{await uploadStickerFiles(session,files);}finally{if(sessionRef.current===session){busyRef.current=false;setJsonBusy(false);}}
    },
    updateOrnament(id, patch) {
      const session = sessionRef.current, item = session?.state.ornaments.find(item => item.id===id);
      if (!session || !item) return;
      if (!session.inputHistoryTransaction) session.beginSlideHistory();
      Object.assign(item,patch); session.render();
    },
    textStyle(key, patch, discrete = false) {
      const session=sessionRef.current; if (!session) return;
      if (discrete) session.commitInputHistory();
      if (!session.inputHistoryTransaction) session.beginSlideHistory();
      Object.assign(session.state[`${key}Style`],patch);
      if (discrete) session.commitHistoryTransaction(); session.render();
    },
    textTransform(key, value) {
      const session=sessionRef.current; if (!session || !Number.isFinite(value)) return;
      if (!session.inputHistoryTransaction) session.beginSlideHistory();
      session.state[key]=value; session.render();
    },
    closeText(cancel = false) {
      const session = sessionRef.current;
      if (!session?.inline) return;
      if (cancel) session.state[session.inline.type] = session.inline.original;
      session.commitInputHistory(); session.closeInlineEditor(); session.render(); session.canvas.focus();
    },
  };
  return { rootRef, snapshot: view, actions, jsonBusy };
}
