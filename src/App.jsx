import React, { useEffect, useState, useMemo, useContext, createContext } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import PortalApp from './PortalApp';
import AdminApp from './AdminApp';
import { LogIn, LogOut } from 'lucide-react';

const AuthCtx = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
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

/* ===== Robust callback: handle #access_token (implicit) & ?code (PKCE) ===== */
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const qs   = url.searchParams;

        const access_token  = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        const code          = qs.get('code');

        if (access_token && refresh_token) {
          // implicit flow → set session manual
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        } else if (code) {
          // PKCE flow
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else {
          navigate('/login', { replace: true });
          return;
        }

        // bersihkan URL
        window.history.replaceState({}, document.title, '/auth/callback');

        // redirect by role
        const { data, error: roleErr } = await supabase.rpc('is_admin');
        navigate(!roleErr && data ? '/admin' : '/portal', { replace: true });
      } catch (e) {
        console.error('OAuth callback error:', e);
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  return <div className="container">Menyelesaikan login…</div>;
}

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
