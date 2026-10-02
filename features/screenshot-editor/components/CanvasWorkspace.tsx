import type { EditorProps } from '../useEditor';

export function CanvasWorkspace({ snapshot, actions }: EditorProps) {
  return (
<div className="canvas-wrap" id="canvasWrap" aria-label="Canvas semua screenshot">
        <div className="canvas-strip" id="canvasStrip" onClick={e => actions.event('canvasStrip', 'click', e)} onKeyDown={e => actions.event('canvasStrip', 'keydown', e)}>{snapshot.slides.map((slide, index) => <div key={slide.id} className={'canvas-slide' + (slide.id === snapshot.slide.id ? ' active' : '')} data-canvas-slide-id={slide.id} role="button" tabIndex={0} aria-current={slide.id === snapshot.slide.id} aria-label={'Screenshot ' + (index + 1) + (slide.id === snapshot.slide.id ? ', aktif' : ', klik untuk memilih')}><canvas id={slide.id === snapshot.slide.id ? 'preview' : undefined} className={'preview-canvas' + (slide.id === snapshot.slide.id ? '' : ' passive-preview')} data-preview-slide-id={slide.id} aria-label={'Preview screenshot ' + (index + 1)} aria-hidden={slide.id !== snapshot.slide.id} onPointerDown={e => slide.id === snapshot.slide.id && actions.event('preview', 'pointerdown', e)} onDoubleClick={e => slide.id === snapshot.slide.id && actions.event('preview', 'dblclick', e)} onDragEnter={e => actions.event('preview', 'dragenter', e)} onDragOver={e => actions.event('preview', 'dragover', e)} onDragLeave={e => actions.event('preview', 'dragleave', e)} onDrop={e => { if(slide.id !== snapshot.slide.id) actions.selectSlide(slide.id); actions.event('preview', 'drop', e); }} /></div>)}</div>
      </div>
  );
}
