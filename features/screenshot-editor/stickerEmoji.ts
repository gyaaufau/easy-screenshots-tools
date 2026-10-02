import {path,ellipse,heart} from './stickerPaths';

function legacyEmoji(c:CanvasRenderingContext2D,id:string,silhouette=false) {
  const ink='#352337';c.lineCap='round';c.lineJoin='round';c.strokeStyle=ink;c.lineWidth=5;
  if(id==='emoji-fire'){
    c.fillStyle=silhouette?'#ffffff':'#f46637';c.beginPath();c.moveTo(49,4);c.bezierCurveTo(43,35,19,35,13,59);c.bezierCurveTo(0,105,96,107,89,61);c.bezierCurveTo(86,43,79,34,67,26);c.bezierCurveTo(67,47,53,34,49,4);c.fill();
    if(silhouette)return;
    c.fillStyle='#ffdc66';c.beginPath();c.moveTo(51,42);c.bezierCurveTo(43,58,29,61,32,80);c.bezierCurveTo(37,98,75,98,70,78);c.bezierCurveTo(67,61,59,54,51,42);c.fill();return;
  }
  if(id==='emoji-eyes'){
    ellipse(c,28,50,21,38,'#ffffff');c.strokeStyle=silhouette?'#ffffff':ink;c.lineWidth=3;c.beginPath();c.ellipse(28,50,21,38,0,0,Math.PI*2);c.stroke();
    ellipse(c,73,50,21,38,'#ffffff');c.beginPath();c.ellipse(73,50,21,38,0,0,Math.PI*2);c.stroke();
    if(silhouette)return;
    ellipse(c,20,53,9,16,ink);ellipse(c,65,53,9,16,ink);ellipse(c,18,48,3,4,'#ffffff');ellipse(c,63,48,3,4,'#ffffff');return;
  }
  ellipse(c,50,50,44,44,silhouette?'#ffffff':'#ffce54');c.strokeStyle=silhouette?'#ffffff':'#e8a439';c.lineWidth=3;c.beginPath();c.arc(50,50,44,0,Math.PI*2);c.stroke();
  if(silhouette){
    if(id==='emoji-laugh'){ellipse(c,13,60,6,12,'#ffffff');ellipse(c,87,60,6,12,'#ffffff');}
    return;
  }
  c.strokeStyle=ink;c.lineWidth=5;
  if(id==='emoji-heart-eyes'){heart(c,32,37,14,'#ec4872');heart(c,68,37,14,'#ec4872');}
  else if(id==='emoji-cool'){
    c.fillStyle=ink;c.beginPath();c.roundRect(15,28,31,24,6);c.roundRect(54,28,31,24,6);c.fill();path(c,[[11,31],[89,31]]);c.stroke();
    c.strokeStyle='#a7e2ef';c.lineWidth=3;path(c,[[22,33],[31,33]]);c.stroke();path(c,[[61,33],[70,33]]);c.stroke();c.strokeStyle=ink;
  }else if(id==='emoji-laugh'){
    path(c,[[21,43],[32,32],[42,43]]);c.stroke();path(c,[[58,43],[68,32],[79,43]]);c.stroke();
    ellipse(c,13,60,6,12,'#6ebfee');ellipse(c,87,60,6,12,'#6ebfee');
  }else {ellipse(c,33,37,4,7,ink);ellipse(c,67,37,4,7,ink);}
  c.fillStyle=ink;c.beginPath();c.moveTo(25,58);c.bezierCurveTo(31,86,70,86,76,58);c.closePath();c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.moveTo(29,59);c.lineTo(72,59);c.quadraticCurveTo(50,70,29,59);c.fill();
  ellipse(c,50,76,12,4,'#f6778b');
}


