import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import PortalApp from './PortalApp';
import AdminApp from './AdminApp'; // file admin lama kamu
import { LogIn, LogOut } from 'lucide-react';

async function signInGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    // arahkan ke rute yang kita sediakan sendiri
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.assign('/');
}

function useAuth() {
  const [session, setSession] = useState(undefined); // undefined=loading, null=guest
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
      });
      unsubscribe = data.subscription.unsubscribe;
    })();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (!session) { setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc('is_admin');
      setIsAdmin(!error && !!data);
    })();
  }, [session?.user?.id]);

  return { session, isAdmin };
}

function Header() {
  const { session } = useAuth();
  return (
    <div className="header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-badge"></div>
          <h1>Jastip ID</h1>
          <span className="badge">PWA</span>
        </div>
        <div className="flex right">
          <nav className="tabs">
            <Link className="tab" to="/portal">Customer</Link>
            <Link className="tab" to="/admin">Admin</Link>
          </nav>
          <div className="lang">
            {session
              ? <button className="btn" onClick={signOut}><LogOut size={16}/> Logout</button>
              : <button className="btn" onClick={signInGoogle}><LogIn size={16}/> Login</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { session } = useAuth();
  if (session === undefined) return <div className="container">Loading…</div>;
  return session ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { session, isAdmin } = useAuth();
  if (session === undefined) return <div className="container">Loading…</div>;
  return (session && isAdmin) ? children : <Navigate to="/portal" replace />;
}

function LoginPage() {
  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h2>Masuk</h2>
        <p>Gunakan Google supaya cepat.</p>
        <button className="btn btn-primary" onClick={signInGoogle}>
          <LogIn size={16}/> Lanjutkan dengan Google
        </button>
      </div>
    </div>
  );
}

// === Callback handler penting: jangan hapus ===
function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      // Tukar code->session lalu bersihkan URL dan masuk ke portal
      await supabase.auth.exchangeCodeForSession(window.location.href);
      navigate('/portal', { replace: true });
    })();
  }, [navigate]);
  return <div className="container">Menyelesaikan login…</div>;
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/portal" element={<RequireAuth><PortalApp /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminApp /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </>
  );
}
