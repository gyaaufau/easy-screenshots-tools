import { paintSticker, uploadedStickerContains } from './stickerPainter';
import type { Ornament, OrnamentKind } from './model';
import type { CanvasShape, Dimensions, Point } from './canvas';

export const ornamentCatalog: {kind: OrnamentKind; label: string; icon: string}[] = [
  {kind: 'circle', label: 'Lingkaran', icon: '●'},
  {kind: 'rectangle', label: 'Rounded rectangle', icon: '▰'},
  {kind: 'line', label: 'Garis', icon: '━'},
  {kind: 'arrow', label: 'Panah', icon: '➜'},
  {kind: 'star', label: 'Bintang', icon: '★'},
  {kind: 'sparkle', label: 'Sparkle', icon: '✦'},
  {kind: 'blob', label: 'Blob', icon: '〰'},
];

export function ornamentShape(item: Ornament, output: Dimensions): CanvasShape {
  const w = item.width / 100 * output.w, h = item.height / 100 * output.h;
  const cx = item.x / 100 * output.w, cy = item.y / 100 * output.h;
  return {cx, cy, w, h, rotation: item.rotation * Math.PI / 180};
}

function polygon(kind: OrnamentKind): Point[] {
  if (kind === 'arrow') return [[-1,-.3],[.25,-.3],[.25,-1],[1,0],[.25,1],[.25,.3],[-1,.3]].map(([x,y]) => ({x,y}));
  const count = kind === 'star' ? 10 : kind === 'sparkle' ? 8 : 64;
  return Array.from({length: count}, (_, i) => {
    const angle = i / count * Math.PI * 2 - Math.PI / 2;
    const radius = kind === 'blob' ? .84 + .1 * Math.sin(angle * 3 + .6) + .06 * Math.cos(angle * 5) : i % 2 ? (kind === 'star' ? .44 : .22) : 1;
    return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius};
  });
}

export function drawOrnament(c: CanvasRenderingContext2D, item: Ornament, output: Dimensions) {
  const shape = ornamentShape(item, output);
  c.save(); c.translate(shape.cx, shape.cy); c.rotate(shape.rotation);
  c.globalAlpha = item.opacity / 100; c.fillStyle = item.color;
  if(item.kind==='sticker'){paintSticker(c,item,shape.w,shape.h);c.restore();return;}
  c.beginPath();
  if (item.kind === 'circle') c.ellipse(0,0,shape.w/2,shape.h/2,0,0,Math.PI*2);
  else if (item.kind === 'rectangle' || item.kind === 'line') c.roundRect(-shape.w/2,-shape.h/2,shape.w,shape.h, Math.min(shape.w,shape.h) * (item.kind === 'line' ? .5 : .18));
  else {
    polygon(item.kind).forEach((point, i) => c[i ? 'lineTo' : 'moveTo'](point.x * shape.w/2, point.y * shape.h/2));
    c.closePath();
  }
  c.fill(); c.restore();
}

export function ornamentContains(item: Ornament, point: Point, output: Dimensions): boolean {
  if (item.opacity === 0) return false;
  const shape = ornamentShape(item, output), dx = point.x - shape.cx, dy = point.y - shape.cy;
  const x = (dx * Math.cos(shape.rotation) + dy * Math.sin(shape.rotation)) / (shape.w/2);
  const y = (-dx * Math.sin(shape.rotation) + dy * Math.cos(shape.rotation)) / (shape.h/2);
  if(item.kind==='sticker')return item.source==='upload'?uploadedStickerContains(item.image,(x+1)/2,(y+1)/2,shape.w,shape.h):Math.abs(x)<=1 && Math.abs(y)<=1;
  if (item.kind === 'circle') return x*x + y*y <= 1;
  if (item.kind === 'rectangle' || item.kind === 'line') {
    const radius = Math.min(shape.w,shape.h) * (item.kind === 'line' ? .5 : .18);
    const lx = Math.abs(x * shape.w/2), ly = Math.abs(y * shape.h/2);
    if (lx > shape.w/2 || ly > shape.h/2) return false;
    return Math.hypot(Math.max(0,lx-(shape.w/2-radius)),Math.max(0,ly-(shape.h/2-radius))) <= radius;
  }
  const points = polygon(item.kind);
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

export function ornamentHitAt(items: Ornament[], layer: Ornament['layer'], point: Point, output: Dimensions) {
  return [...items].reverse().find(item => item.layer === layer && ornamentContains(item,point,output)) || null;
}


// This order is also the renderer's order, reversed for picking.
export function canvasHitAt(session: import('./session').EditorSession, point: Point) {
  const output = session.presets[session.state.preset];
  const front = ornamentHitAt(session.state.ornaments,'front',point,output);
  if (front) return {type: 'ornament' as const, item: front};
  const frame = session.phoneHitAt(point);
  if (frame) return {type: 'frame' as const, item: frame};
  const image = session.imageHitAt(point);
  if (image) return {type: 'image' as const, item: image};
  const text = session.textZoneAt(point);
  if (text) return {type: 'text' as const, item: text};
  const back = ornamentHitAt(session.state.ornaments,'back',point,output);
  return back ? {type: 'ornament' as const, item: back} : null;
}

export function performOrnamentCommand(session: import('./session').EditorSession, command: 'add' | 'select' | 'duplicate' | 'delete' | 'forward' | 'backward', id?: number, kind?: OrnamentKind) {
  const item = session.state.ornaments.find(item => item.id === id);
  if (command !== 'select') { session.commitInputHistory(); session.beginSlideHistory(); }
  if (command === 'add') {
    const added = session.createOrnament(kind!); session.state.ornaments.push(added); session.selectedOrnament = added.id;
  } else if (command === 'select' && item) session.selectedOrnament = item.id;
  else if (command === 'duplicate' && item) {
    const copy = session.createOrnament(item.kind, {...item, x:item.x+2, y:item.y+2});
    session.state.ornaments.splice(session.state.ornaments.indexOf(item)+1,0,copy); session.selectedOrnament=copy.id;
  } else if (command === 'delete' && item) {
    session.state.ornaments = session.state.ornaments.filter(other => other.id !== item.id); session.selectedOrnament=null;
  } else if (item) {
    const peers = session.state.ornaments.filter(other => other.layer === item.layer), index = peers.indexOf(item);
    const other = peers[index + (command === 'forward' ? 1 : -1)];
    if (other) {
      const items = session.state.ornaments, a=items.indexOf(item),b=items.indexOf(other);
      [items[a],items[b]]=[items[b],items[a]];
    }
  }
  session.selectedText=null; session.activeObject=session.selectedOrnament == null ? 'none' : 'ornament';
  if (command !== 'select') session.commitHistoryTransaction();
  session.render();
}
