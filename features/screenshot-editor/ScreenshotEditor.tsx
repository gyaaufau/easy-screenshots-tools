'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor } from './useEditor';
import type { EditorProps } from './useEditor';
import { AiChat } from './components/AiChat';
import { JsonControls } from './components/JsonControls';
import { SlideManager } from './components/SlideManager';
import { OrnamentControls } from './components/OrnamentControls';
import { TextAndBackgroundControls, BackgroundControls } from './components/TextAndBackgroundControls';
import { FormatAndFrameControls, OutputControls } from './components/FormatAndFrameControls';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { EditorToolbar } from './components/EditorToolbar';
import './editor.css';

function InlineTextEditor({ snapshot, actions }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const inline = snapshot.inline!;
  return <textarea ref={ref} className="canvas-inline-editor" style={inline.style}
    aria-label={'Edit ' + (inline.type === 'headline' ? 'headline' : 'subheadline')}
    maxLength={inline.type === 'headline' ? 70 : 90} value={snapshot.slide[inline.type]}
    onChange={event => actions.editText(event.target.value)}
    onBlur={() => actions.closeText()} onPointerDown={event => event.stopPropagation()}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); actions.closeText(true); }
      else if (event.key === 'Enter' && (inline.type === 'subtitle' || event.metaKey || event.ctrlKey)) {
        event.preventDefault(); actions.closeText();
      }
    }} />;
}

export default function ScreenshotEditor() {
  const { rootRef, snapshot, actions, jsonBusy } = useEditor();
  const tabs=['visual','ai','json'] as const;
  const [tab,setTab]=useState<typeof tabs[number]>('ai');
  const props = { snapshot, actions };
  return <div ref={rootRef}
    onPointerDownCapture={event => actions.document('pointerdown', event)}
    onClickCapture={event => actions.document('pointerdown', event)}
    onClick={event => actions.document('click', event)}
    onFocusCapture={event => actions.document('focusin', event)}
    onBlur={event => actions.document('focusout', event)}>
    <main className="app">
      <aside className="controls">
        <header className="intro"><h1>Bikin screenshot yang siap tayang.</h1><p>Upload screenshot, diskusikan desain dengan AI, lalu ekspor PNG sesuai ukuran store.</p></header>
        <div className="editor-tabs" role="tablist" aria-label="Mode editor" data-json-panel>
          {tabs.map(value=><button type="button" role="tab" id={'tab-'+value} key={value} aria-selected={tab===value} aria-controls={'panel-'+value} tabIndex={tab===value?0:-1} onKeyDown={event=>{
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
            event.preventDefault();event.stopPropagation();
            const index=tabs.indexOf(value);
            const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
            setTab(next);rootRef.current?.querySelector<HTMLButtonElement>('#tab-'+next)?.focus();
          }} onClick={()=>setTab(value)}>{value==='visual'?'Visual':value==='ai'?'AI Chat':'JSON Manual'}</button>)}
        </div>
        <div id="panel-visual" role="tabpanel" aria-labelledby="tab-visual" hidden={tab!=='visual'} inert={jsonBusy}>
        <SlideManager {...props} />
        <div className="control-grid"><OutputControls {...props} /><FormatAndFrameControls {...props} /><TextAndBackgroundControls {...props} /><BackgroundControls {...props} /><OrnamentControls {...props} /></div>
        </div>
        <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" hidden={tab!=='ai'} data-json-panel><AiChat {...props} busy={jsonBusy}/></div>
        <div id="panel-json" role="tabpanel" aria-labelledby="tab-json" hidden={tab!=='json'} data-json-panel><JsonControls {...props} busy={jsonBusy}/></div>
      </aside>
      <section className="workspace" inert={jsonBusy}><EditorToolbar {...props} /><CanvasWorkspace {...props} /></section>
    </main>
    <div className={'toast' + (snapshot.toast ? ' show' : '')} id="toast" role="status" aria-live="polite">{snapshot.toast}</div>
    {snapshot.inline && <InlineTextEditor key={snapshot.inline.type} {...props} />}
  </div>;
}
