import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Kita tangani callback sendiri di /auth/callback
      detectSessionInUrl: false,
      // Pakai default storageKey untuk menghindari bentrok cache lama.
      // Jika perlu kustom, aktifkan lagi setelah login stabil.
      // storageKey: 'sb-jastipid',
    },
  }
);
