import type { EditorProps } from '../useEditor';

export function SlideManager({ snapshot, actions }: EditorProps) {
  return (
<section className="slide-manager" aria-label="Daftar screenshot">
        <div className="slide-manager-head">
          <strong>Screenshot</strong>
          <span className="slide-count" id="slideCount">{snapshot.slides.length + ' screenshot'}</span>
        </div>
        <div className="slide-strip" id="slideStrip" aria-label="Pilih screenshot aktif" onClick={e => actions.event('slideStrip', 'click', e)}>{snapshot.slides.map((slide, index) => <button key={slide.id} type="button" className={'slide-card' + (slide.id === snapshot.slide.id ? ' active' : '')} data-slide-id={slide.id} aria-pressed={slide.id === snapshot.slide.id} aria-label={'Screenshot ' + (index + 1) + (slide.id === snapshot.slide.id ? ', aktif' : '')}><span className="slide-thumb-wrap"><canvas className="slide-thumb" data-slide-thumb={slide.id} aria-hidden="true" /></span><span>Screenshot {String(index + 1).padStart(2, '0')}</span></button>)}</div>
        <div className="slide-actions">
          <button id="addSlide" type="button" onClick={e => actions.event('addSlide', 'click', e)}>+ Baru</button>
          <button id="duplicateSlide" type="button" onClick={e => actions.event('duplicateSlide', 'click', e)}>Duplikat</button>
          <button id="moveSlideLeft" type="button" aria-label="Geser screenshot ke kiri" onClick={e => actions.event('moveSlideLeft', 'click', e)} disabled={snapshot.slides[0].id === snapshot.slide.id}>←</button>
          <button id="moveSlideRight" type="button" aria-label="Geser screenshot ke kanan" onClick={e => actions.event('moveSlideRight', 'click', e)} disabled={snapshot.slides.at(-1)?.id === snapshot.slide.id}>→</button>
          <button id="deleteSlide" type="button" aria-label="Hapus screenshot aktif" onClick={e => actions.event('deleteSlide', 'click', e)} disabled={snapshot.slides.length === 1}>×</button>
        </div>
      </section>
  );
}
