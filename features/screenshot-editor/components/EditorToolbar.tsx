import type { EditorProps } from '../useEditor';
import { presets } from '../assets';

export function EditorToolbar({ snapshot, actions }: EditorProps) {
  return (
<div className="stagebar">
        <div className="size-meta"><span className="live-dot"></span><span id="sizeLabel">{'Preview · ' + presets[snapshot.slide.preset].w + ' × ' + presets[snapshot.slide.preset].h + ' px'}</span></div>
        <div className="stage-actions">
          <div className="canvas-zoom-controls" role="group" aria-label="Zoom canvas preview">
            <button id="zoomOutBtn" type="button" aria-label="Perkecil preview" title="Zoom out" onClick={e => actions.event('zoomOutBtn', 'click', e)} disabled={snapshot.zoomMode === 'custom' && snapshot.zoomPercent <= 20}>−</button>
            <span className="canvas-zoom-value" id="canvasZoomValue">{snapshot.zoomMode === 'screen' ? 'Fit Screen' : Math.round(snapshot.zoomPercent) + '%'}</span>
            <button id="zoomInBtn" type="button" aria-label="Perbesar preview" title="Zoom in" onClick={e => actions.event('zoomInBtn', 'click', e)} disabled={snapshot.zoomMode === 'custom' && snapshot.zoomPercent >= 200}>+</button>
            <button id="fitScreenBtn" className={snapshot.zoomMode === 'screen' ? 'active' : ''} type="button" onClick={e => actions.event('fitScreenBtn', 'click', e)}>Fit Screen</button>
            <button id="actualSizeBtn" type="button" onClick={e => actions.event('actualSizeBtn', 'click', e)}>100%</button>
          </div>
          <button className="button" id="undoBtn" type="button" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo perubahan" onClick={e => actions.event('undoBtn', 'click', e)} disabled={!snapshot.canUndo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 7H4v-5M4.5 7.5A9 9 0 1 1 5 18"></path></svg>
            <span className="hide-mobile">Undo</span>
          </button>
          <button className="button" id="redoBtn" type="button" title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo perubahan" onClick={e => actions.event('redoBtn', 'click', e)} disabled={!snapshot.canRedo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 7h5v-5m-.5 5.5A9 9 0 1 0 19 18"></path></svg>
            <span className="hide-mobile">Redo</span>
          </button>
          <button className="button" id="resetBtn" type="button" title="Reset pengaturan" onClick={e => actions.event('resetBtn', 'click', e)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7v5h5M5.5 16a8 8 0 1 0 .3-8.3L4 12"></path></svg>
            <span className="hide-mobile">Reset</span>
          </button>
          <button className="button" id="downloadAllBtn" type="button" title="Download semua screenshot sebagai PNG terpisah" onClick={e => actions.event('downloadAllBtn', 'click', e)} disabled={snapshot.exporting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3h8v10H8zM5 7H3v14h12v-2M12 16l3 3 5-5"></path></svg>
            <span className="hide-mobile">Download semua</span>
          </button>
          <button className="button primary" id="downloadBtn" type="button" onClick={e => actions.event('downloadBtn', 'click', e)} disabled={snapshot.exporting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M5 19h14"></path></svg>
            Download PNG
          </button>
        </div>
      </div>
  );
}
