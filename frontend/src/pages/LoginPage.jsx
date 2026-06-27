import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const { login } = useAuth(); const nav = useNavigate();
  const submit = async e => { e.preventDefault(); setErr(''); setLoading(true); try { await login(u, p); nav('/'); } catch(e) { setErr(e.response?.data?.detail || 'Login failed'); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl"/>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-400/5 rounded-full blur-3xl"/>
      <div className="w-full max-w-md mx-4 relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-4 shadow-lg shadow-brand-500/25"><Brain className="w-8 h-8 text-white"/></div>
          <h1 className="text-2xl font-bold text-white">AI Research Agent</h1>
          <p className="text-surface-400 mt-1 text-sm">Sign in to continue</p>
        </div>
        <div className="bg-surface-900/80 backdrop-blur-xl border border-surface-700/50 rounded-2xl p-8 shadow-2xl animate-fade-in">
          {err && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
          <form onSubmit={submit} className="space-y-5">
            <div><label className="block text-sm font-medium text-surface-300 mb-1.5">Username or Email</label>
              <input type="text" value={u} onChange={e=>setU(e.target.value)} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" placeholder="Enter username" required/></div>
            <div><label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
              <div className="relative"><input type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all pr-12" placeholder="Enter password" required/>
                <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><span>Sign In</span><ArrowRight size={18}/></>}</button>
          </form>
          <p className="mt-6 text-center text-surface-400 text-sm">No account? <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-medium">Create one</Link></p>
        </div>
      </div>
    </div>);
}
