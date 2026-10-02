import type { EditorProps } from '../useEditor';
export function ScreenshotControls({ snapshot, actions }: EditorProps) {
 return <>

          <button className="dropzone" id="dropzone" type="button" aria-label="Pilih atau drop screenshot aplikasi" onDragEnter={e => actions.event('dropzone', 'dragenter', e)} onClick={e => actions.event('dropzone', 'click', e)} onDragOver={e => actions.event('dropzone', 'dragover', e)} onDragLeave={e => actions.event('dropzone', 'dragleave', e)} onDrop={e => actions.event('dropzone', 'drop', e)}>
            <span className="drop-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"></path></svg>
            </span>
            <span className="drop-copy"><strong>Screenshot frame aktif</strong><span>Pilih atau drop PNG, JPG, atau WebP</span></span>
          </button>
          <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" aria-hidden="true" tabIndex={-1} onChange={e => actions.event('fileInput', 'change', e)} />
          <div className="file-name" id="fileName">{snapshot.device.fileName || 'Belum ada file untuk frame ini'}</div>
          <div className="field">
            <label htmlFor="screenshotFrame">Atur screenshot untuk frame</label>
            <select id="screenshotFrame" aria-label="Pilih frame untuk mengatur screenshot" value={snapshot.slide.activeFrameId} onChange={e => actions.event('screenshotFrame', 'change', e)}>{snapshot.slide.frames.map((device, index) => <option key={device.id} value={device.id}>{'Frame ' + (index + 1) + ' · ' + snapshot.frameSpecs[device.kind].label + (device.fileName ? ' · ' + device.fileName : ' · belum ada screenshot')}</option>)}</select>
          </div>
          <button className="clear-screenshot" id="clearScreenshot" type="button" onClick={e => actions.event('clearScreenshot', 'click', e)} disabled={!snapshot.device.image}>Hapus screenshot frame ini</button>
          <p className="frame-note">Setiap frame punya file, ukuran, dan posisi screenshot sendiri.</p>
        </>;
}

export function ScreenshotAdvancedControls({snapshot,actions}: EditorProps) { return <>
          <div className="field">
            <span className="mini-label">Penyesuaian gambar</span>
            <div className="segmented two" id="imageFitButtons" onClick={e => actions.event('imageFitButtons', 'click', e)}>
              <button type="button" data-image-fit="cover" className={'' + ((snapshot.device.imageFit) === 'cover' ? ' active' : '')}>Penuhi layar</button>
              <button type="button" data-image-fit="contain" className={snapshot.device.imageFit === "contain" ? "active" : ""}>Tampilkan utuh</button>
            </div>
          </div>
          <div className="field">
            <div className="range-head"><label htmlFor="zoom">Ukuran screenshot</label><span className="mini-label range-value" id="zoomValue">{snapshot.device.zoom + '%'}</span></div>
            <input id="zoom" type="range" min="20" max="250" value={snapshot.device.zoom} onChange={e => actions.event('zoom', 'input', e)} />
          </div>
          <div className="row">
            <div className="field">
              <div className="range-head"><label htmlFor="screenPanX">Posisi X</label><span className="mini-label range-value" id="screenPanXValue">{snapshot.device.screenPanX + '%'}</span></div>
              <input id="screenPanX" type="range" min="-100" max="100" value={snapshot.device.screenPanX} onChange={e => actions.event('screenPanX', 'input', e)} />
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="screenPanY">Posisi Y</label><span className="mini-label range-value" id="screenPanYValue">{snapshot.device.screenPanY + '%'}</span></div>
              <input id="screenPanY" type="range" min="-100" max="100" value={snapshot.device.screenPanY} onChange={e => actions.event('screenPanY', 'input', e)} />
            </div>
          </div>

</>; }
