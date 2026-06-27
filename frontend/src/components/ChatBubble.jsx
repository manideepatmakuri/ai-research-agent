import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Brain, ChevronDown, ChevronRight, Search, BookOpen, Database, Copy, Check, FileText } from 'lucide-react';

const ICONS = { web_search: Search, wikipedia: BookOpen, knowledge_base: Database };
const NAMES = { web_search: 'Web Search', wikipedia: 'Wikipedia', knowledge_base: 'Knowledge Base (RAG)' };

export default function ChatBubble({ message: m }) {
  const [showLog, setShowLog] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = m.role === 'user';
  const copy = () => { navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const Icon = m.tool_used ? ICONS[m.tool_used] : null;

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser?'justify-end':'justify-start'}`}>
      {!isUser && <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 mt-0.5"><Brain size={16} className="text-white"/></div>}
      <div className={`max-w-[75%] ${isUser?'order-first':''}`}>
        {m.tool_used && <div className="flex items-center gap-1.5 mb-1.5">{Icon && <Icon size={12} className="text-brand-400"/>}<span className="text-xs text-brand-400 font-medium">{NAMES[m.tool_used]||m.tool_used}</span></div>}
        <div className={`rounded-2xl px-4 py-3 ${isUser?'bg-brand-600 text-white rounded-br-md':'bg-surface-800 text-surface-200 border border-surface-700/40 rounded-bl-md'}`}>
          {isUser ? <p className="text-sm whitespace-pre-wrap">{m.content}</p> : <div className="markdown-body text-sm"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
        </div>
        {!isUser && <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap">
          {m.tools_log && <button onClick={()=>setShowLog(!showLog)} className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300">{showLog?<ChevronDown size={12}/>:<ChevronRight size={12}/>}Reasoning</button>}
          {m.sources && <button onClick={()=>setShowSrc(!showSrc)} className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300"><FileText size={12}/>Sources</button>}
          <button onClick={copy} className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300">{copied?<Check size={12} className="text-green-400"/>:<Copy size={12}/>}{copied?'Copied':'Copy'}</button>
          <span className="text-xs text-surface-600 ml-auto">{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
        </div>}
        {showLog && m.tools_log && <div className="mt-2 p-3 bg-surface-900 border border-surface-700/30 rounded-xl"><p className="text-xs font-medium text-surface-400 mb-1">Agent Reasoning</p><pre className="text-xs text-surface-400 whitespace-pre-wrap font-mono">{m.tools_log}</pre></div>}
        {showSrc && m.sources && <div className="mt-2 p-3 bg-surface-900 border border-surface-700/30 rounded-xl"><p className="text-xs font-medium text-brand-400 mb-1">RAG Sources</p><pre className="text-xs text-surface-400 whitespace-pre-wrap font-mono">{m.sources}</pre></div>}
      </div>
      {isUser && <div className="w-8 h-8 rounded-xl bg-surface-700 flex items-center justify-center shrink-0 mt-0.5"><User size={16} className="text-surface-300"/></div>}
    </div>);
}
