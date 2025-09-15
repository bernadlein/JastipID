// src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import PortalApp from './PortalApp';
import AdminApp from './AdminApp';

/* ---------- Auth helpers ---------- */
async function signInGoogle() {
  // Simpel saja: biarkan Supabase pakai Site URL (tanpa path khusus)
  await supabase.auth.signInWithOAuth({ provider: 'google' });
}
async function signOut() {
  await supabase.auth.signOut();
  location.href = '/';
}

/* ---------- Auth state hook ---------- */
function useAuth() {
  // undefined = loading, null = guest, object = logged in
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      // pantau perubahan session
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      return () => sub.subscription?.unsubscribe?.();
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!session) { setIsAdmin(false); return; }
      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) { console.warn(error.message); setIsAdmin(false); }
        else setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [session?.user?.id]);

  return { session, isAdmin };
}

/* ---------- UI ---------- */
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
              : <Link className="btn" to="/login"><LogIn size={16}/> Login</Link>}
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
  const { session } = useAuth();
  // jika sudah login (mis. selesai dari callback), langsung ke portal
  if (session) return <Navigate to="/portal" replace />;
  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'40px auto'}}>
        <h2>Masuk</h2>
        <p>Gunakan Google supaya cepat.</p>
        <button className="btn btn-primary" onClick={signInGoogle}>
          <LogIn size={16}/> Lanjutkan dengan Google
        </button>
      </div>
    </div>
  );
}

/* ---------- Callback handler: tukar code/token -> session ---------- */
function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        // Menangani URL berisi ?code=... atau #access_token=...
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (e) {
        console.warn('exchangeCodeForSession error:', e?.message || e);
      } finally {
        navigate('/portal', { replace: true });
      }
    })();
  }, [navigate]);
  return <div className="container">Menyelesaikan login…</div>;
}

/* ---------- App routes ---------- */
export default function App() {
  return (
    <>
      <Header/>
      <Routes>
        {/* Supabase akan kembali ke sini → kita selesaikan session & redirect */}
        <Route path="/.auth/callback" element={<AuthCallback/>} />

        <Route path="/login"  element={<LoginPage/>} />
        <Route path="/portal" element={<RequireAuth><PortalApp/></RequireAuth>} />
        <Route path="/admin"  element={<RequireAdmin><AdminApp/></RequireAdmin>} />

        <Route path="*" element={<Navigate to="/portal" replace/>} />
      </Routes>
    </>
  );
}
