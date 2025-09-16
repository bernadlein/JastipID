import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function DebugAuth(){
  const [info, setInfo] = useState({});

  useEffect(() => {
    (async () => {
      const href = window.location.href;
      const { data: s1 } = await supabase.auth.getSession();
      const { data: u1, error: eUser } = await supabase.auth.getUser();
      setInfo({
        href,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        hasSession: !!s1?.session,
        userEmail: u1?.user?.email || null,
        userId: u1?.user?.id || null,
        errorUser: eUser?.message || null,
      });
      console.log('DEBUG getSession', s1);
      console.log('DEBUG getUser', u1, eUser);
    })();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h2>Auth Debug</h2>
        <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(info, null, 2)}</pre>
      </div>
    </div>
  );
}
