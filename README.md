# Jastip Lite (Free)

MVP aplikasi jastip (alamat virtual Surabaya → konsolidasi → batch DLU → Flores)
menggunakan **React (Vite)** + **Supabase** (DB & Storage).

## Set Up
1. Buat project Supabase (gratis). Jalankan SQL schema (sudah Anda buat sebelumnya).
2. Buat bucket storage `proof` (Public).
3. Salin `.env.example` menjadi `.env` dan isi `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`.
4. Jalankan:

```bash
npm install
npm run dev
```

## Deploy
- **Vercel** (direkomendasikan): Import repo → set `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` → Deploy.
- **Netlify**: sama, build `npm run build`, publish dir `dist`.

## Catatan
- Modul inti: Customers, Pre-Alert, Receive/Inbound (foto bukti), Billing (tandai LUNAS), Batches (DLU), Manifest CSV.
- Anda bisa menambahkan Auth & RLS di Supabase jika diperlukan.
# JastipID
