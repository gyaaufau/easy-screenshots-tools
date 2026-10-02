import metadata from './frame-specs.json';
import type { Slide } from './model';
import type { EditorSession, FrameSpec } from './session';
export { presets } from './model';
export const frameSpecs: Record<string, FrameSpec> = metadata;
export interface MockupAssets {
  image: HTMLImageElement; mask: HTMLImageElement; surface: HTMLCanvasElement;
  status: 'loading' | 'ready' | 'error'; promise: Promise<MockupAssets>;
}
export function frameNote(spec: FrameSpec) {
  return (spec.description || '') + (spec.physicalH ? ' · ' + spec.physicalH + ' × ' + spec.physicalW + ' mm · layar ' + spec.screenW + ' × ' + spec.screenH + ' px' : '');
}

export function installAssets(session: EditorSession) {
  const pending = new Set<() => void>();
  session.mockupCache = {};
  session.disposeAssets = () => { for (const cancel of [...pending]) cancel(); pending.clear(); };
  session.frameSpec = (kind: string): FrameSpec => session.frameSpecs[kind] || session.frameSpecs['iphone-14-pro-dark'];

  session.waitForImage = (image: HTMLImageElement | null): Promise<void> => {
    if (!image) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return image.decode ? image.decode() : Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer); image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
        pending.delete(cancel);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('image-load')); };
      const cancel = () => { cleanup(); reject(new Error('editor-disposed')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('image-timeout')); }, 12000);
      pending.add(cancel);
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', failed, { once: true });
    });
  };
  session.mockupAssets = (kind: string): MockupAssets => {
    const spec = session.frameSpec(kind), key = spec.src;
    if (session.mockupCache[key]) return session.mockupCache[key];
    const assets = { image: new Image(), mask: new Image(), surface: document.createElement('canvas'), status: 'loading' } as MockupAssets;
    session.mockupCache[key] = assets;
    assets.image.src = spec.src; assets.mask.src = spec.maskSrc;
    assets.promise = Promise.all([session.waitForImage(assets.image), session.waitForImage(assets.mask)]).then(() => {
      if (!session.disposed) { assets.status = 'ready'; session.render(); }
      return assets;
    });
    void assets.promise.catch(() => {
      if (session.disposed) return;
      assets.status = 'error'; session.render();
      session.showToast('Mockup gagal dimuat. Muat ulang halaman sebelum ekspor.');
    });
    return assets;
  };

  session.ensureFont = (name: string, weight: number): Promise<FontFace[]> => {
    if (!document.fonts?.load) return Promise.resolve([]);
    return document.fonts.load(String(weight) + ' 48px ' + session.fontFamily(name), 'Store screenshot').catch(() => []);
  };
  session.ensureSelectedFonts = () => Promise.all([
    session.ensureFont(session.state.headlineFont, 800), session.ensureFont(session.state.subtitleFont, 500),
  ]);
  session.ensureExportFonts = async (slide: Slide) => {
    if (!document.fonts?.load) return;
    await Promise.all([session.ensureFont(slide.headlineFont, 800), session.ensureFont(slide.subtitleFont, 500), ...(slide.ornaments.some(item=>item.kind==='sticker' && item.source==='catalog' && item.stickerId.startsWith('label-'))?[session.ensureFont('Plus Jakarta Sans',800)]:[])]);
    await document.fonts.ready;
  };
  session.waitForSlideAssets = (slide: Slide) => Promise.all([
    ...slide.frames.flatMap(device => [session.mockupAssets(device.kind).promise, session.waitForImage(device.image)]),
    session.waitForImage(slide.patternImage),
    ...slide.ornaments.filter(item=>item.kind==='sticker' && item.source==='upload').map(item=>session.waitForImage(item.kind==='sticker' && item.source==='upload'?item.image:null)),
  ]);
  session.wait = (ms: number): Promise<void> => new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); pending.delete(cancel); reject(new Error('editor-disposed')); };
    const timer = setTimeout(() => { pending.delete(cancel); resolve(); }, ms);
    pending.add(cancel);
  });

  function readImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const cancel = () => { reader.onload = null; reader.onerror = null; reader.abort(); reject(new Error('editor-disposed')); };
      pending.add(cancel);
      reader.onerror = () => { pending.delete(cancel); reject(new Error('file-read')); };
      reader.onload = async () => {
        pending.delete(cancel);
        const image = new Image(); image.src = String(reader.result);
        try { await session.waitForImage(image); resolve(image); } catch (error) { reject(error); }
      };
      reader.readAsDataURL(file);
    });
  }
  session.readStickerImage = (file: File) => {
    if(!/^image\/(png|webp)$/.test(file.type))return Promise.reject(new Error(file.name+': pilih PNG atau WebP'));
    return readImage(file).catch(error=>{throw new Error(file.name+': '+(error as Error).message);});
  };
  session.readConfigImage = (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return Promise.reject(new Error(file.name + ': pilih PNG, JPG, atau WebP'));
    return readImage(file).catch(error => { throw new Error(file.name + ': ' + (error as Error).message); });
  };
  session.readFile = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { session.showToast('Format belum didukung. Pilih PNG, JPG, atau WebP.'); return; }
    const slide = session.state, device = session.activeDevice(), before = session.snapshotSlide(slide);
    try {
      const image = await readImage(file);
      if (session.disposed) return;
      device.image = image; device.fileName = file.name; device.screenPanX = 0; device.screenPanY = 0;
      session.recordSlideHistory(slide, before);
      if (session.state === slide) { session.activeObject = 'phone'; session.selectedText = null; }
      session.render();
    } catch { session.showToast('Gambar tidak bisa dibaca.'); }
  };
  session.readPatternFile = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { session.showToast('Pattern harus berupa PNG, JPG, atau WebP.'); return; }
    const slide = session.state, before = session.snapshotSlide(slide);
    try {
      const image = await readImage(file);
      if (session.disposed) return;
      slide.patternImage = image; slide.patternFileName = file.name; slide.patternType = 'upload';
      session.recordSlideHistory(slide, before); session.render(); session.showToast('Pattern berhasil dimuat.');
    } catch { session.showToast('File pattern tidak bisa dibaca.'); }
  };
}
