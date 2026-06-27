import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { const s = localStorage.getItem('user'); return s ? JSON.parse(s) : null; });
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = localStorage.getItem('token'); if (t) { authAPI.me().then(r => { setUser(r.data); localStorage.setItem('user', JSON.stringify(r.data)); }).catch(() => { localStorage.clear(); setUser(null); }).finally(() => setLoading(false)); } else setLoading(false); }, []);
  const login = useCallback(async (username, password) => { const r = await authAPI.login({ username, password }); const d = r.data; localStorage.setItem('token', d.access_token); const u = { id: d.user_id, username: d.username, email: d.email, full_name: d.full_name }; localStorage.setItem('user', JSON.stringify(u)); setUser(u); return u; }, []);
  const signup = useCallback(async (email, username, password, full_name) => { const r = await authAPI.signup({ email, username, password, full_name }); const d = r.data; localStorage.setItem('token', d.access_token); const u = { id: d.user_id, username: d.username, email: d.email, full_name: d.full_name }; localStorage.setItem('user', JSON.stringify(u)); setUser(u); return u; }, []);
  const logout = useCallback(() => { localStorage.clear(); setUser(null); }, []);
  return <Ctx.Provider value={{ user, login, signup, logout, loading }}>{children}</Ctx.Provider>;
}
export function useAuth() { const c = useContext(Ctx); if (!c) throw new Error('useAuth needs AuthProvider'); return c; }
