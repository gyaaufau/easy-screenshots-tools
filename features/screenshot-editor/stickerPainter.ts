import type { Sticker } from './model';
import { paintDoodle } from './stickerDoodles';
import { paintEmoji } from './stickerEmoji';
import { paintLabel } from './stickerLabels';

// Width is measured in output pixels, independent of a sticker's aspect ratio.
const BORDER_RATIO=.04;
function catalogSticker(c:CanvasRenderingContext2D,item:Extract<Sticker,{source:'catalog'}>,w:number,h:number) {
  const border=Math.min(w,h)*BORDER_RATIO;
  if(item.stickerId.startsWith('label-')){paintLabel(c,item,w,h,border);return;}
  const insetScale=1-2*BORDER_RATIO,aw=w*insetScale,ah=h*insetScale;
  const artwork=(silhouette:boolean,x=0,y=0)=>{
    c.save();c.translate(x-aw/2,y-ah/2);c.scale(aw/100,ah/100);
    if(item.stickerId.startsWith('doodle-'))paintDoodle(c,item.stickerId,silhouette?'#ffffff':item.color,silhouette);
    else paintEmoji(c,item.stickerId,silhouette);
    c.restore();
  };
  // Only the exterior artwork is repeated, never colored details or emoji features.
  // The round offsets are in output pixels so stretched stickers keep an even edge.
  artwork(true);
  for(let i=0;i<64;i++){const angle=i/64*Math.PI*2;artwork(true,Math.cos(angle)*border,Math.sin(angle)*border);}
  artwork(false);
}

// Exact squared Euclidean distance transform, linear in the number of pixels.
function distanceLine(input:Float64Array,output:Float64Array,length:number,vertices:Int32Array,edges:Float64Array) {
  let k=0;vertices[0]=0;edges[0]=-Infinity;edges[1]=Infinity;
  for(let q=1;q<length;q++){
    let intersection:number;
    do{
      const p=vertices[k];intersection=((input[q]+q*q)-(input[p]+p*p))/(2*(q-p));
      if(intersection>edges[k])break;
      k--;
    }while(k>=0);
    k++;vertices[k]=q;edges[k]=intersection!;edges[k+1]=Infinity;
  }
  k=0;
  for(let q=0;q<length;q++){
    while(edges[k+1]<q)k++;
    output[q]=(q-vertices[k])**2+input[vertices[k]];
  }
}

/** Add a solid round white contour without changing the source's colored pixels. */
export function outlineStickerPixels(data:Uint8ClampedArray,w:number,h:number,border:number):Uint8ClampedArray {
  const distances=new Float64Array(w*h),length=Math.max(w,h);
  const input=new Float64Array(length),output=new Float64Array(length),vertices=new Int32Array(length),edges=new Float64Array(length+1);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++)input[x]=data[(y*w+x)*4+3]>0?0:1e12;
    distanceLine(input,output,w,vertices,edges);
    distances.set(output.subarray(0,w),y*w);
  }
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++)input[y]=distances[y*w+x];
    distanceLine(input,output,h,vertices,edges);
    for(let y=0;y<h;y++)distances[y*w+x]=output[y];
  }
  const result=new Uint8ClampedArray(data),radiusSquared=border*border;
  for(let i=0;i<w*h;i++)if(distances[i]<=radiusSquared){
    const alpha=data[i*4+3]/255;
    for(let channel=0;channel<3;channel++)result[i*4+channel]=data[i*4+channel]*alpha+255*(1-alpha);
    result[i*4+3]=255;
  }
  return result;
}

type UploadSurface={canvas:HTMLCanvasElement;w:number;h:number;data:Uint8ClampedArray};
// Weak keys release surfaces with their session image; retain only a few aspect ratios per image.
const uploadSurfaces=new WeakMap<HTMLImageElement,Map<string,UploadSurface>>();
function uploadSurface(image:HTMLImageElement,w:number,h:number):UploadSurface|null {
  if(!image.naturalWidth || !image.naturalHeight || !(w>0 && h>0))return null;
  // One shared source surface makes the contour identical in thumbnails and full PNGs.
  const factor=1024/Math.max(w,h),cw=Math.max(1,Math.round(w*factor)),ch=Math.max(1,Math.round(h*factor));
  const key=`${cw}:${ch}`;let surfaces=uploadSurfaces.get(image);
  const cached=surfaces?.get(key);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
  const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return null;
  const border=Math.min(cw,ch)*BORDER_RATIO;
  c.drawImage(image,cw*BORDER_RATIO,ch*BORDER_RATIO,cw*(1-2*BORDER_RATIO),ch*(1-2*BORDER_RATIO));
  const data=outlineStickerPixels(c.getImageData(0,0,cw,ch).data,cw,ch,border);
  const pixels=c.createImageData(cw,ch);pixels.data.set(data);c.putImageData(pixels,0,0);
  const surface={canvas,w:cw,h:ch,data};
  if(!surfaces){surfaces=new Map();uploadSurfaces.set(image,surfaces);}
  if(surfaces.size>=4)surfaces.delete(surfaces.keys().next().value!);
  surfaces.set(key,surface);return surface;
}

// All thumbnails, previews, and exports use this painter; catalog artwork stays vector.
export function paintSticker(c:CanvasRenderingContext2D,item:Sticker,w:number,h:number) {
  if(!(w>0 && h>0))return;
  if(item.source==='upload'){
    const surface=uploadSurface(item.image,w,h);if(surface)c.drawImage(surface.canvas,-w/2,-h/2,w,h);
    return;
  }
  c.save();
  if(c.globalAlpha<1 && typeof document!=='undefined'){
    // Composite opacity once: overlapping white silhouettes must not become darker/opaque.
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w));canvas.height=Math.max(1,Math.ceil(h));
    const layer=canvas.getContext('2d');
    if(layer){layer.translate(canvas.width/2,canvas.height/2);catalogSticker(layer,item,w,h);c.drawImage(canvas,-canvas.width/2,-canvas.height/2);}
  }else catalogSticker(c,item,w,h);
  c.restore();
}

export function uploadedStickerContains(image:HTMLImageElement,u:number,v:number,w=image.naturalWidth,h=image.naturalHeight):boolean {
  if(u<0 || v<0 || u>=1 || v>=1)return false;
  const surface=uploadSurface(image,w,h);
  return !!surface && surface.data[(Math.floor(v*surface.h)*surface.w+Math.floor(u*surface.w))*4+3]>0;
}
