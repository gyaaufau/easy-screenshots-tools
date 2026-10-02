import { useEffect, useRef, useState } from 'react';
import type { EditorProps } from '../useEditor';
import type { ConfigAsset } from '../configRuntime';
import { configSchema, examples } from '../config';
export function JsonControls({ snapshot, actions, busy }: EditorProps & {
    busy: boolean;
}) {
    const [source, setSource] = useState(() => JSON.stringify(examples.template, null, 2));
    const [assets, setAssets] = useState<ConfigAsset[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const generation = useRef(0);
    useEffect(() => () => { generation.current++; }, []);
    const disabled = busy || loading || snapshot.exporting;
    async function run(work: () => Promise<void> | void) {
        const token = ++generation.current;
        setError('');
        setMessage('');
        setLoading(true);
        try {
            await work();
        }
        catch (error) {
            if (token === generation.current)
                setError((error as Error).message);
        }
        finally {
            if (token === generation.current)
                setLoading(false);
        }
    }
    function changeAssets(from: number, to: number) { setAssets(items => { const copy = [...items]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy; }); setMessage(''); }
    return <div className="json-controls">
  <h2>Desain lewat JSON</h2><p className="frame-note">Upload config dan gambar. Index gambar mengikuti urutan daftar, dimulai dari 0. Terapkan untuk mengganti proyek atau menjalankan command.</p>
  <fieldset disabled={disabled}>
   <div className="field"><label htmlFor="json-file">Upload config JSON</label><input id="json-file" type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file)
        void run(async () => { const token = generation.current; const value = await file.text(); if (token === generation.current)
            setSource(value); }); }}/></div>
   <div className="json-examples">{(['project', 'template', 'commands'] as const).map(kind => <button type="button" key={kind} onClick={() => { setSource(JSON.stringify(examples[kind], null, 2)); setMessage(''); setError(''); }}>Contoh {kind}</button>)}</div>
   <div className="field"><label htmlFor="json-source">Config / command JSON</label><textarea id="json-source" spellCheck={false} value={source} onChange={event => { setSource(event.target.value); setMessage(''); setError(''); }}/></div>
   <div className="field"><label htmlFor="json-images">Tambah banyak gambar</label><input id="json-images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length)
        void run(async () => { const token = generation.current; const loaded = await actions.loadJsonImages(files); if (token === generation.current)
            setAssets(items => [...items, ...loaded]); }); }}/></div>
   <ol className="json-assets" start={0}>{assets.map((asset, index) => <li key={index}>
    <img src={asset.image.src} alt=""/><span><strong>{index}</strong> {asset.name}</span>
    <div><button type="button" disabled={index === 0} aria-label={'Pindah gambar ' + index + ' ke atas'} onClick={() => changeAssets(index, index - 1)}>↑</button><button type="button" disabled={index === assets.length - 1} aria-label={'Pindah gambar ' + index + ' ke bawah'} onClick={() => changeAssets(index, index + 1)}>↓</button><button type="button" aria-label={'Hapus gambar ' + index} onClick={() => setAssets(items => items.filter((_, i) => i !== index))}>×</button></div>
   </li>)}</ol>
   <div className="json-actions">
    <button type="button" onClick={() => void run(() => { actions.validateJson(source, assets); setMessage('JSON valid. Siap diterapkan.'); })}>Validasi</button>
    <button type="button" className="json-apply" onClick={() => void run(async () => { const token = generation.current; await actions.applyJson(source, assets); if (token === generation.current)
        setMessage('JSON berhasil diterapkan.'); })}>Terapkan</button>
    <button type="button" onClick={() => void run(async () => { const token = generation.current; const exported = await actions.exportJson(); if (token === generation.current) {
        setSource(exported.source);
        setAssets(exported.assets);
        setMessage('Config diekspor. Gambar tetap file terpisah; daftar mengikuti manifest.');
    } })}>Export JSON</button>
    <button type="button" onClick={() => void run(() => actions.downloadJson(configSchema, 'screenshot-editor.schema.json'))}>JSON Schema</button>
   </div>
  </fieldset>
  {disabled && <p role="status">Memproses…</p>}
  {error && <p className="json-error" role="alert">{error}</p>}
  {message && <p className="json-message" role="status">{message}</p>}
 </div>;
}
