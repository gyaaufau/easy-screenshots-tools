import type { TextPreset, TextStyle } from './model';

export const textPresets: {value: TextPreset; label: string; accent: boolean}[] = [
  {value: 'normal', label: 'Normal', accent: false}, {value: 'shadow', label: 'Shadow', accent: true},
  {value: 'outline', label: 'Outline', accent: true}, {value: 'gradient', label: 'Gradient', accent: true},
  {value: 'highlight', label: 'Highlight', accent: true}, {value: 'neon', label: 'Neon', accent: true},
];

export function paintText(c: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle, fontSize: number) {
  c.save();
  const width = c.measureText(text).width;
  const left = c.textAlign === 'center' ? x-width/2 : x;
  const transform = c.getTransform(), scale = Math.hypot(transform.a, transform.b);
  if (style.color) c.fillStyle = style.color;
  if (style.preset === 'gradient') {
    const gradient = c.createLinearGradient(left,y,left+width,y+fontSize);
    gradient.addColorStop(0, String(c.fillStyle)); gradient.addColorStop(1, style.accent); c.fillStyle=gradient;
  } else if (style.preset === 'highlight') {
    const ink=c.fillStyle; c.fillStyle=style.accent;
    c.beginPath(); c.roundRect(left-fontSize*.12,y-fontSize*.05,width+fontSize*.24,fontSize*1.2,fontSize*.12); c.fill(); c.fillStyle=ink;
  } else if (style.preset === 'outline') {
    c.strokeStyle=style.accent; c.lineWidth=fontSize*.065; c.lineJoin='round'; c.strokeText(text,x,y);
  } else if (style.preset === 'shadow' || style.preset === 'neon') {
    c.shadowColor=style.accent; c.shadowBlur=fontSize*(style.preset === 'neon' ? .25 : .08)*scale;
    c.shadowOffsetX=style.preset === 'shadow' ? fontSize*(.045*transform.a + .06*transform.c) : 0;
    c.shadowOffsetY=style.preset === 'shadow' ? fontSize*(.045*transform.b + .06*transform.d) : 0;
    if (style.preset === 'neon') c.fillText(text,x,y);
  }
  c.fillText(text,x,y); c.restore();
}
