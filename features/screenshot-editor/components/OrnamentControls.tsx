import { useState } from 'react';
import { filterStickerCatalog, stickerDefinition, stickerResize, type StickerCategory } from '../stickers';
import type { Sticker, OrnamentPatch } from '../model';
import { StickerThumbnail } from './StickerThumbnail';
import type { EditorProps } from '../useEditor';
import { ornamentCatalog } from '../ornaments';
import { ControlSection } from './ControlSection';

export function OrnamentControls({snapshot,actions}: EditorProps) {
  const [catalog,setCatalog]=useState<'shape'|'sticker'>('shape');
  const [category,setCategory]=useState<StickerCategory>('doodle');
  const [search,setSearch]=useState('');
  const catalogResults=filterStickerCatalog(category,search);
  const [uploadError,setUploadError]=useState('');
  const [uploading,setUploading]=useState(false);
  const selected = snapshot.selection?.type === 'ornament' ? snapshot.selection.id : null;
  const ordered = ['front', 'back'].flatMap(layer => snapshot.slide.ornaments.filter(item => item.layer === layer).reverse());
  const item = snapshot.slide.ornaments.find(item => item.id === selected);
  const peers = item ? snapshot.slide.ornaments.filter(other => other.layer === item.layer) : [];
  const label=(ornament:typeof snapshot.slide.ornaments[number])=>ornament.kind==='sticker'?(ornament.source==='upload'?ornament.fileName:stickerDefinition(ornament.stickerId)?.label):ornamentCatalog.find(shape=>shape.kind===ornament.kind)?.label;
  function propertyPatch(property:'x'|'y'|'width'|'height'|'rotation',value:number):OrnamentPatch {
    if(!item)return {};
    if(item.kind==='sticker' && item.lockAspect && (property==='width' || property==='height')){
      const factor=value/item[property];return stickerResize(item.width*factor,item.height*factor,item.width,item.height);
    }
    return {[property]:value};
  }
  return <ControlSection number={5} title="Ornamen & Stiker">
    <p className="frame-note">Tambahkan dekorasi, lalu tarik, resize, atau putar di canvas.</p>
    <div className="segmented two" aria-label="Katalog dekorasi">
      {(['shape','sticker'] as const).map(value=><button type="button" key={value} aria-pressed={catalog===value} className={catalog===value?'active':''} onClick={()=>setCatalog(value)}>{value==='shape'?'Shape':'Stiker'}</button>)}
    </div>
    {catalog==='shape'?<div className="ornament-catalog">{ornamentCatalog.map(shape => <button type="button" key={shape.kind} onClick={()=>actions.ornament('add',undefined,shape.kind)}>
      <span aria-hidden="true">{shape.icon}</span>{shape.label}
    </button>)}</div>:<div className="sticker-browser">
      <div className="segmented three" aria-label="Kategori stiker">{(['doodle','emoji','label'] as const).map(value=><button type="button" key={value} className={category===value?'active':''} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value==='doodle'?'Doodle':value==='emoji'?'Emoji':'Label'}</button>)}</div>
      <div className="field"><label htmlFor="sticker-search">Cari stiker</label><input id="sticker-search" type="search" placeholder="Nama atau ID stiker…" value={search} onChange={event=>setSearch(event.target.value)} aria-describedby="sticker-result-count"/>
        <p id="sticker-result-count" className="frame-note" role="status">{catalogResults.length} stiker {category==='doodle'?'doodle':category==='emoji'?'emoji':'label'}</p>
      </div>
      {!catalogResults.length && <p className="frame-note">Tidak ada stiker yang cocok. Coba kata lain atau kategori lain.</p>}
      <div className="sticker-catalog">{catalogResults.map(entry=>{
        const thumb={id:0,kind:'sticker',source:'catalog',stickerId:entry.id,text:entry.text,x:50,y:50,width:entry.aspect,height:1,rotation:0,color:'#e84f2f',opacity:100,layer:'front',lockAspect:true} as Sticker;
        return <button type="button" key={entry.id} onClick={()=>actions.addSticker(entry.id)} aria-label={'Tambah stiker '+entry.label}><StickerThumbnail item={thumb} label={entry.label}/><span>{entry.label}</span></button>;
      })}</div>
      <div className="field"><label htmlFor="sticker-upload">Upload stiker PNG / WebP</label>
        <input id="sticker-upload" type="file" accept="image/png,image/webp" multiple disabled={uploading} onChange={async event=>{
          const files=Array.from(event.currentTarget.files || []);event.currentTarget.value='';if(!files.length)return;
          setUploading(true);setUploadError('');try{await actions.uploadStickers(files);}catch(error){setUploadError((error as Error).message);}finally{setUploading(false);}
        }}/><p className="frame-note">Transparansi dipertahankan. Bisa pilih beberapa file sekaligus.</p>
        {uploading && <p role="status">Memuat stiker…</p>}{uploadError && <p className="json-error" role="alert">{uploadError}</p>}
      </div>
    </div>}
    <div className="field"><span className="mini-label">Ornamen di screenshot ini</span>
      {!snapshot.slide.ornaments.length && <p className="frame-note">Belum ada ornamen.</p>}
      <div className="ornament-list">{ordered.map(ornament => <button type="button" key={ornament.id} aria-pressed={ornament.id === selected} className={ornament.id === selected ? 'active' : ''} onClick={()=>actions.ornament('select',ornament.id)}>
        <span className="ornament-swatch">{ornament.kind==='sticker'?<StickerThumbnail item={ornament.source==='catalog'?{...ornament,width:stickerDefinition(ornament.stickerId)!.aspect,height:1}:ornament} label={label(ornament) || 'Stiker'}/>:<span style={{background:ornament.color}}/>}</span>
        <span>{label(ornament)} <small>#{ornament.id} · {ornament.layer==='front'?'Depan':'Belakang'}</small></span>
      </button>)}</div>
    </div>
    {item && <div className="ornament-properties">
      <div className="field"><span className="mini-label">Lapisan</span><div className="segmented two">
        {(['back','front'] as const).map((layer,i)=><button type="button" key={layer} className={item.layer===layer?'active':''} aria-pressed={item.layer===layer} onClick={()=>actions.updateOrnament(item.id,{layer})}>{['Belakang','Depan'][i]}</button>)}
      </div></div>
      <div className="frame-arrange">
        <button type="button" disabled={peers[0]===item} onClick={()=>actions.ornament('backward',item.id)}>Mundur</button>
        <button type="button" disabled={peers[peers.length-1]===item} onClick={()=>actions.ornament('forward',item.id)}>Maju</button>
      </div>
      {item.kind==='sticker' && <label className="sticker-aspect"><input type="checkbox" checked={item.lockAspect} onChange={event=>{actions.updateOrnament(item.id,{lockAspect:event.target.checked});actions.finishChange();}}/> Kunci proporsi ukuran panel</label>}
      <div className="ornament-dimensions">{(['x','y','width','height','rotation'] as const).map((property,i)=><div className="field" key={property}>
        <label htmlFor={'ornament-'+property}>{['Posisi X (%)','Posisi Y (%)','Lebar (%)','Tinggi (%)','Rotasi (°)'][i]}</label>
        <input id={'ornament-'+property} type="number" step="0.5" min={property==='width'||property==='height'?.1:undefined} max={property==='width'||property==='height'?200:undefined} value={Number(item[property].toFixed(2))} onChange={event=>{
          if(event.target.value==='') return;
          const value=Number(event.target.value);
          if(Number.isFinite(value)) actions.updateOrnament(item.id,propertyPatch(property,property==='width'||property==='height'?Math.max(.1,Math.min(200,value)):value));
        }}/>
      </div>)}</div>
      {(item.kind!=='sticker' || item.source==='catalog' && !item.stickerId.startsWith('emoji-')) && <div className="field"><label htmlFor="ornament-color">Warna ornamen</label><input id="ornament-color" type="color" value={item.color} onChange={event=>actions.updateOrnament(item.id,{color:event.target.value})} onBlur={()=>actions.finishChange()}/></div>}
      {item.kind==='sticker' && item.source==='catalog' && item.stickerId.startsWith('label-') && <div className="field"><label htmlFor="sticker-text">Tulisan label</label><input id="sticker-text" type="text" maxLength={40} value={item.text || ''} onChange={event=>actions.updateOrnament(item.id,{text:event.target.value})}/></div>}
      <div className="field"><div className="range-head"><label htmlFor="ornament-opacity">Opacity</label><span className="mini-label">{item.opacity}%</span></div>
        <input id="ornament-opacity" type="range" min="0" max="100" value={item.opacity} onChange={event=>actions.updateOrnament(item.id,{opacity:Number(event.target.value)})} onBlur={()=>actions.finishChange()}/>
      </div>
      <div className="frame-arrange">
        <button type="button" onClick={()=>actions.ornament('duplicate',item.id)}>Duplikat ornamen</button>
        <button type="button" onClick={()=>actions.ornament('delete',item.id)}>Hapus ornamen</button>
      </div>
    </div>}
  </ControlSection>;
}
