import type { CatalogSticker } from './model';

interface LabelDesign {
  path:(c:CanvasRenderingContext2D,w:number,h:number)=>void;
  textWidth:number;
  fontSize:number;
  textY:number;
  legacy?:boolean;
}
const rounded:LabelDesign={path:(c,w,h)=>c.roundRect(-w/2,-h/2,w,h,Math.min(w,h)*.18),textWidth:.76,fontSize:.42,textY:0,legacy:true};
function normalized(draw:(c:CanvasRenderingContext2D)=>void):LabelDesign['path'] {
  return (c,w,h)=>{c.save();c.translate(-w/2,-h/2);c.scale(w/100,h/100);draw(c);c.restore();};
}
function points(c:CanvasRenderingContext2D,coordinates:number[][]){coordinates.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));c.closePath();}
function seal(c:CanvasRenderingContext2D,count:number,inner:number){
  for(let i=0;i<count*2;i++){const angle=i/(count*2)*Math.PI*2-Math.PI/2,r=i%2?inner:46;c[i?'lineTo':'moveTo'](50+Math.cos(angle)*r,50+Math.sin(angle)*r);}c.closePath();
}
export const labelDesigns:Record<string,LabelDesign>={
  ...Object.fromEntries(['wow','new','love-it','omg','try-it','so-good'].map(id=>['label-'+id,rounded])),
  'label-yay':{path:normalized(c=>seal(c,10,34)),textWidth:.55,fontSize:.3,textY:0},
  'label-cool':{path:(c,w,h)=>c.roundRect(-w/2,-h/2,w,h,Math.min(w,h)/2),textWidth:.72,fontSize:.38,textY:0},
  'label-hot':{path:normalized(c=>{
    c.moveTo(8,6);c.lineTo(92,6);c.quadraticCurveTo(96,6,96,12);c.lineTo(96,37);c.bezierCurveTo(80,37,80,63,96,63);c.lineTo(96,88);c.quadraticCurveTo(96,94,92,94);c.lineTo(8,94);c.quadraticCurveTo(4,94,4,88);c.lineTo(4,63);c.bezierCurveTo(20,63,20,37,4,37);c.lineTo(4,12);c.quadraticCurveTo(4,6,8,6);c.closePath();
  }),textWidth:.65,fontSize:.36,textY:0},
  'label-hello':{path:normalized(c=>{
    c.moveTo(18,6);c.lineTo(82,6);c.quadraticCurveTo(96,6,96,20);c.lineTo(96,63);c.quadraticCurveTo(96,77,82,77);c.lineTo(52,77);c.lineTo(29,96);c.lineTo(33,77);c.lineTo(18,77);c.quadraticCurveTo(4,77,4,63);c.lineTo(4,20);c.quadraticCurveTo(4,6,18,6);c.closePath();
  }),textWidth:.69,fontSize:.33,textY:-.09},
  'label-nice':{path:normalized(c=>{
    c.moveTo(23,85);c.bezierCurveTo(1,86,-1,50,15,43);c.bezierCurveTo(7,18,28,3,40,17);c.bezierCurveTo(48,-2,72,3,73,22);c.bezierCurveTo(94,14,105,41,88,53);c.bezierCurveTo(106,71,88,94,72,85);c.bezierCurveTo(60,105,36,96,36,85);c.closePath();
  }),textWidth:.61,fontSize:.31,textY:.04},
  'label-lets-go':{path:normalized(c=>points(c,[[4,16],[23,16],[23,7],[77,7],[77,16],[96,16],[88,50],[96,84],[77,84],[77,93],[23,93],[23,84],[4,84],[12,50]])),textWidth:.56,fontSize:.32,textY:0},
  'label-100':{path:normalized(c=>seal(c,16,40)),textWidth:.59,fontSize:.3,textY:0},
  'label-note':{path:normalized(c=>points(c,[[6,6],[76,6],[94,25],[94,94],[6,94]])),textWidth:.65,fontSize:.32,textY:.04},
};
export function paintLabel(c:CanvasRenderingContext2D,item:CatalogSticker,w:number,h:number,border:number) {
  const design=labelDesigns[item.stickerId];if(!design)throw new Error('Unknown label: '+item.stickerId);
  const shape=(color:string,width:number,height:number,x=0,y=0)=>{
    c.save();c.translate(x,y);c.beginPath();design.path(c,width,height);c.fillStyle=color;c.fill();c.restore();
  };
  if(design.legacy){
    shape('#ffffff',w,h);
    c.fillStyle=item.color;c.beginPath();c.roundRect(-w/2+border,-h/2+border,w-2*border,h-2*border,Math.max(0,Math.min(w,h)*.18-border));c.fill();
  }else{
    const aw=w*.92,ah=h*.92;shape('#ffffff',aw,ah);
    for(let i=0;i<64;i++){const angle=i/64*Math.PI*2;shape('#ffffff',aw,ah,Math.cos(angle)*border,Math.sin(angle)*border);}
    shape(item.color,aw,ah);
    if(item.stickerId==='label-note'){
      c.save();c.fillStyle='#ffffff';c.globalAlpha*=.32;c.beginPath();c.moveTo(w*.24,-h*.44);c.lineTo(w*.405,-h*.26);c.lineTo(w*.24,-h*.26);c.closePath();c.fill();c.restore();
    }
  }
  const text=item.text ?? item.stickerId.slice(6).replaceAll('-',' ').toUpperCase();
  let font=h*design.fontSize;c.font=`800 ${font}px "Plus Jakarta Sans", sans-serif`;
  font*=Math.min(1,w*design.textWidth/Math.max(1,c.measureText(text).width));c.font=`800 ${font}px "Plus Jakarta Sans", sans-serif`;
  const hex=item.color.slice(1),light=.2126*parseInt(hex.slice(0,2),16)+.7152*parseInt(hex.slice(2,4),16)+.0722*parseInt(hex.slice(4,6),16);
  c.fillStyle=light>155?'#352337':'#ffffff';c.textAlign='center';c.textBaseline='middle';c.fillText(text,0,h*design.textY);
}
