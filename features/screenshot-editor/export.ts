import type { Slide } from './model';
import type { EditorSession } from './session';

export function installExport(session: EditorSession) {
  const pendingDownloads = new Set<() => void>();
  session.disposeExports = () => { for (const cancel of pendingDownloads) cancel(); };

  session.canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('png-encode')), 'image/png');
    } catch (error) { reject(error); }
  });

  session.renderSlideBlob = async (slide: Slide): Promise<Blob> => {
    await Promise.all([session.ensureExportFonts(slide), session.waitForSlideAssets(slide)]);
    if (session.disposed) throw new Error('editor-disposed');
    const p = session.presets[slide.preset], output = document.createElement('canvas');
    session.drawCanvas(output, true, { w: p.w, h: p.h }, slide);
    if (output.width !== p.w || output.height !== p.h) throw new Error('wrong-export-size');
    return session.canvasBlob(output);
  };

  session.downloadBlob = (blob: Blob, name: string): Promise<void> => new Promise((resolve, reject) => {
    if (session.disposed) { reject(new Error('editor-disposed')); return; }
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.rel = 'noopener'; anchor.style.display = 'none';
    document.body.appendChild(anchor);
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer); anchor.remove(); URL.revokeObjectURL(url); pendingDownloads.delete(cancel);
    };
    const cancel = () => { cleanup(); reject(new Error('editor-disposed')); };
    pendingDownloads.add(cancel);
    try {
      anchor.click();
      timer = setTimeout(() => { cleanup(); resolve(); }, 450);
    } catch (error) { cleanup(); reject(error); }
  });

  async function download(all: boolean, propagateError = false) {
    if (session.exporting || session.disposed) return;
    session.commitInputHistory(); session.commitHistoryTransaction();
    const slides = all ? [...session.slides] : [session.state];
    const activeIndex = session.activeSlideIndex();
    session.exporting = true; session.notify();
    try {
      session.showToast('Menyiapkan PNG resolusi penuh…');
      if (all) await Promise.all(slides.map(slide => session.waitForSlideAssets(slide)));
      for (let index = 0; index < slides.length; index++) {
        if (session.disposed) throw new Error('editor-disposed');
        if (all) session.showToast('Menyiapkan PNG ' + (index + 1) + ' dari ' + slides.length + '…');
        const blob = await session.renderSlideBlob(slides[index]);
        const number = (all ? index : activeIndex) + 1;
        await session.downloadBlob(blob, 'screenshot-' + String(number).padStart(2, '0') + '.png');
        if (all) await session.wait(250);
      }
      session.showToast(all ? slides.length + ' PNG berhasil diunduh.' : 'Screenshot aktif berhasil diunduh.');
    } catch (error) {
      if (!session.disposed) console.error('PNG export failed', error);
      session.showToast(all ? 'Ekspor terhenti. Pastikan mockup, font, dan gambar sudah termuat.' : 'Ekspor gagal. Pastikan mockup, font, dan gambar sudah termuat.');
      if (propagateError) throw new Error('Ekspor PNG gagal: ' + (error as Error).message);
    } finally { session.exporting = false; session.notify(); }
  }
  session.downloadPng = all => download(all,true);
  session.bind('downloadBtn', 'click', () => { void download(false); });
  session.bind('downloadAllBtn', 'click', () => { void download(true); });
}
