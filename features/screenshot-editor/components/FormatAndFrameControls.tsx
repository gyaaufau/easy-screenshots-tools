import type { EditorProps } from '../useEditor';
import { frameNote } from '../assets';
import { ControlSection } from './ControlSection';
import { ScreenshotControls, ScreenshotAdvancedControls } from './ScreenshotControls';
export function OutputControls({snapshot,actions}: EditorProps) { return <ControlSection number={1} title="Format output">
          <div className="field">
            <label htmlFor="preset">Ukuran output</label>
            <select id="preset" value={snapshot.slide.preset} onChange={e => actions.event('preset', 'change', e)}>
              <option value="app67">App Store · 6.7″ — 1290 × 2796</option>
              <option value="app65">App Store · 6.5″ — 1242 × 2208</option>
              <option value="play">Play Store · Portrait — 1080 × 1920</option>
            </select>
          </div>
<p className="frame-note">Berlaku untuk semua screenshot dalam proyek ini.</p></ControlSection>; }
export function FormatAndFrameControls(props: EditorProps) {
 const {snapshot,actions}=props;
 return <ControlSection number={2} title="Frame & screenshot" defaultOpen>
          <div className="frame-manager">
            <div className="frame-manager-head">
              <span className="mini-label">Frame di canvas</span>
              <button className="frame-add" id="addFrame" type="button" onClick={e => actions.event('addFrame', 'click', e)}>+ Tambah frame</button>
            </div>
            <div className="frame-list" id="frameList" onClick={e => actions.event('frameList', 'click', e)}>{snapshot.slide.frames.map((device, index) => <div key={device.id} className={'frame-item' + (device.id === snapshot.slide.activeFrameId ? ' active' : '')}><button type="button" className="frame-select" data-frame-id={device.id} aria-pressed={device.id === snapshot.slide.activeFrameId}>{'Frame ' + (index + 1) + ' · ' + snapshot.frameSpecs[device.kind].label + (device.fileName ? ' · ' + device.fileName : '')}</button><button type="button" className="frame-remove" data-remove-frame-id={device.id} disabled={snapshot.slide.frames.length === 1} aria-label={'Hapus frame ' + (index + 1)}>×</button></div>)}</div>
            <div className="frame-arrange" aria-label="Susun posisi frame">
              <button id="arrangeCascade" type="button" onClick={e => actions.event('arrangeCascade', 'click', e)}>Susun cascade</button>
              <button id="arrangeSideBySide" type="button" onClick={e => actions.event('arrangeSideBySide', 'click', e)}>Susun berdampingan</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="frame">Model mockup</label>
            <select id="frame" value={snapshot.device.kind} onChange={e => actions.event('frame', 'change', e)}>
              <option value="iphone-14-dark">iPhone 14 · Dark</option>
              <option value="iphone-14-plus-dark">iPhone 14 Plus · Dark</option>
              <option value="iphone-14-pro-dark">iPhone 14 Pro · Dark</option>
              <option value="iphone-14-pro-max-dark">iPhone 14 Pro Max · Dark</option>
            </select>
            <p className="frame-note" id="frameVariantNote" aria-live="polite">{frameNote(snapshot.frameSpecs[snapshot.device.kind])}</p>
          </div>
<ScreenshotControls {...props}/>
<details className="advanced"><summary>Lanjutan</summary>
<ScreenshotAdvancedControls {...props}/>
          <div className="field">
            <div className="range-head"><label htmlFor="frameZoom">Zoom frame</label><span className="mini-label range-value" id="frameZoomValue">{snapshot.device.frameZoom + '%'}</span></div>
            <input id="frameZoom" type="range" min="35" max="170" value={snapshot.device.frameZoom} onChange={e => actions.event('frameZoom', 'input', e)} />
          </div>
          <div className="field">
            <div className="range-head"><label htmlFor="frameRotate">Rotasi frame</label><span className="mini-label range-value" id="frameRotateValue">{Math.round(snapshot.device.frameRotation) + '°'}</span></div>
            <input id="frameRotate" type="range" min="-180" max="180" value={Math.round(snapshot.device.frameRotation)} onChange={e => actions.event('frameRotate', 'input', e)} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="frameWidth">Lebar</label>
              <div className="number-wrap"><input id="frameWidth" type="number" min="12" max="140" step="0.1" inputMode="decimal" value={snapshot.frameWidth} onChange={e => actions.event('frameWidth', 'input', e)} /><span>%</span></div>
            </div>
            <div className="field">
              <label htmlFor="frameHeight">Tinggi</label>
              <div className="number-wrap"><input id="frameHeight" type="number" min="12" max="180" step="0.1" inputMode="decimal" value={snapshot.frameHeight} onChange={e => actions.event('frameHeight', 'input', e)} /><span>%</span></div>
            </div>
          </div>
          <div className="field">
            <span className="mini-label">Drop shadow frame aktif</span>
            <div className="segmented two" id="shadowToggle" onClick={e => actions.event('shadowToggle', 'click', e)}>
              <button type="button" data-shadow="off" className={!snapshot.device.shadowEnabled ? "active" : ""}>Mati</button>
              <button type="button" data-shadow="on" className={'' + ((snapshot.device.shadowEnabled ? 'on' : 'off') === 'on' ? ' active' : '')}>Aktif</button>
            </div>
          </div>
          <div className={'shadow-settings' + (snapshot.device.shadowEnabled ? '' : ' disabled')} id="shadowSettings">
            <div className="field">
              <label htmlFor="shadowColor">Warna shadow</label>
              <div className="shadow-color-control">
                <label className="shadow-color-chip" aria-label="Pilih warna shadow"><input id="shadowColor" type="color" value={snapshot.device.shadowColor} onChange={e => actions.event('shadowColor', 'input', e)} /></label>
                <span className="shadow-color-value" id="shadowColorValue">{snapshot.device.shadowColor}</span>
              </div>
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="shadowOpacity">Opacity</label><span className="mini-label range-value" id="shadowOpacityValue">{snapshot.device.shadowOpacity + '%'}</span></div>
              <input id="shadowOpacity" type="range" min="0" max="100" value={snapshot.device.shadowOpacity} onChange={e => actions.event('shadowOpacity', 'input', e)} />
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="shadowBlur">Blur</label><span className="mini-label range-value" id="shadowBlurValue">{snapshot.device.shadowBlur + '%'}</span></div>
              <input id="shadowBlur" type="range" min="0" max="40" step="0.5" value={snapshot.device.shadowBlur} onChange={e => actions.event('shadowBlur', 'input', e)} />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="shadowOffsetX">Offset X</label>
                <div className="number-wrap"><input id="shadowOffsetX" type="number" min="-50" max="50" step="0.5" inputMode="decimal" value={snapshot.device.shadowOffsetX} onChange={e => actions.event('shadowOffsetX', 'input', e)} /><span>%</span></div>
              </div>
              <div className="field">
                <label htmlFor="shadowOffsetY">Offset Y</label>
                <div className="number-wrap"><input id="shadowOffsetY" type="number" min="-50" max="50" step="0.5" inputMode="decimal" value={snapshot.device.shadowOffsetY} onChange={e => actions.event('shadowOffsetY', 'input', e)} /><span>%</span></div>
              </div>
            </div>
          </div>
</details>
<p className="frame-note">Klik frame untuk memilih. Tarik untuk memindahkan, titik sudut untuk resize, dan handle bulat untuk rotasi.</p>
</ControlSection>; }
