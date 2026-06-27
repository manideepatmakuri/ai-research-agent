import { useState, useEffect } from 'react';
import { ragAPI } from '../services/api';
import { Database, Search, BarChart3, Layers, FileText, Zap, ChevronDown, ChevronRight, ArrowLeft, Loader2, AlertCircle, Cpu, HardDrive, Hash, Filter } from 'lucide-react';

function Stat({ icon:I, label, value, sub, color='brand' }) {
  const cls = { brand:'from-brand-500/15 to-brand-600/5 border-brand-500/20 text-brand-400', emerald:'from-emerald-500/15 to-emerald-600/5 border-emerald-500/20 text-emerald-400', purple:'from-purple-500/15 to-purple-600/5 border-purple-500/20 text-purple-400', amber:'from-amber-500/15 to-amber-600/5 border-amber-500/20 text-amber-400' };
  return <div className={`bg-gradient-to-br ${cls[color]} border rounded-xl p-4`}><div className="flex items-center gap-2 mb-2"><I size={16}/><span className="text-xs font-medium text-surface-400 uppercase tracking-wider">{label}</span></div><p className="text-2xl font-bold text-white">{value}</p>{sub&&<p className="text-xs text-surface-400 mt-0.5">{sub}</p>}</div>;
}

function Chunk({ chunk:c, expanded, onToggle }) {
  return <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl overflow-hidden">
    <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-800">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">#{c.chunk_index}</span>
          <span className="text-xs text-surface-400">{c.source}</span>
          {c.page>0&&<span className="text-xs text-surface-500">p.{c.page}</span>}
          {c.score!=null&&<span className={`text-xs font-mono px-1.5 py-0.5 rounded ${c.score>0.7?'bg-emerald-500/10 text-emerald-400':c.score>0.4?'bg-amber-500/10 text-amber-400':'bg-surface-700 text-surface-400'}`}>{Number(c.score).toFixed(4)}</span>}
        </div>
        <p className="text-sm text-surface-300 line-clamp-2">{c.content_preview||c.content?.slice(0,200)}</p>
      </div>
      {expanded?<ChevronDown size={14} className="text-surface-500 mt-1"/>:<ChevronRight size={14} className="text-surface-500 mt-1"/>}
    </button>
    {expanded&&<div className="px-4 pb-4 border-t border-surface-700/30">
      <div className="flex gap-4 py-2 text-xs text-surface-500"><span>{c.char_count} chars</span><span>{c.token_estimate} tokens</span><span>Strategy: {c.chunk_strategy||'?'}</span></div>
      <div className="bg-surface-900 rounded-lg p-3 mt-1"><pre className="text-sm text-surface-300 whitespace-pre-wrap font-sans leading-relaxed">{c.full_content||c.content}</pre></div>
      {c.metadata&&<details className="mt-2"><summary className="text-xs text-surface-500 cursor-pointer">Metadata</summary><pre className="text-xs text-surface-500 mt-1 bg-surface-900 rounded p-2">{JSON.stringify(c.metadata,null,2)}</pre></details>}
    </div>}
  </div>;
}

