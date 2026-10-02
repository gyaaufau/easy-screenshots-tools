import {path,ellipse} from './stickerPaths';

function legacyDoodle(c:CanvasRenderingContext2D,id:string,color:string,silhouette=false) {
  c.strokeStyle=color;c.fillStyle=color;c.lineWidth=7;c.lineCap='round';c.lineJoin='round';
  if(id==='doodle-heart'){
    c.beginPath();c.moveTo(50,86);c.bezierCurveTo(7,61,4,29,24,17);c.bezierCurveTo(35,10,49,22,50,32);c.bezierCurveTo(64,5,90,17,89,39);c.bezierCurveTo(89,61,66,72,50,86);c.stroke();
  }else if(id==='doodle-arrow'){
    c.beginPath();c.moveTo(8,79);c.bezierCurveTo(29,88,30,33,82,29);c.stroke();path(c,[[65,11],[88,28],[72,52]]);c.stroke();
  }else if(id==='doodle-star'){
    path(c,[[49,9],[60,35],[90,37],[67,56],[74,86],[49,70],[22,87],[30,55],[9,36],[39,34]],true);c.stroke();
  }else if(id==='doodle-circle'){
    c.beginPath();c.moveTo(75,17);c.bezierCurveTo(30,0,5,29,11,55);c.bezierCurveTo(18,94,88,95,91,49);c.bezierCurveTo(93,16,43,4,22,28);c.stroke();
  }else if(id==='doodle-lightning'){
    path(c,[[60,5],[16,56],[48,55],[35,95],[85,39],[55,40]],true);c.fill();
  }else{
    for(let i=0;i<6;i++){c.save();c.translate(50,50);c.rotate(i*Math.PI/3);ellipse(c,0,-25,13,23,color);c.restore();}
    if(silhouette)return;
    ellipse(c,50,50,14,14,'#fff8dc');ellipse(c,46,48,2,3,'#2f2430');ellipse(c,54,48,2,3,'#2f2430');
    c.strokeStyle='#2f2430';c.lineWidth=2;c.beginPath();c.arc(50,50,6,.15,Math.PI-.15);c.stroke();
  }
}

