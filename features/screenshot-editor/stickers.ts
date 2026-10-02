import type { OrnamentPatch, Sticker } from './model';
import type { EditorSession } from './session';

export type StickerCategory = 'doodle' | 'emoji' | 'label';
export interface StickerDefinition { id: string; label: string; category: StickerCategory; aspect: number; text?: string }
export const stickerCatalog: StickerDefinition[] = [
  {id:'doodle-heart',label:'Hati coretan',category:'doodle',aspect:1},
  {id:'doodle-arrow',label:'Panah coretan',category:'doodle',aspect:1.5},
  {id:'doodle-star',label:'Bintang coretan',category:'doodle',aspect:1},
  {id:'doodle-circle',label:'Lingkaran coretan',category:'doodle',aspect:1.3},
  {id:'doodle-lightning',label:'Petir',category:'doodle',aspect:.65},
  {id:'doodle-flower',label:'Bunga',category:'doodle',aspect:1},
  {id:'emoji-smile',label:'Senyum',category:'emoji',aspect:1},
  {id:'emoji-laugh',label:'Tertawa',category:'emoji',aspect:1},
  {id:'emoji-heart-eyes',label:'Mata hati',category:'emoji',aspect:1},
  {id:'emoji-cool',label:'Kacamata hitam',category:'emoji',aspect:1},
  {id:'emoji-fire',label:'Api',category:'emoji',aspect:.8},
  {id:'emoji-eyes',label:'Mata mengintip',category:'emoji',aspect:1.4},
  ...['WOW','NEW','LOVE IT','OMG','TRY IT','SO GOOD'].map(text=>({id:'label-'+text.toLowerCase().replaceAll(' ','-'),label:text,category:'label' as const,aspect:2.5,text})),
  {id:'doodle-arrow-curved',label:'Panah melengkung',category:'doodle',aspect:1.2},
  {id:'doodle-arrow-loop',label:'Panah loop',category:'doodle',aspect:1.4},
  {id:'doodle-arrow-double',label:'Panah dua arah',category:'doodle',aspect:1.8},
  {id:'doodle-underline-wave',label:'Underline bergelombang',category:'doodle',aspect:2.8},
  {id:'doodle-zigzag',label:'Zigzag',category:'doodle',aspect:1.8},
  {id:'doodle-sparkles',label:'Kumpulan sparkle',category:'doodle',aspect:1.2},
  {id:'doodle-burst',label:'Burst',category:'doodle',aspect:1},
  {id:'doodle-sun',label:'Matahari',category:'doodle',aspect:1},
  {id:'doodle-moon',label:'Bulan sabit',category:'doodle',aspect:0.8},
  {id:'doodle-cloud',label:'Awan',category:'doodle',aspect:1.5},
  {id:'doodle-rainbow',label:'Pelangi',category:'doodle',aspect:1.3},
  {id:'doodle-spiral',label:'Spiral',category:'doodle',aspect:1},
  {id:'doodle-check',label:'Centang',category:'doodle',aspect:1.2},
  {id:'doodle-exclamation',label:'Tanda seru',category:'doodle',aspect:0.5},
  {id:'doodle-question',label:'Tanda tanya',category:'doodle',aspect:0.65},
  {id:'doodle-crown',label:'Mahkota',category:'doodle',aspect:1.4},
  {id:'doodle-leaf',label:'Daun',category:'doodle',aspect:0.8},
  {id:'doodle-butterfly',label:'Kupu-kupu',category:'doodle',aspect:1.2},
  {id:'emoji-wink',label:'Kedip',category:'emoji',aspect:1},
  {id:'emoji-kiss',label:'Cium',category:'emoji',aspect:1},
  {id:'emoji-party',label:'Pesta',category:'emoji',aspect:1},
  {id:'emoji-happy-cry',label:'Menangis bahagia',category:'emoji',aspect:1},
  {id:'emoji-shocked',label:'Terkejut',category:'emoji',aspect:1},
  {id:'emoji-thinking',label:'Berpikir',category:'emoji',aspect:1},
  {id:'emoji-thumbs-up',label:'Jempol',category:'emoji',aspect:0.8},
  {id:'emoji-peace',label:'Tangan peace',category:'emoji',aspect:0.75},
  {id:'emoji-rocket',label:'Roket',category:'emoji',aspect:0.75},
  {id:'emoji-planet',label:'Planet bercincin',category:'emoji',aspect:1.5},
  {id:'label-yay',label:'YAY!',category:'label',aspect:1.4,text:'YAY!'},
  {id:'label-cool',label:'COOL',category:'label',aspect:2.4,text:'COOL'},
  {id:'label-hot',label:'HOT',category:'label',aspect:1.8,text:'HOT'},
  {id:'label-hello',label:'HELLO',category:'label',aspect:1.6,text:'HELLO'},
  {id:'label-nice',label:'NICE!',category:'label',aspect:1.7,text:'NICE!'},
  {id:'label-lets-go',label:'LET’S GO',category:'label',aspect:2.5,text:'LET’S GO'},
  {id:'label-100',label:'100%',category:'label',aspect:1,text:'100%'},
  {id:'label-note',label:'NOTE',category:'label',aspect:1.1,text:'NOTE'},
];
export function filterStickerCatalog(category:StickerCategory,query:string) {
  const search=query.trim().toLocaleLowerCase();
  return stickerCatalog.filter(item=>item.category===category && (!search || `${item.label} ${item.id} ${item.text ?? ''}`.toLocaleLowerCase().includes(search)));
}
export const stickerDefinition = (id: string) => stickerCatalog.find(item=>item.id===id);
export function createSticker(session: EditorSession, source: {source:'catalog';stickerId:string} | {source:'upload';image:HTMLImageElement;fileName:string}, patch: OrnamentPatch = {}): Sticker {
  const definition=source.source==='catalog'?stickerDefinition(source.stickerId):undefined;
  const aspect=source.source==='upload'?source.image.naturalWidth/source.image.naturalHeight:definition!.aspect;
  const p=session.presets[session.state.preset];
  const width=patch.width ?? (patch.height!==undefined?patch.height*p.h/p.w*aspect:20);
  const height=patch.height ?? width*p.w/p.h/aspect;
  return session.createOrnament('sticker',{...source,text:definition?.text,lockAspect:true,...patch,width,height}) as Sticker;
}

