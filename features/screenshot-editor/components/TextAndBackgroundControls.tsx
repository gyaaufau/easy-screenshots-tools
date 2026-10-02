import type { EditorProps } from '../useEditor';
import type { TextTransformKey } from '../model';
import { textPresets } from '../textStyles';
import { ControlSection } from './ControlSection';

export function TextAndBackgroundControls(props: EditorProps) {
 const {snapshot,actions}=props;
 return <ControlSection number={3} title="Teks">
  <div className="field"><span className="mini-label">Posisi teks</span>
   <div className="segmented" id="layoutButtons" onClick={e=>actions.event('layoutButtons','click',e)}>
    {(['top','left','bottom'] as const).map((value,i)=><button key={value} type="button" data-layout={value} aria-pressed={snapshot.slide.layout===value} className={snapshot.slide.layout===value?'active':''}>{['Atas','Kiri','Bawah'][i]}</button>)}
   </div>
  </div>
  <TextControls {...props} textKey="headline"/><TextControls {...props} textKey="subtitle"/>
 </ControlSection>;
}
function TextControls({snapshot,actions,textKey:key}: EditorProps & {textKey:'headline'|'subtitle'}) {
 const label=key==='headline'?'Headline':'Subheadline', style=snapshot.slide[`${key}Style`];
 return <div className="text-settings"><h3>{label}</h3>
  <div className="field"><label htmlFor={key}>Isi {label.toLowerCase()}</label>
   <textarea id={key} maxLength={key==='headline'?70:90} value={snapshot.slide[key]} onChange={e=>actions.event(key,'input',e)}/>
  </div>
  <div className="field"><label htmlFor={`${key}Font`}>Font {label.toLowerCase()}</label>
   <select id={`${key}Font`} className="font-picker" value={snapshot.slide[`${key}Font`]} style={{fontFamily:snapshot.slide[`${key}Font`]}} onChange={e=>actions.event(`${key}Font`,'change',e)}>
<optgroup label="Sans serif">
                  <option value="Archivo" style={{fontFamily: "'Archivo',sans-serif"}}>Archivo</option>
                  <option value="Inter" style={{fontFamily: "'Inter',sans-serif"}}>Inter</option>
                  <option value="Poppins" style={{fontFamily: "'Poppins',sans-serif"}}>Poppins</option>
                  <option value="Montserrat" style={{fontFamily: "'Montserrat',sans-serif"}}>Montserrat</option>
                  <option value="Nunito" style={{fontFamily: "'Nunito',sans-serif"}}>Nunito</option>
                  <option value="Roboto" style={{fontFamily: "'Roboto',sans-serif"}}>Roboto</option>
                  <option value="Open Sans" style={{fontFamily: "'Open Sans',sans-serif"}}>Open Sans</option>
                  <option value="Lato" style={{fontFamily: "'Lato',sans-serif"}}>Lato</option>
                  <option value="Raleway" style={{fontFamily: "'Raleway',sans-serif"}}>Raleway</option>
                  <option value="Work Sans" style={{fontFamily: "'Work Sans',sans-serif"}}>Work Sans</option>
                  <option value="DM Sans" style={{fontFamily: "'DM Sans',sans-serif"}}>DM Sans</option>
                  <option value="Manrope" style={{fontFamily: "'Manrope',sans-serif"}}>Manrope</option>
                  <option value="Plus Jakarta Sans" style={{fontFamily: "'Plus Jakarta Sans',sans-serif"}}>Plus Jakarta Sans</option>
                  <option value="Sora" style={{fontFamily: "'Sora',sans-serif"}}>Sora</option>
                  <option value="Space Grotesk" style={{fontFamily: "'Space Grotesk',sans-serif"}}>Space Grotesk</option>
                  <option value="Outfit" style={{fontFamily: "'Outfit',sans-serif"}}>Outfit</option>
                  <option value="Bricolage Grotesque" style={{fontFamily: "'Bricolage Grotesque',sans-serif"}}>Bricolage Grotesque</option>
                  <option value="IBM Plex Sans" style={{fontFamily: "'IBM Plex Sans',sans-serif"}}>IBM Plex Sans</option>
                  <option value="Figtree" style={{fontFamily: "'Figtree',sans-serif"}}>Figtree</option>
                  <option value="Rubik" style={{fontFamily: "'Rubik',sans-serif"}}>Rubik</option>
                  <option value="Urbanist" style={{fontFamily: "'Urbanist',sans-serif"}}>Urbanist</option>
                  <option value="Quicksand" style={{fontFamily: "'Quicksand',sans-serif"}}>Quicksand</option>
                  <option value="Comfortaa" style={{fontFamily: "'Comfortaa',sans-serif"}}>Comfortaa</option>
                </optgroup>
<optgroup label="Display">
                  <option value="Bebas Neue" style={{fontFamily: "'Bebas Neue',sans-serif"}}>Bebas Neue</option>
                  <option value="Anton" style={{fontFamily: "'Anton',sans-serif"}}>Anton</option>
                  <option value="Oswald" style={{fontFamily: "'Oswald',sans-serif"}}>Oswald</option>
                </optgroup>
<optgroup label="Serif">
                  <option value="Playfair Display" style={{fontFamily: "'Playfair Display',serif"}}>Playfair Display</option>
                  <option value="Lora" style={{fontFamily: "'Lora',serif"}}>Lora</option>
                  <option value="Merriweather" style={{fontFamily: "'Merriweather',serif"}}>Merriweather</option>
                  <option value="DM Serif Display" style={{fontFamily: "'DM Serif Display',serif"}}>DM Serif Display</option>
                </optgroup>
   </select>
  </div>
  <div className="field"><label htmlFor={`${key}FontSize`}>Ukuran {label.toLowerCase()} (px)</label>
   <input id={`${key}FontSize`} type="number" min={key==='headline'?36:16} max={key==='headline'?220:100} value={snapshot.slide[`${key}FontSize`]} onChange={e=>actions.event(`${key}FontSize`,'input',e)}/>
  </div>
  <div className="field"><span className="mini-label">Efek {label.toLowerCase()}</span>
   <div className="effect-presets">{textPresets.map(preset=><button type="button" key={preset.value} aria-pressed={style.preset===preset.value} className={style.preset===preset.value?'active':''} onClick={()=>actions.textStyle(key,{preset:preset.value},true)}>{preset.label}</button>)}</div>
  </div>
  <div className="row">
   <div className="field"><label htmlFor={`${key}Color`}>Warna teks</label><input id={`${key}Color`} type="color" value={style.color || '#ffffff'} onChange={e=>actions.textStyle(key,{color:e.target.value})} onBlur={()=>actions.finishChange()}/>
    <button type="button" className={'auto-color '+(style.color===null?'active':'')} aria-pressed={style.color===null} onClick={()=>actions.textStyle(key,{color:null},true)}>Kontras otomatis</button>
   </div>
   {style.preset!=='normal' && <div className="field"><label htmlFor={`${key}Accent`}>Warna aksen</label><input id={`${key}Accent`} type="color" value={style.accent} onChange={e=>actions.textStyle(key,{accent:e.target.value})} onBlur={()=>actions.finishChange()}/></div>}
  </div>
  <details className="advanced"><summary>Lanjutan</summary>
   {(['OffsetX','OffsetY','Scale','Rotation'] as const).map((suffix,i)=>{
    const property=`${key}${suffix}` as TextTransformKey;
    return <div className="field" key={property}><label htmlFor={property}>{['Posisi X (%)','Posisi Y (%)','Skala','Rotasi (°)'][i]}</label>
     <input id={property} type="number" min={suffix==='Scale'?.35:undefined} max={suffix==='Scale'?3:undefined} step={suffix==='Scale'?.05:1} value={Number(snapshot.slide[property].toFixed(2))} onChange={e=>{if(e.target.value!=='') actions.textTransform(property,Math.max(suffix==='Scale'?.35:-Infinity,Math.min(suffix==='Scale'?3:Infinity,Number(e.target.value))));}}/>
    </div>;
   })}
  </details>
 </div>;
}
export function BackgroundControls({snapshot,actions}: EditorProps) {
 return <ControlSection number={4} title="Background">
          <div className="field">
            <span className="mini-label">Jenis latar</span>
            <div className="segmented" id="backgroundTypeButtons" onClick={e => actions.event('backgroundTypeButtons', 'click', e)}>
              <button type="button" data-background="solid" className={'' + ((snapshot.slide.backgroundType) === 'solid' ? ' active' : '')}>Solid</button>
              <button type="button" data-background="gradient" className={snapshot.slide.backgroundType === "gradient" ? "active" : ""}>Gradient</button>
              <button type="button" data-background="pattern" className={snapshot.slide.backgroundType === "pattern" ? "active" : ""}>Pattern</button>
            </div>
          </div>
          <div className="background-panel" id="solidPanel" hidden={snapshot.slide.backgroundType !== 'solid'}>
            <span className="mini-label">Warna solid</span>
            <div className="color-row" id="swatches" style={{marginTop: '7px'}} onClick={e => actions.event('swatches', 'click', e)}>
              <button className={'swatch' + ((snapshot.slide.color) === '#f5b93f' ? ' active' : '')} type="button" data-color="#f5b93f" aria-label="Kuning"></button>
              <button className={'swatch' + ((snapshot.slide.color) === '#ef5d42' ? ' active' : '')} type="button" data-color="#ef5d42" aria-label="Merah koral"></button>
              <button className={'swatch' + ((snapshot.slide.color) === '#1d68d7' ? ' active' : '')} type="button" data-color="#1d68d7" aria-label="Biru"></button>
              <button className={'swatch' + ((snapshot.slide.color) === '#c9ef66' ? ' active' : '')} type="button" data-color="#c9ef66" aria-label="Hijau limau"></button>
              <label className="custom-color" aria-label="Pilih warna lain"><input id="customColor" type="color" value={snapshot.slide.color} onChange={e => actions.event('customColor', 'input', e)} /></label>
            </div>
          </div>
          <div className="background-panel" id="gradientPanel" hidden={snapshot.slide.backgroundType !== 'gradient'}>
            <div className="background-colors">
              <div>
                <span className="mini-label">Warna awal</span>
                <div className="background-color-control" style={{marginTop: '7px'}}>
                  <label className="background-color-chip" aria-label="Pilih warna awal gradient"><input id="gradientColor1" type="color" value={snapshot.slide.gradientColor1} onChange={e => actions.event('gradientColor1', 'input', e)} /></label>
                  <span className="background-color-value" id="gradientColor1Value">{snapshot.slide.gradientColor1}</span>
                </div>
              </div>
              <div>
                <span className="mini-label">Warna akhir</span>
                <div className="background-color-control" style={{marginTop: '7px'}}>
                  <label className="background-color-chip" aria-label="Pilih warna akhir gradient"><input id="gradientColor2" type="color" value={snapshot.slide.gradientColor2} onChange={e => actions.event('gradientColor2', 'input', e)} /></label>
                  <span className="background-color-value" id="gradientColor2Value">{snapshot.slide.gradientColor2}</span>
                </div>
              </div>
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="gradientAngle">Arah gradient</label><span className="mini-label range-value" id="gradientAngleValue">{snapshot.slide.gradientAngle + '°'}</span></div>
              <input id="gradientAngle" type="range" min="0" max="360" value={snapshot.slide.gradientAngle} onChange={e => actions.event('gradientAngle', 'input', e)} />
            </div>
          </div>
          <div className="background-panel" id="patternPanel" hidden={snapshot.slide.backgroundType !== 'pattern'}>
            <span className="mini-label">Sumber pattern</span>
            <div className="segmented pattern-options" id="patternButtons" style={{marginTop: '7px'}} onClick={e => actions.event('patternButtons', 'click', e)}>
              <button type="button" data-pattern="dots" className={'' + ((snapshot.slide.patternType) === 'dots' ? ' active' : '')}>Titik</button>
              <button type="button" data-pattern="lines" className={snapshot.slide.patternType === "lines" ? "active" : ""}>Garis</button>
              <button type="button" data-pattern="grid" className={snapshot.slide.patternType === "grid" ? "active" : ""}>Grid</button>
              <button type="button" data-pattern="upload" className={snapshot.slide.patternType === "upload" ? "active" : ""}>Upload</button>
            </div>
            <button className="pattern-upload" id="patternDropzone" type="button" onDragEnter={e => actions.event('patternDropzone', 'dragenter', e)} onClick={e => actions.event('patternDropzone', 'click', e)} onDragOver={e => actions.event('patternDropzone', 'dragover', e)} onDragLeave={e => actions.event('patternDropzone', 'dragleave', e)} onDrop={e => actions.event('patternDropzone', 'drop', e)} hidden={snapshot.slide.patternType !== 'upload'}>Pilih atau drop file pattern</button>
            <input id="patternFileInput" type="file" accept="image/png,image/jpeg,image/webp" aria-hidden="true" tabIndex={-1} onChange={e => actions.event('patternFileInput', 'change', e)} />
            <div className="pattern-file-name" id="patternFileName" hidden={snapshot.slide.patternType !== 'upload'}>{snapshot.slide.patternFileName || 'Belum ada pattern diupload'}</div>
            <div className="background-colors" style={{marginTop: '12px'}}>
              <div>
                <span className="mini-label">Warna dasar</span>
                <div className="background-color-control" style={{marginTop: '7px'}}>
                  <label className="background-color-chip" aria-label="Pilih warna dasar pattern"><input id="patternBaseColor" type="color" value={snapshot.slide.patternBaseColor} onChange={e => actions.event('patternBaseColor', 'input', e)} /></label>
                  <span className="background-color-value" id="patternBaseColorValue">{snapshot.slide.patternBaseColor}</span>
                </div>
              </div>
              <div id="patternInkControl" hidden={snapshot.slide.patternType === 'upload'}>
                <span className="mini-label">Warna motif</span>
                <div className="background-color-control" style={{marginTop: '7px'}}>
                  <label className="background-color-chip" aria-label="Pilih warna motif"><input id="patternInkColor" type="color" value={snapshot.slide.patternInkColor} onChange={e => actions.event('patternInkColor', 'input', e)} /></label>
                  <span className="background-color-value" id="patternInkColorValue">{snapshot.slide.patternInkColor}</span>
                </div>
              </div>
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="patternScale">Ukuran pattern</label><span className="mini-label range-value" id="patternScaleValue">{snapshot.slide.patternScale + '%'}</span></div>
              <input id="patternScale" type="range" min="3" max="35" value={snapshot.slide.patternScale} onChange={e => actions.event('patternScale', 'input', e)} />
            </div>
            <div className="field">
              <div className="range-head"><label htmlFor="patternOpacity">Opacity pattern</label><span className="mini-label range-value" id="patternOpacityValue">{snapshot.slide.patternOpacity + '%'}</span></div>
              <input id="patternOpacity" type="range" min="3" max="100" value={snapshot.slide.patternOpacity} onChange={e => actions.event('patternOpacity', 'input', e)} />
            </div>
          </div>
</ControlSection>;
}
