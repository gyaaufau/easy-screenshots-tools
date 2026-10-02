import { useEffect, useRef } from 'react';
import type { Sticker } from '../model';
import { paintSticker } from '../stickerPainter';

export function StickerThumbnail({item,label}:{item:Sticker;label:string}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let active=true;
    const draw=()=>{
      const canvas=ref.current,c=canvas?.getContext('2d');if(!canvas || !c || !active)return;
      const aspect=item.source==='upload'?item.image.naturalWidth/item.image.naturalHeight:item.width/item.height;
      const w=aspect>=1?64:64*aspect,h=aspect>=1?64/aspect:64;
      c.clearRect(0,0,144,144);c.save();c.scale(2,2);c.translate(36,36);paintSticker(c,item,w,h);c.restore();
    };
    draw();void document.fonts?.ready.then(draw);return()=>{active=false;};
  },[item]);
  return <canvas ref={ref} width={144} height={144} className="sticker-thumbnail" role="img" aria-label={label}/>;
}
