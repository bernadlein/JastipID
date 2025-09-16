import React, { useEffect, useState, useMemo, useContext, createContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import PortalApp from './PortalApp';
import AdminApp from './AdminApp';
import { LogIn, LogOut } from 'lucide-react';

/* ===================== AUTH LAYER (Context) ===================== */
const AuthCtx = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined=loading, null=guest
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
      unsub = data.subscription.unsubscribe;
    })();
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.user?.id) { setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc('is_admin');
      if (!cancelled) setIsAdmin(!error && !!data);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const value = useMemo(() => ({ session, isAdmin }), [session, isAdmin]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
function useAuth() { return useContext(AuthCtx); }

/* ===================== ACTIONS ===================== */
async function signInGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      flowType: 'pkce',    
      queryParams: { prompt: 'select_account' },
    },
  });
}
async function signOut() {
  await supabase.auth.signOut();
  window.location.assign('/');
}

/* ===================== UI BITS ===================== */
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
          {/* Hilangkan tab Customer/Admin supaya simpel */}
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

/* ===== Callback yang robust: tukar token, bersihkan URL, redirect by role ===== */
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const hasHash = window.location.hash.includes('access_token');
        const hasCode = window.location.search.includes('code=');
        if (!hasHash && !hasCode) {
          navigate('/login', { replace: true });
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        // Bersihkan fragment/query dari URL callback biar tidak nyangkut
        window.history.replaceState({}, document.title, '/auth/callback');

        // Cek role → arahkan ke halaman yang tepat
        const { data, error: errRole } = await supabase.rpc('is_admin');
        if (errRole) {
          // fallback: kalau gagal cek role, minimal ke portal
          navigate('/portal', { replace: true });
        } else {
          navigate(data ? '/admin' : '/portal', { replace: true });
        }
      } catch (e) {
        console.error('OAuth callback error:', e);
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  return <div className="container">Menyelesaikan login…</div>;
}

/* ===================== APP ROOT ===================== */
export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/portal" element={<RequireAuth><PortalApp /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><AdminApp /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </AuthProvider>
  );
}
