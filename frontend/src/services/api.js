import axios from 'axios';
const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use(r => r, e => { if (e.response?.status === 401 && location.pathname !== '/login') { localStorage.clear(); location.href = '/login'; } return Promise.reject(e); });

export const authAPI = { signup: d => api.post('/auth/signup', d), login: d => api.post('/auth/login', d), me: () => api.get('/auth/me') };
export const chatAPI = { send: (message, session_id) => api.post('/chat', { message, session_id }), sessions: () => api.get('/chat/sessions'), history: id => api.get(`/chat/history/${id}`), deleteSession: id => api.delete(`/chat/history/${id}`) };
export const docAPI = { upload: (file, strategy='recursive') => { const f = new FormData(); f.append('file', file); return api.post(`/documents/ingest?strategy=${strategy}`, f, { headers: { 'Content-Type': 'multipart/form-data' } }); }, list: () => api.get('/documents'), remove: id => api.delete(`/documents/${id}`) };
export const ragAPI = { stats: () => api.get('/rag/stats'), chunks: (source, limit=20) => api.get('/rag/chunks', { params: { source, limit } }), search: (q, k=5) => api.get('/rag/search', { params: { q, k } }), advancedSearch: d => api.post('/rag/advanced-search', d), strategies: () => api.get('/rag/strategies') };
export const healthAPI = { check: () => api.get('/health') };
export default api;