type DoodlePainter=(c:CanvasRenderingContext2D,color:string,silhouette:boolean)=>void;
function rays(c:CanvasRenderingContext2D,count:number,inner:number,outer:number) {
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2;path(c,[[50+Math.cos(a)*inner,50+Math.sin(a)*inner],[50+Math.cos(a)*outer,50+Math.sin(a)*outer]]);c.stroke();}
}
function sparkle(c:CanvasRenderingContext2D,x:number,y:number,r:number) {
  path(c,[[x,y-r],[x+r*.24,y-r*.24],[x+r,y],[x+r*.24,y+r*.24],[x,y+r],[x-r*.24,y+r*.24],[x-r,y],[x-r*.24,y-r*.24]],true);c.fill();
}
export const doodlePainters:Record<string,DoodlePainter>={
  ...Object.fromEntries(['heart','arrow','star','circle','lightning','flower'].map(id=>['doodle-'+id,((c,color,silhouette)=>legacyDoodle(c,'doodle-'+id,color,silhouette)) as DoodlePainter])),
  'doodle-arrow-curved':c=>{
    c.beginPath();c.moveTo(12,83);c.bezierCurveTo(6,28,38,9,84,26);c.stroke();path(c,[[68,10],[88,27],[71,44]]);c.stroke();
  },
  'doodle-arrow-loop':c=>{
    c.beginPath();c.moveTo(9,78);c.bezierCurveTo(42,95,85,53,58,28);c.bezierCurveTo(35,7,20,49,52,59);c.bezierCurveTo(66,63,75,35,88,21);c.stroke();path(c,[[70,22],[89,18],[91,39]]);c.stroke();
  },
  'doodle-arrow-double':c=>{path(c,[[8,50],[91,50]]);c.stroke();path(c,[[23,26],[7,50],[23,74]]);c.stroke();path(c,[[76,26],[92,50],[76,74]]);c.stroke();},
  'doodle-underline-wave':c=>{c.beginPath();c.moveTo(8,56);c.bezierCurveTo(25,12,36,92,52,51);c.bezierCurveTo(67,12,74,88,92,44);c.stroke();},
  'doodle-zigzag':c=>{path(c,[[8,73],[23,28],[39,73],[55,28],[71,73],[91,30]]);c.stroke();},
  'doodle-sparkles':c=>{sparkle(c,35,47,29);sparkle(c,76,23,14);sparkle(c,75,78,16);},
  'doodle-burst':c=>{rays(c,10,21,42);},
  'doodle-sun':(c,color,silhouette)=>{
    rays(c,8,34,43);ellipse(c,50,50,24,24,color);if(silhouette)return;
    ellipse(c,42,45,2,3,'#352337');ellipse(c,58,45,2,3,'#352337');c.strokeStyle='#352337';c.lineWidth=2;c.beginPath();c.arc(50,51,9,.15,Math.PI-.15);c.stroke();
  },
  'doodle-moon':c=>{c.beginPath();c.moveTo(70,9);c.bezierCurveTo(3,9,3,91,70,91);c.bezierCurveTo(37,70,34,36,70,9);c.fill();},
  'doodle-cloud':c=>{c.beginPath();c.moveTo(24,79);c.bezierCurveTo(-1,79,2,41,25,45);c.bezierCurveTo(23,5,73,6,73,43);c.bezierCurveTo(100,30,105,79,78,79);c.closePath();c.stroke();},
  'doodle-rainbow':c=>{c.lineWidth=6;for(const radius of [39,27,15]){c.beginPath();c.arc(50,77,radius,Math.PI,Math.PI*2);c.stroke();}path(c,[[7,84],[23,84]]);c.stroke();path(c,[[78,84],[94,84]]);c.stroke();},
  'doodle-spiral':c=>{c.lineWidth=6;c.beginPath();for(let i=0;i<=110;i++){const a=i/110*Math.PI*5,r=3+i/110*38,x=50+Math.cos(a)*r,y=50+Math.sin(a)*r;c[i?'lineTo':'moveTo'](x,y);}c.stroke();},
  'doodle-check':c=>{c.lineWidth=12;path(c,[[13,52],[38,78],[88,22]]);c.stroke();},
  'doodle-exclamation':c=>{c.lineWidth=13;path(c,[[49,12],[46,62]]);c.stroke();c.beginPath();c.arc(45,86,7,0,Math.PI*2);c.fill();},
  'doodle-question':c=>{c.lineWidth=10;c.beginPath();c.moveTo(24,29);c.bezierCurveTo(29,3,84,5,80,35);c.bezierCurveTo(78,53,49,49,48,65);c.stroke();c.beginPath();c.arc(48,86,6,0,Math.PI*2);c.fill();},
  'doodle-crown':c=>{path(c,[[19,78],[8,29],[32,49],[50,13],[68,49],[92,29],[81,78]],true);c.stroke();path(c,[[23,88],[77,88]]);c.stroke();},
  'doodle-leaf':(c,color,silhouette)=>{
    c.beginPath();c.moveTo(16,84);c.bezierCurveTo(1,32,49,11,83,12);c.bezierCurveTo(98,57,51,89,16,84);c.fill();
    c.strokeStyle=silhouette?color:'#fff8dc';c.lineWidth=3;path(c,[[13,91],[69,29]]);c.stroke();path(c,[[34,68],[28,45]]);c.stroke();path(c,[[49,51],[71,52]]);c.stroke();
  },
  'doodle-butterfly':(c,color,silhouette)=>{
    c.beginPath();c.moveTo(50,52);c.bezierCurveTo(7,-7,-1,50,26,57);c.bezierCurveTo(0,93,39,106,50,66);c.bezierCurveTo(63,104,101,93,75,57);c.bezierCurveTo(100,39,91,-4,50,52);c.fill();
    c.strokeStyle=silhouette?color:'#352337';c.lineWidth=5;path(c,[[50,40],[50,74]]);c.stroke();c.lineWidth=3;path(c,[[49,41],[39,26]]);c.stroke();path(c,[[51,41],[61,26]]);c.stroke();
  },
};
export function paintDoodle(c:CanvasRenderingContext2D,id:string,color:string,silhouette=false) {
  const painter=doodlePainters[id];if(!painter)throw new Error('Unknown doodle: '+id);
  c.strokeStyle=color;c.fillStyle=color;c.lineWidth=7;c.lineCap='round';c.lineJoin='round';painter(c,color,silhouette);
}
