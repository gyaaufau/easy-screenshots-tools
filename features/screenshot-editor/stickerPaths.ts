export function path(c: CanvasRenderingContext2D, points: number[][], close=false) {
  c.beginPath();points.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));if(close)c.closePath();
}
export function ellipse(c: CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string) {
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
}
export function heart(c: CanvasRenderingContext2D,x:number,y:number,size:number,color:string) {
  c.save();c.translate(x,y);c.scale(size,size);c.beginPath();c.moveTo(0,.85);
  c.bezierCurveTo(-1,.2,-1,-.65,-.45,-.65);c.bezierCurveTo(-.15,-.65,0,-.4,0,-.3);
  c.bezierCurveTo(0,-.4,.15,-.65,.45,-.65);c.bezierCurveTo(1,-.65,1,.2,0,.85);
  c.fillStyle=color;c.fill();c.restore();
}
