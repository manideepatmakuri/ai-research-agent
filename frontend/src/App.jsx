import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';

function Protected({ children }) { const { user, loading } = useAuth(); if (loading) return <div className="min-h-screen bg-surface-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"/></div>; return user ? children : <Navigate to="/login" replace/>; }
function Public({ children }) { const { user, loading } = useAuth(); if (loading) return null; return user ? <Navigate to="/" replace/> : children; }

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Public><LoginPage/></Public>}/>
    <Route path="/signup" element={<Public><SignupPage/></Public>}/>
    <Route path="/" element={<Protected><ChatPage/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></AuthProvider></BrowserRouter>;
}