export default function RAGExplorerPage({ onBack }) {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null); const [chunks, setChunks] = useState([]); const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [exp, setExp] = useState(null);
  const [q, setQ] = useState(''); const [mode, setMode] = useState('hybrid'); const [k, setK] = useState(5);
  const [mq, setMq] = useState(true); const [rr, setRr] = useState(true); const [cc, setCc] = useState(true); const [meta, setMeta] = useState(null);
  const [src, setSrc] = useState(''); const [lim, setLim] = useState(20);

  useEffect(()=>{ if(tab==='stats') loadStats(); if(tab==='chunks') loadChunks(); },[tab]);

  const loadStats = async()=>{setLoading(true);setError('');try{setStats((await ragAPI.stats()).data)}catch(e){setError(e.response?.data?.detail||'No data')}finally{setLoading(false)}};
  const loadChunks = async()=>{setLoading(true);setError('');try{setChunks((await ragAPI.chunks(src||undefined,lim)).data)}catch(e){setError(e.response?.data?.detail||'No chunks')}finally{setLoading(false)}};
  const search = async()=>{if(!q.trim())return;setLoading(true);setError('');setResults([]);setMeta(null);try{const r=(await ragAPI.advancedSearch({query:q,k,search_mode:mode,use_multi_query:mq,use_reranking:rr,use_compression:cc})).data;setResults(r.chunks);setMeta({total:r.total_chunks_searched,strategy:r.search_strategy,queries:r.expanded_queries})}catch(e){setError(e.response?.data?.detail||'Failed')}finally{setLoading(false)}};

  const tabs=[{id:'stats',label:'Analytics',icon:BarChart3},{id:'chunks',label:'Chunk Browser',icon:Layers},{id:'search',label:'Search Playground',icon:Search}];

  return <div className="flex-1 flex flex-col h-screen bg-surface-950">
    <div className="border-b border-surface-800 bg-surface-900/50 px-6 py-4">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800"><ArrowLeft size={18}/></button>
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center"><Database size={18} className="text-white"/></div>
          <div><h1 className="text-lg font-bold text-white">RAG Explorer</h1><p className="text-xs text-surface-400">Vector Database · Hybrid Search · Analytics</p></div></div></div>
      <div className="flex gap-1 mt-4">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab===t.id?'bg-brand-600/15 text-brand-400 border border-brand-500/20':'text-surface-400 hover:bg-surface-800'}`}><t.icon size={15}/>{t.label}</button>)}</div>
    </div>

    <div className="flex-1 overflow-y-auto px-6 py-6">
      {error&&<div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
      {loading&&<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-400 animate-spin"/></div>}

      {tab==='stats'&&stats&&!loading&&<div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Layers} label="Total Chunks" value={stats.total_chunks} color="brand"/>
          <Stat icon={FileText} label="Documents" value={stats.total_documents} color="emerald"/>
          <Stat icon={HardDrive} label="Index Size" value={stats.index_size_readable} color="purple"/>
          <Stat icon={Hash} label="Dimensions" value={stats.embedding_dimensions} sub={stats.embedding_model.split('/').pop()} color="amber"/></div>
        <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Cpu size={16} className="text-purple-400"/>Embedding Model</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-surface-400">Model</p><p className="text-white font-mono text-xs mt-0.5">{stats.embedding_model}</p></div>
            <div><p className="text-surface-400">Avg Chunk</p><p className="text-white font-mono text-xs mt-0.5">{stats.avg_chunk_length} chars</p></div></div></div>
        <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-brand-400"/>Chunk Length Distribution</h3>
          {Object.entries(stats.chunk_length_distribution).map(([r,c])=>{const mx=Math.max(...Object.values(stats.chunk_length_distribution),1);return <div key={r} className="flex items-center gap-3 mb-2">
            <span className="text-xs text-surface-400 w-16 text-right font-mono">{r}</span>
            <div className="flex-1 h-6 bg-surface-900 rounded-md overflow-hidden"><div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-md" style={{width:`${c/mx*100}%`}}/></div>
            <span className="text-xs text-surface-300 w-8 font-mono">{c}</span></div>})}</div>
        <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><FileText size={16} className="text-emerald-400"/>Document Breakdown</h3>
          {stats.documents.map((d,i)=><div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-800">
            <div className="flex items-center gap-3"><FileText size={14} className="text-brand-400"/><div><p className="text-sm text-white">{d.filename}</p><p className="text-xs text-surface-500">{d.page_count} pages · {d.total_tokens.toLocaleString()} tokens</p></div></div>
            <div className="text-right"><p className="text-sm font-mono text-brand-400">{d.chunk_count} chunks</p><p className="text-xs text-surface-500">{d.chunk_strategy}</p></div></div>)}</div>
      </div>}

      {tab==='chunks'&&!loading&&<div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2"><Filter size={14} className="text-surface-400"/>
            <input type="text" placeholder="Filter by source..." value={src} onChange={e=>setSrc(e.target.value)} className="px-3 py-1.5 bg-surface-800 border border-surface-700/50 rounded-lg text-sm text-white placeholder-surface-500 w-48 focus:outline-none focus:ring-1 focus:ring-brand-500/50"/></div>
          <select value={lim} onChange={e=>setLim(+e.target.value)} className="px-3 py-1.5 bg-surface-800 border border-surface-700/50 rounded-lg text-sm text-white">{[10,20,50,100].map(n=><option key={n} value={n}>{n} chunks</option>)}</select>
          <button onClick={loadChunks} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg">Load</button></div>
        <p className="text-xs text-surface-500">{chunks.length} loaded</p>
        <div className="space-y-2">{chunks.map((c,i)=><Chunk key={`${c.source}-${c.chunk_index}`} chunk={c} expanded={exp===i} onToggle={()=>setExp(exp===i?null:i)}/>)}</div>
      </div>}

      {tab==='search'&&!loading&&<div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-surface-800/50 border border-surface-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-400"/>Advanced RAG Search Playground</h3>
          <div className="flex gap-3 mb-4">
            <input type="text" placeholder="Enter search query..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} className="flex-1 px-4 py-2.5 bg-surface-900 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"/>
            <button onClick={search} disabled={!q.trim()} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl disabled:opacity-30 flex items-center gap-2"><Search size={15}/>Search</button></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs text-surface-400 block mb-1">Mode</label><select value={mode} onChange={e=>setMode(e.target.value)} className="w-full px-3 py-2 bg-surface-900 border border-surface-600/50 rounded-lg text-sm text-white"><option value="hybrid">Hybrid (FAISS+BM25)</option><option value="semantic">Semantic (FAISS)</option><option value="keyword">Keyword (BM25)</option></select></div>
            <div><label className="text-xs text-surface-400 block mb-1">Results (k)</label><select value={k} onChange={e=>setK(+e.target.value)} className="w-full px-3 py-2 bg-surface-900 border border-surface-600/50 rounded-lg text-sm text-white">{[3,5,8,10,15].map(n=><option key={n} value={n}>{n}</option>)}</select></div>
            <div className="flex flex-col gap-1.5 mt-1"><label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer"><input type="checkbox" checked={mq} onChange={e=>setMq(e.target.checked)}/>Multi-query</label><label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer"><input type="checkbox" checked={rr} onChange={e=>setRr(e.target.checked)}/>Re-ranking</label></div>
            <div className="flex flex-col gap-1.5 mt-1"><label className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer"><input type="checkbox" checked={cc} onChange={e=>setCc(e.target.checked)}/>Compression</label></div></div></div>
        {meta&&<div className="bg-surface-800/30 border border-surface-700/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-surface-400"><span>Strategy: <strong className="text-surface-300">{meta.strategy}</strong></span><span>Searched: <strong className="text-surface-300">{meta.total}</strong></span><span>Results: <strong className="text-surface-300">{results.length}</strong></span></div>
          {meta.queries?.length>1&&<div className="mt-1.5 flex items-center gap-2 flex-wrap"><span className="text-xs text-surface-500">Expanded:</span>{meta.queries.map((q,i)=><span key={i} className="text-xs bg-surface-800 text-surface-300 px-2 py-0.5 rounded-md border border-surface-700/30">{q}</span>)}</div>}</div>}
        <div className="space-y-2">{results.map((c,i)=><Chunk key={i} chunk={c} expanded={exp===`s${i}`} onToggle={()=>setExp(exp===`s${i}`?null:`s${i}`)}/>)}</div>
      </div>}
    </div>
  </div>;
}