// Resize from the gesture's original geometry, so aspect stays stable throughout the drag.
export function stickerResize(width: number, height: number, originalWidth: number, originalHeight: number) {
  const factor=Math.max(.1/originalWidth,.1/originalHeight,Math.min(200/originalWidth,200/originalHeight,Math.max(width/originalWidth,height/originalHeight)));
  return {width:originalWidth*factor,height:originalHeight*factor};
}

export function addStickers(session: EditorSession, sources: Parameters<typeof createSticker>[1][]) {
  if(!sources.length)return;
  session.commitInputHistory();session.beginSlideHistory();
  const items=sources.map(source=>createSticker(session,source));session.state.ornaments.push(...items);
  session.selectedOrnament=items.at(-1)!.id;session.selectedText=null;session.activeObject='ornament';
  session.commitHistoryTransaction();session.render();
}
export async function uploadStickerFiles(session: EditorSession, files: File[]) {
  if(!files.length)return;
  session.commitInputHistory();session.commitHistoryTransaction();
  const before=session.historySignature(session.snapshotWorkspace());
  const sources=await Promise.all(files.map(async file=>({source:'upload' as const,image:await session.readStickerImage(file),fileName:file.name})));
  if(session.disposed)throw new Error('Editor sudah dilepas.');
  if(session.historySignature(session.snapshotWorkspace())!==before)throw new Error('Proyek berubah saat memuat stiker. Upload kembali.');
  addStickers(session,sources);
}
