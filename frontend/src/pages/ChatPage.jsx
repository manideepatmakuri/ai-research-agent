import { useState, useEffect, useRef, useCallback } from 'react';
import { chatAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import ChatBubble from '../components/ChatBubble';
import DocPanel from '../components/DocPanel';
import RAGExplorerPage from './RAGExplorerPage';
import { Send, Loader2, Search, BookOpen, Database, Sparkles } from 'lucide-react';

function formatApiError(e) {
  const d = e.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === 'string' ? x : x.msg || JSON.stringify(x))).join(' ');
  if (d && typeof d === 'object') return JSON.stringify(d);
  return 'Request failed. Check the browser Network tab or API server logs for the real error.';
}

const TIPS = [
  { icon: Search, text: 'What are the latest trends in AI?', color: 'text-blue-400' },
  { icon: BookOpen, text: 'Explain how transformers work', color: 'text-emerald-400' },
  { icon: Database, text: 'Search my uploaded documents', color: 'text-purple-400' },
];

export default function ChatPage() {
  const [sessions, setSessions] = useState([]); const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]); const [input, setInput] = useState('');
  const [sending, setSending] = useState(false); const [showDocs, setShowDocs] = useState(false);
  const [showRAG, setShowRAG] = useState(false);
  const endRef = useRef(null); const inputRef = useRef(null);

  useEffect(()=>{ loadSessions(); },[]);
  useEffect(()=>{ if(active) loadMsgs(active); else setMsgs([]); },[active]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs]);

  const loadSessions = async()=>{ try{setSessions((await chatAPI.sessions()).data)}catch(e){} };
  const loadMsgs = async id=>{ try{setMsgs((await chatAPI.history(id)).data)}catch(e){} };

  const send = useCallback(async text=>{
    const m = text||input.trim(); if(!m||sending) return;
    setMsgs(p=>[...p,{id:`t${Date.now()}`,role:'user',content:m,created_at:new Date().toISOString()}]);
    setInput(''); setSending(true);
    try {
      const r = (await chatAPI.send(m, active)).data;
      if(!active) setActive(r.session_id);
      setMsgs(p=>[...p,{id:`r${Date.now()}`,role:'assistant',content:r.message,tool_used:r.tool_used,tools_log:r.tools_log,sources:r.sources,created_at:r.created_at}]);
      loadSessions();
    } catch(e) { setMsgs(p=>[...p,{id:`e${Date.now()}`,role:'assistant',content:formatApiError(e),created_at:new Date().toISOString()}]); }
    finally { setSending(false); inputRef.current?.focus(); }
  },[input,sending,active]);

  const newChat = ()=>{ setActive(null); setMsgs([]); setShowRAG(false); inputRef.current?.focus(); };
  const delSession = async id=>{ try{await chatAPI.deleteSession(id);if(active===id){setActive(null);setMsgs([])}loadSessions();}catch(e){} };

  return (
    <div className="flex h-screen bg-surface-950">
      <Sidebar sessions={sessions} activeSession={active} onSelect={id=>{setActive(id);setShowRAG(false)}} onNew={newChat} onDelete={delSession} onShowDocs={()=>setShowDocs(!showDocs)} showDocs={showDocs} onShowRAG={()=>setShowRAG(!showRAG)} showRAG={showRAG}/>
      {showRAG ? <RAGExplorerPage onBack={()=>setShowRAG(false)}/> : <>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {msgs.length===0 ? <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/20 flex items-center justify-center mb-6"><Sparkles className="w-8 h-8 text-brand-400"/></div>
            <h2 className="text-xl font-bold text-white mb-2">What can I help you research?</h2>
            <p className="text-surface-400 text-sm text-center mb-8">I search the web, Wikipedia, and your uploaded documents using hybrid RAG.</p>
            <div className="grid gap-3 w-full">{TIPS.map((t,i)=><button key={i} onClick={()=>send(t.text)} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-800/50 border border-surface-700/30 hover:bg-surface-800 text-left group">
              <t.icon size={18} className={`${t.color} group-hover:scale-110 transition-transform`}/><span className="text-sm text-surface-300 group-hover:text-white">{t.text}</span></button>)}</div>
          </div> : <div className="max-w-3xl mx-auto space-y-5">
            {msgs.map(m=><ChatBubble key={m.id} message={m}/>)}
            {sending&&<div className="flex items-center gap-3 animate-fade-in"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><Loader2 size={16} className="text-white animate-spin"/></div><div className="bg-surface-800 border border-surface-700/40 rounded-2xl rounded-bl-md px-4 py-3"><span className="text-sm text-surface-400 typing-cursor">Thinking</span></div></div>}
            <div ref={endRef}/></div>}
        </div>
        <div className="border-t border-surface-800 bg-surface-950/80 backdrop-blur-sm px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-surface-800 border border-surface-700/50 rounded-2xl p-2 focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20">
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder="Ask a question... (Enter to send)" rows={1} className="flex-1 bg-transparent text-white text-sm placeholder-surface-500 resize-none outline-none px-2 py-2 max-h-32" style={{minHeight:'40px'}}
                onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,128)+'px'}}/>
              <button onClick={()=>send()} disabled={!input.trim()||sending} className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-30 shrink-0">
                {sending?<Loader2 size={18} className="animate-spin"/>:<Send size={18}/>}</button></div>
            <p className="text-xs text-surface-600 text-center mt-2">ReAct Agent · Hybrid RAG (FAISS + BM25) · Web Search · Wikipedia</p>
          </div></div></div>
      {showDocs&&<DocPanel onClose={()=>setShowDocs(false)}/>}
      </>}
    </div>);
}
