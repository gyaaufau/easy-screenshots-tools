export function visionSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Image has invalid dimensions.');
  const scale = Math.min(1,1600/width,1600/height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
const cache = new WeakMap<HTMLImageElement,Promise<string>>();
export function compressForVision(image: HTMLImageElement): Promise<string> {
  const cached = cache.get(image); if (cached) return cached;
  const result = Promise.resolve().then(() => {
    const canvas = document.createElement('canvas'), size = visionSize(image.naturalWidth,image.naturalHeight);
    canvas.width=size.width;canvas.height=size.height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image compression unavailable. Try another browser.');
    ctx.drawImage(image,0,0,size.width,size.height);
    let data=canvas.toDataURL('image/webp',0.8);
    if (!data.startsWith('data:image/webp;')) data=canvas.toDataURL('image/png');
    if (!/^data:image\/(webp|png);base64,/.test(data) || data.length>6_000_000) throw new Error('Could not compress this image. Try a smaller screenshot.');
    return data;
  }).catch(error=>{cache.delete(image);throw error;});
  cache.set(image,result);return result;
}
