import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const [f, setF] = useState({ email:'', username:'', password:'', fullName:'' });
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const { signup } = useAuth(); const nav = useNavigate();
  const set = k => e => setF({...f, [k]: e.target.value});
  const submit = async e => { e.preventDefault(); setErr(''); if(f.password.length<6){setErr('Min 6 chars');return;} setLoading(true); try { await signup(f.email,f.username,f.password,f.fullName); nav('/'); } catch(e){setErr(e.response?.data?.detail||'Failed');} finally{setLoading(false);} };
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl"/>
      <div className="w-full max-w-md mx-4 relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-4 shadow-lg shadow-brand-500/25"><Brain className="w-8 h-8 text-white"/></div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1></div>
        <div className="bg-surface-900/80 backdrop-blur-xl border border-surface-700/50 rounded-2xl p-8 shadow-2xl animate-fade-in">
          {err && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div><label className="block text-sm text-surface-300 mb-1">Full Name</label><input type="text" value={f.fullName} onChange={set('fullName')} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Your name"/></div>
            <div><label className="block text-sm text-surface-300 mb-1">Email</label><input type="email" value={f.email} onChange={set('email')} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required/></div>
            <div><label className="block text-sm text-surface-300 mb-1">Username</label><input type="text" value={f.username} onChange={set('username')} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50" required/></div>
            <div><label className="block text-sm text-surface-300 mb-1">Password</label><input type="password" value={f.password} onChange={set('password')} className="w-full px-4 py-3 bg-surface-800 border border-surface-600/50 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50" placeholder="Min 6 chars" required/></div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 mt-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><span>Create Account</span><ArrowRight size={18}/></>}</button>
          </form>
          <p className="mt-6 text-center text-surface-400 text-sm">Have an account? <Link to="/login" className="text-brand-400 font-medium">Sign in</Link></p>
        </div></div></div>);
}
