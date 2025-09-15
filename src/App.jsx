// src/App.jsx
// App shell dengan routing, login Google (Supabase), guard admin/customer,
// dan auto-redirect setelah callback.

import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import PortalApp from './PortalApp';   // portal customer
import AdminApp from './AdminApp';     // UI admin (file lama kamu, atau placeholder)

async function signInGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/.auth/callback` }
  });
}

async function signOut() {
  await supabase.auth.signOut();
  location.href = '/';
}

function useAuth() {
  // undefined = loading, null = guest, object = logged in
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      supabase.auth.onAuthStateChange((_e, s) => setSession(s));
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
              ? <button className="btn" onClick={signOut}><LogOut size={16} /> Logout</button>
              : <Link className="btn" to="/login"><LogIn size={16} /> Login</Link>}
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
  // kalau sudah login, langsung ke portal
  if (session) return <Navigate to="/portal" replace />;

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h2>Masuk</h2>
        <p>Gunakan Google supaya cepat.</p>
        <button className="btn btn-primary" onClick={signInGoogle}>
          <LogIn size={16} /> Lanjutkan dengan Google
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        {/* callback dari Supabase → langsung lempar ke portal */}
        <Route path="/.auth/callback" element={<Navigate to="/portal" replace />} />

        {/* auth pages */}
        <Route path="/login" element={<LoginPage />} />

        {/* portals */}
        <Route path="/portal" element={<RequireAuth><PortalApp /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminApp /></RequireAdmin>} />

        {/* default */}
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </>
  );
}