const ink='#352337';
const palette={yellow:'#ffce54',pink:'#ff78aa',blue:'#6ebfee',green:'#9bda8c',orange:'#ff8f57',purple:'#a898ef'};
type EmojiPainter=(c:CanvasRenderingContext2D,silhouette:boolean)=>void;
function face(c:CanvasRenderingContext2D,silhouette:boolean) {
  ellipse(c,50,50,44,44,silhouette?'#ffffff':palette.yellow);
  c.strokeStyle=silhouette?'#ffffff':'#e8a439';c.lineWidth=3;c.beginPath();c.arc(50,50,44,0,Math.PI*2);c.stroke();c.strokeStyle=ink;c.fillStyle=ink;c.lineWidth=4;
}
function eyes(c:CanvasRenderingContext2D){ellipse(c,33,39,4,7,ink);ellipse(c,67,39,4,7,ink);}
function smile(c:CanvasRenderingContext2D){c.strokeStyle=ink;c.lineWidth=4;c.beginPath();c.arc(50,53,20,.15,Math.PI-.15);c.stroke();}
function hand(c:CanvasRenderingContext2D,silhouette:boolean,peace:boolean) {
  c.fillStyle=silhouette?'#ffffff':'#ffdc8c';c.strokeStyle=silhouette?'#ffffff':ink;c.lineWidth=2.5;c.beginPath();
  if(peace){
    c.moveTo(27,56);c.lineTo(21,14);c.bezierCurveTo(20,1,35,1,37,14);c.lineTo(44,46);c.lineTo(54,12);c.bezierCurveTo(58,0,74,5,70,18);c.lineTo(61,51);c.bezierCurveTo(82,43,91,62,78,80);c.bezierCurveTo(77,100,31,99,24,80);c.bezierCurveTo(14,69,13,51,27,56);
  }else{
    c.moveTo(28,45);c.bezierCurveTo(43,32,40,16,46,7);c.bezierCurveTo(59,-4,66,18,60,36);c.lineTo(80,36);c.bezierCurveTo(99,38,87,63,82,82);c.bezierCurveTo(79,98,41,93,28,83);c.closePath();
  }
  c.fill();c.stroke();
  c.beginPath();c.roundRect(9,48,19,40,5);c.fillStyle=silhouette?'#ffffff':palette.blue;c.fill();
  if(silhouette)return;
  c.strokeStyle=ink;c.lineWidth=2;
  if(peace){c.beginPath();c.moveTo(34,62);c.bezierCurveTo(42,48,60,49,64,61);c.bezierCurveTo(62,70,42,68,36,63);c.stroke();path(c,[[46,68],[43,81]]);c.stroke();}
  else for(const y of [47,59,71]){path(c,[[64,y],[83,y]]);c.stroke();}
}
export const emojiPainters:Record<string,EmojiPainter>={
  ...Object.fromEntries(['smile','laugh','heart-eyes','cool','fire','eyes'].map(id=>['emoji-'+id,((c,silhouette)=>legacyEmoji(c,'emoji-'+id,silhouette)) as EmojiPainter])),
  'emoji-wink':(c,silhouette)=>{face(c,silhouette);if(silhouette)return;ellipse(c,33,38,4,7,ink);c.beginPath();c.arc(67,40,9,Math.PI+.1,Math.PI*2-.1);c.stroke();smile(c);ellipse(c,27,57,8,4,palette.pink);},
  'emoji-kiss':(c,silhouette)=>{face(c,silhouette);if(silhouette)return;eyes(c);path(c,[[45,58],[57,63],[45,68]]);c.stroke();heart(c,77,65,13,palette.pink);},
  'emoji-party':(c,silhouette)=>{
    ellipse(c,50,60,33,33,silhouette?'#ffffff':palette.yellow);
    path(c,[[22,34],[45,7],[67,39]],true);c.fillStyle=silhouette?'#ffffff':palette.purple;c.fill();
    for(const [x,y,color]of [[12,17,palette.pink],[82,15,palette.blue],[90,44,palette.green]] as const)ellipse(c,x,y,4,4,silhouette?'#ffffff':color);
    if(silhouette){path(c,[[62,72],[93,80],[89,87],[61,78]],true);c.fillStyle='#ffffff';c.fill();return;}
    c.strokeStyle=palette.pink;c.lineWidth=4;path(c,[[34,23],[51,30]]);c.stroke();path(c,[[42,15],[53,20]]);c.stroke();
    c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.arc(38,55,6,Math.PI,Math.PI*2);c.stroke();c.beginPath();c.arc(62,55,6,Math.PI,Math.PI*2);c.stroke();
    c.fillStyle=ink;c.beginPath();c.arc(50,65,13,0,Math.PI);c.fill();
    path(c,[[62,72],[93,80],[89,87],[61,78]],true);c.fillStyle=palette.orange;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();
  },
  'emoji-happy-cry':(c,silhouette)=>{
    face(c,silhouette);for(const x of [22,78])ellipse(c,x,65,8,23,silhouette?'#ffffff':palette.blue);if(silhouette)return;
    c.strokeStyle=ink;c.lineWidth=4;for(const x of [33,67]){c.beginPath();c.arc(x,42,10,Math.PI,Math.PI*2);c.stroke();}
    c.fillStyle=ink;c.beginPath();c.arc(50,58,17,0,Math.PI);c.fill();ellipse(c,50,71,9,4,palette.pink);
  },
  'emoji-shocked':(c,silhouette)=>{face(c,silhouette);if(silhouette)return;eyes(c);ellipse(c,50,67,10,14,ink);path(c,[[23,25],[39,23]]);c.stroke();path(c,[[61,23],[77,25]]);c.stroke();},
  'emoji-thinking':(c,silhouette)=>{
    face(c,silhouette);ellipse(c,67,77,17,12,silhouette?'#ffffff':'#ffdc8c');if(silhouette)return;
    eyes(c);path(c,[[24,24],[39,29]]);c.stroke();path(c,[[61,27],[77,22]]);c.stroke();path(c,[[40,64],[58,62]]);c.stroke();
    c.fillStyle='#ffdc8c';c.beginPath();c.roundRect(61,56,10,28,5);c.fill();c.strokeStyle=ink;c.lineWidth=2;path(c,[[66,59],[66,77],[78,77]]);c.stroke();
  },
  'emoji-thumbs-up':(c,silhouette)=>hand(c,silhouette,false),
  'emoji-peace':(c,silhouette)=>hand(c,silhouette,true),
  'emoji-rocket':(c,silhouette)=>{
    path(c,[[35,69],[32,84],[50,96],[68,84],[65,69]],true);c.fillStyle=silhouette?'#ffffff':palette.orange;c.fill();
    path(c,[[29,48],[12,66],[12,83],[33,73]],true);c.fillStyle=silhouette?'#ffffff':palette.pink;c.fill();path(c,[[71,48],[88,66],[88,83],[67,73]],true);c.fill();
    c.beginPath();c.moveTo(50,5);c.bezierCurveTo(23,23,23,49,29,74);c.lineTo(71,74);c.bezierCurveTo(77,49,77,23,50,5);c.fillStyle=silhouette?'#ffffff':palette.blue;c.fill();
    if(silhouette)return;
    c.beginPath();c.moveTo(50,5);c.quadraticCurveTo(34,16,31,29);c.lineTo(69,29);c.quadraticCurveTo(66,16,50,5);c.fillStyle=palette.pink;c.fill();
    ellipse(c,50,44,13,13,ink);ellipse(c,50,44,9,9,palette.purple);ellipse(c,47,41,3,3,'#ffffff');
    path(c,[[44,77],[50,90],[56,77]],true);c.fillStyle=palette.yellow;c.fill();
  },
  'emoji-planet':(c,silhouette)=>{
    c.save();c.translate(50,50);c.rotate(-.35);c.strokeStyle=silhouette?'#ffffff':palette.blue;c.lineWidth=9;c.beginPath();c.ellipse(0,0,43,19,0,0,Math.PI*2);c.stroke();c.restore();
    ellipse(c,50,50,27,37,silhouette?'#ffffff':palette.purple);if(silhouette)return;
    c.save();c.translate(50,50);c.rotate(-.35);c.strokeStyle=palette.pink;c.lineWidth=8;c.beginPath();c.ellipse(0,0,43,19,0,Math.PI*.08,Math.PI*.95);c.stroke();c.restore();
    ellipse(c,41,31,6,8,'#c7bcff');ellipse(c,64,58,4,6,'#8875dd');
  },
};
export function paintEmoji(c:CanvasRenderingContext2D,id:string,silhouette=false) {
  const painter=emojiPainters[id];if(!painter)throw new Error('Unknown emoji: '+id);
  c.lineCap='round';c.lineJoin='round';c.strokeStyle=ink;c.fillStyle=ink;c.lineWidth=4;painter(c,silhouette);
}
