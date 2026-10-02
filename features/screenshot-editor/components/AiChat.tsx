'use client';
import { useEffect, useRef, useState } from 'react';
import type { EditorProps } from '../useEditor';
import type { ConfigAsset } from '../configRuntime';
import { compressForVision } from '../aiImages';
import { normalizeConfig, validateReply, type AiReply, type AiModels, type Phase, type Recommendation } from '../ai';

interface Upload { id: number; asset: ConfigAsset; dataUrl: string }
interface Message { role: 'user' | 'assistant'; content: string }
export function AiChat({actions,snapshot,busy}: EditorProps & {busy:boolean}) {
  const [uploads,setUploads]=useState<Upload[]>([]),[messages,setMessages]=useState<Message[]>([]);
  const [recommendation,setRecommendation]=useState<Recommendation|null>(null),[generated,setGenerated]=useState(false);
  const [prompt,setPrompt]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [direction,setDirection]=useState(false);
  const [models,setModels]=useState<AiModels>({vision:'gpt-4o-mini',design:'deepseek-v4.1-flash:netra'});
  const [errorDetail,setErrorDetail]=useState(''),[errorCode,setErrorCode]=useState('');
  const [retry,setRetry]=useState<{phase:Phase;text:string;history:Message[]}|null>(null);
  const requestRef=useRef<AbortController|null>(null),generation=useRef(0),nextId=useRef(0),locked=useRef(false);
  const latest=useRef(actions);latest.current=actions;
  const log=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>{generation.current++;requestRef.current?.abort();},[]);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/ai/chat',{signal:controller.signal}).then(r=>r.json()).then(data=>{if(data.models)setModels(data.models);}).catch(()=>{});return ()=>controller.abort();},[]);
  useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'smooth'});},[messages,status]);
  const disabled=!!status || busy || snapshot.exporting;
  function cancel() {generation.current++;requestRef.current?.abort();requestRef.current=null;locked.current=false;setStatus('');setRetry(null);}
  function changeUploads(items: Upload[]) {cancel();setUploads(items);setRecommendation(null);setGenerated(false);setMessages([]);setError('');setErrorDetail('');setErrorCode('');}
  async function upload(files: File[]) {
    if(locked.current)return;
    if(uploads.length+files.length>12){setError('Upload up to 12 screenshots.');return;}
    locked.current=true;const token=++generation.current;setStatus('Compressing screenshots…');setError('');
    try {
      const assets=await actions.loadJsonImages(files);
      const added=await Promise.all(assets.map(async asset=>({id:++nextId.current,asset,dataUrl:await compressForVision(asset.image)})));
      if(token!==generation.current)return;
      const items=[...uploads,...added];setUploads(items);setMessages([]);setRecommendation(null);setGenerated(false);
      locked.current=false;setStatus('');
      const brief=prompt.trim() || 'Analisis screenshot ini dan rekomendasikan desain screenshot store yang terkoordinasi.';
      setPrompt('');await send('analyze',brief,items,[]);
    } catch(err) {if(token===generation.current){setError((err as Error).message);setStatus('');locked.current=false;}}
  }
  async function send(phase: Phase,text: string,items=uploads,history=messages) {
    if(locked.current || busy)return;
    if(!items.length && phase!=='edit'){setError('Upload screenshots first.');return;}
    locked.current=true;const token=++generation.current,controller=new AbortController();requestRef.current=controller;
    setError('');setErrorDetail('');setErrorCode('');setRetry(null);setStatus(phase==='generate'?'Applying approved design…':phase==='edit'?'Updating design…':'Reading screenshots and designing…');
    const conversation=[...history,{role:'user' as const,content:text}];setMessages(conversation);
    try {
      const project=latest.current.getProject();
      const assets=phase==='edit'?[...project.assets]:items.map(item=>item.asset);
      const screenshots=items.map((item,i)=>{
        let assetIndex=phase==='edit'?assets.findIndex(asset=>asset.image===item.asset.image):i;
        if(assetIndex<0){assetIndex=assets.length;assets.push(item.asset);}
        return {name:item.asset.name,dataUrl:item.dataUrl,assetIndex};
      });
      const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({phase,prompt:text,history:history.slice(-30),screenshots,approved:phase==='generate'||phase==='recommend'?recommendation:null,project:project.config,activeSlide:project.activeSlide,activeFrame:project.activeFrame,selection:project.selection})});
      const data=await response.json();
      if(data.models)setModels(data.models);
      if(!response.ok)throw Object.assign(new Error(data.error || 'AI request failed.'),{detail:data.detail,code:data.code,retryable:data.retryable});
      if(token!==generation.current)return;
      if(latest.current.getProject().signature!==project.signature)throw Object.assign(new Error('Canvas changed while AI was working. Retry using the current canvas.'),{code:'STALE_RESULT',retryable:true});
      const reply=validateReply(data as AiReply,phase,items.length,phase==='generate'?recommendation:null);
      if(reply.config){
        setStatus('Applying design…');
        latest.current.validateJson(JSON.stringify(reply.config),assets);
        await latest.current.applyJson(JSON.stringify(reply.config),assets,project.signature);
        if(token!==generation.current)return;
        setGenerated(true);setRecommendation(null);
      }
      if(reply.recommendation && !reply.config){setRecommendation(reply.recommendation);setGenerated(false);}
      setMessages([...conversation,{role:'assistant',content:reply.message}]);setDirection(false);
    } catch(err) {if(token===generation.current && !controller.signal.aborted){const failure=err as Error & {detail?:string;code?:string;retryable?:boolean};setError(failure.message);setErrorDetail(failure.detail || '');setErrorCode(failure.code || 'CLIENT_VALIDATION');if(failure.retryable!==false)setRetry({phase,text,history});}}
    finally {if(token===generation.current){requestRef.current=null;locked.current=false;setStatus('');}}
  }
  return <div className="ai-chat">
    <div className="ai-chat-heading"><h2>Design with AI</h2><span>{models.design}</span></div>
    <p className="frame-note">Vision: {models.vision} · strict structured output</p>
    <p className="frame-note">Upload screenshots. Review the design direction, then approve to build your set.</p>
    <label className="ai-upload">Add screenshots<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event=>{const files=Array.from(event.target.files || []);event.target.value='';if(files.length)void upload(files);}}/></label>
    {!!uploads.length && <ol className="ai-uploads">{uploads.map((item,i)=><li key={item.id}>
      {/* Original image is previewed and retained for canvas; only dataUrl is sent to AI. */}
      <img src={item.asset.image.src} alt={'Screenshot '+(i+1)} /><span>{i+1}. {item.asset.name}</span>
      <div><button type="button" disabled={disabled || i===0} aria-label={'Move screenshot '+(i+1)+' up'} onClick={()=>{const items=[...uploads];[items[i-1],items[i]]=[items[i],items[i-1]];changeUploads(items);}}>↑</button><button type="button" disabled={disabled || i===uploads.length-1} aria-label={'Move screenshot '+(i+1)+' down'} onClick={()=>{const items=[...uploads];[items[i],items[i+1]]=[items[i+1],items[i]];changeUploads(items);}}>↓</button><button type="button" disabled={disabled} aria-label={'Remove screenshot '+(i+1)} onClick={()=>changeUploads(uploads.filter(x=>x.id!==item.id))}>×</button></div>
    </li>)}</ol>}
    <div className="ai-messages" role="log" aria-live="polite" ref={log}>{!messages.length && <p className="ai-empty">Your AI design conversation starts here.</p>}{messages.map((message,i)=><div key={i} className={'ai-message '+message.role}><small>{message.role==='user'?'You':'AI designer'}</small><p>{message.content}</p></div>)}</div>
    {recommendation && <section className="ai-recommendation" aria-label="Design recommendation"><h3>{recommendation.app}</h3>{recommendation.uncertainty && <p>{recommendation.uncertainty}</p>}<dl>{(['style','colors','typography','tone','mood','ornaments','copy'] as const).map(key=><div key={key}><dt>{key}</dt><dd>{recommendation[key]}</dd></div>)}</dl><ol>{recommendation.slides.map((raw,i)=>{const slide=normalizeConfig(raw);return <li key={i}><strong>{slide.headline.content}</strong><p>{slide.subheadline.content}</p><small>{slide.headline.font} · {slide.background.backgroundType} background · {slide.ornaments.length} accents</small></li>;})}</ol><p>{recommendation.slideCount} slides · one per screenshot</p><button type="button" className="ai-approve" disabled={disabled} onClick={()=>void send('generate','Generate the approved design direction.')}>Approve & Generate</button><small>Replaces the current set. Undo restores it.</small></section>}
    {error && <div className="ai-error" role="alert"><p>{error}</p>{errorDetail && <details><summary>Validation details</summary><p>{errorCode}: {errorDetail}</p></details>}{retry && <button type="button" disabled={disabled} onClick={()=>void send(retry.phase,retry.text,uploads,retry.history)}>Retry request</button>}</div>}
    {status && <div className="ai-status" role="status"><span>{status}</span><button type="button" disabled={status==='Applying design…'} onClick={cancel}>Cancel</button></div>}
    <form onSubmit={event=>{event.preventDefault();if(prompt.trim()){const text=prompt.trim();setPrompt('');void send(generated&&!direction?'edit':messages.length?'recommend':'analyze',text);}}}>
      {generated && <label className="ai-direction"><input type="checkbox" checked={direction} disabled={disabled} onChange={event=>setDirection(event.target.checked)}/>Explore a new design direction</label>}
      <textarea aria-label="Message AI designer" placeholder={generated?'Ask for a change…':'Describe the style you want…'} value={prompt} maxLength={4000} disabled={disabled} onChange={event=>setPrompt(event.target.value)}/>
      <div className="ai-composer-actions"><button type="button" disabled={disabled || !uploads.length} onClick={()=>void send('analyze','Analyze the screenshots and recommend a design direction.')}>Analyze screenshots</button><button type="submit" disabled={disabled || !prompt.trim() || (!uploads.length&&!generated)}>Send</button></div>
    </form>
  </div>;
}
