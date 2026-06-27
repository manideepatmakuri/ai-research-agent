import { useState, useEffect, useRef } from 'react';
import { docAPI } from '../services/api';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

export default function DocPanel({ onClose }) {
  const [docs, setDocs] = useState([]); const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false); const [msg, setMsg] = useState(null);
  const [strategy, setStrategy] = useState('recursive'); const fileRef = useRef();

  useEffect(() => { load(); }, []);
  const load = async () => { try { setDocs((await docAPI.list()).data); } catch(e){} };
  const upload = async file => {
    if (!file) return;
    if (!['txt','md','pdf'].includes(file.name.split('.').pop().toLowerCase())) { setMsg({type:'error',text:'Only .txt .md .pdf'}); return; }
    setUploading(true); setMsg(null);
    try { await docAPI.upload(file, strategy); setMsg({type:'success',text:`"${file.name}" ingested (${strategy})`}); load(); }
    catch(e) { setMsg({type:'error',text:e.response?.data?.detail||'Failed'}); }
    finally { setUploading(false); }
  };
  const fmt = b => b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;

  return (
    <div className="h-full bg-surface-900 border-l border-surface-700/50 w-80 flex flex-col">
      <div className="p-4 border-b border-surface-700/50 flex items-center justify-between"><h3 className="font-semibold text-white text-sm">Knowledge Base</h3><button onClick={onClose} className="p-1 rounded-lg text-surface-400 hover:text-white"><X size={16}/></button></div>
      <div className="p-4">
        <label className="text-xs font-medium text-surface-400 block mb-1.5">Chunking Strategy</label>
        <select value={strategy} onChange={e=>setStrategy(e.target.value)} className="w-full px-3 py-2 bg-surface-800 border border-surface-600/50 rounded-lg text-sm text-white mb-3 focus:outline-none focus:ring-1 focus:ring-brand-500/50">
          <option value="recursive">Recursive (default)</option><option value="by_paragraph">By Paragraph</option>
          <option value="by_page">By Page</option><option value="small_precise">Small Precise</option></select>
        <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);upload(e.dataTransfer.files[0])}}
          onClick={()=>fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${drag?'border-brand-400 bg-brand-500/10':'border-surface-600/50 hover:border-surface-500'}`}>
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf" className="hidden" onChange={e=>upload(e.target.files[0])}/>
          {uploading?<Loader2 className="w-8 h-8 text-brand-400 mx-auto animate-spin"/>:<Upload className="w-8 h-8 text-surface-400 mx-auto mb-2"/>}
          <p className="text-sm text-surface-300 mt-1">{uploading?'Processing...':'Drop file or click'}</p>
          <p className="text-xs text-surface-500 mt-1">.txt .md .pdf — max 10MB</p></div>
        {msg && <div className={`mt-3 p-2.5 rounded-lg text-sm flex items-center gap-2 ${msg.type==='success'?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>{msg.type==='success'?<CheckCircle size={14}/>:<AlertCircle size={14}/>}{msg.text}</div>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-xs font-medium text-surface-500 uppercase mb-2">{docs.length} Document{docs.length!==1?'s':''}</p>
        {docs.map(d=>(
          <div key={d.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-800/50 group mb-1">
            <FileText size={16} className="text-brand-400 shrink-0"/>
            <div className="flex-1 min-w-0"><p className="text-sm text-surface-200 truncate">{d.filename}</p>
              <p className="text-xs text-surface-500">{fmt(d.file_size)} · {d.chunk_count} chunks · {d.chunk_strategy} · <span className={d.status==='ready'?'text-green-400':'text-yellow-400'}>{d.status}</span></p></div>
            <button onClick={()=>{docAPI.remove(d.id);load()}} className="p-1 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></div>))}
        {!docs.length && <p className="text-sm text-surface-500 text-center py-6">Upload files to build your knowledge base</p>}
      </div></div>);
}
