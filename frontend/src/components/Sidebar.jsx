import { useState } from 'react';
import { MessageSquarePlus, Trash2, Brain, LogOut, FileText, Database, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ sessions, activeSession, onSelect, onNew, onDelete, onShowDocs, showDocs, onShowRAG, showRAG }) {
  const { user, logout } = useAuth();
  const [confirm, setConfirm] = useState(null);
  const del = (e, id) => { e.stopPropagation(); if (confirm===id) { onDelete(id); setConfirm(null); } else { setConfirm(id); setTimeout(()=>setConfirm(null),3000); } };
  const fmtDate = d => { const diff = Date.now()-new Date(d); return diff<86400000?'Today':diff<172800000?'Yesterday':new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}); };

  return (
    <div className="w-72 h-screen bg-surface-900 border-r border-surface-700/50 flex flex-col shrink-0">
      <div className="p-4 border-b border-surface-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><Brain className="w-5 h-5 text-white"/></div>
          <div><h2 className="text-sm font-bold text-white">AI Research Agent</h2><p className="text-xs text-surface-400">ReAct + RAG + FAISS</p></div></div>
        <button onClick={onNew} className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2"><MessageSquarePlus size={16}/>New Chat</button></div>

      <button onClick={onShowDocs} className={`mx-3 mt-3 py-2 px-3 rounded-lg text-sm flex items-center gap-2 transition-colors ${showDocs?'bg-brand-600/15 text-brand-400':'text-surface-400 hover:bg-surface-800'}`}><FileText size={15}/>Knowledge Base</button>
      <button onClick={onShowRAG} className={`mx-3 mt-1 py-2 px-3 rounded-lg text-sm flex items-center gap-2 transition-colors ${showRAG?'bg-purple-600/15 text-purple-400':'text-surface-400 hover:bg-surface-800'}`}><Database size={15}/>RAG Explorer</button>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        <p className="px-2 py-1.5 text-xs font-medium text-surface-500 uppercase tracking-wider">Conversations</p>
        {sessions.length===0 && <p className="px-3 py-4 text-xs text-surface-500 text-center">No chats yet</p>}
        {sessions.map(s => (
          <button key={s.id} onClick={()=>onSelect(s.id)} className={`w-full text-left px-3 py-2.5 rounded-xl mb-0.5 group flex items-start gap-2 transition-all ${activeSession===s.id?'bg-surface-700/60 text-white':'text-surface-300 hover:bg-surface-800'}`}>
            <div className="flex-1 min-w-0"><p className="text-sm truncate">{s.title}</p><div className="flex items-center gap-1.5 mt-0.5"><Clock size={10} className="text-surface-500"/><span className="text-xs text-surface-500">{fmtDate(s.updated_at)}</span><span className="text-xs text-surface-600">·</span><span className="text-xs text-surface-500">{s.message_count} msgs</span></div></div>
            <button onClick={e=>del(e,s.id)} className={`mt-0.5 p-1 rounded-md shrink-0 ${confirm===s.id?'bg-red-500/20 text-red-400':'opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400'}`}><Trash2 size={14}/></button>
          </button>))}
      </div>

      <div className="p-3 border-t border-surface-700/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-sm font-semibold text-brand-400">{(user?.username?.[0]||'U').toUpperCase()}</div>
        <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{user?.username}</p><p className="text-xs text-surface-500 truncate">{user?.email}</p></div>
        <button onClick={logout} className="p-1.5 rounded-lg text-surface-400 hover:text-red-400"><LogOut size={16}/></button></div>
    </div>);
}
