# Jastip Lite — Virtual Address & Batch Shipping (Surabaya → Flores)

**Jastip Lite** adalah aplikasi gratis (MVP) untuk bisnis jastip: pelanggan berbelanja di marketplace (Shopee/Tokopedia/Lazada),
kirim ke alamat virtual Surabaya, paket dikonsolidasikan mingguan, lalu dikirim batch ke Flores via DLU.

**Live Demo:** _isi dengan URL Vercel kamu (contoh: https://jastip-id-nine.vercel.app)_  
**Tech Stack:** React (Vite) · Supabase (Postgres + Storage) · Vercel

## ✨ Fitur Utama
- **Customer + Kode Unik** (contoh: `FLRABCD`)
- **Pre-Alert Paket** (resi + marketplace + nilai barang)
- **Inbound & Billing**: foto bukti, timbang/ukur, hitung biaya (volumetrik), tandai LUNAS
- **Batch DLU**: buat batch (ETD/ETA), masukkan paket, catat **ID BAG** & **nomor segel**
- **Tracking Internal**: status `RECEIVED → PAID → READY_TO_SHIP → BAGGED → ON_TRUCK → ON_VESSEL → ARRIVED`
- **Manifest CSV** siap unduh
- Desain clean, siap dipakai mobile & desktop

## 🏗️ Arsitektur Singkat
- **Frontend:** Vite + React (SPA), akses langsung ke Supabase via anon key.
- **Database:** Supabase (Postgres) — tabel `customers`, `parcels`, `batches` + view `parcels_view`.
- **Storage:** bucket public `proof` untuk foto bukti inbound.
- **Hosting:** Vercel (free tier).

## 📦 Setup Cepat
1. **Supabase**
   - Buat project → SQL Editor → jalankan schema yang ada di repo.
   - Buat **Storage bucket** bernama `proof` (Public).
2. **ENV (Vercel/Netlify)**
   - `VITE_SUPABASE_URL = https://<PROJECT>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY = <anon key>`
3. **Deploy**
   - Vercel: Framework **Vite**, Build `npm run build`, Output `dist`.

## 🔐 Keamanan (Row Level Security)
- Untuk MVP tanpa login, **nonaktifkan RLS** sementara:
  ```sql
  alter table public.customers disable row level security;
  alter table public.parcels   disable row level security;
  alter table public.batches   disable row level security;
  ```
- Atau tetap aktifkan RLS dan izinkan akses publik (demo only):
  ```sql
  alter table public.customers enable row level security;
  alter table public.parcels   enable row level security;
  alter table public.batches   enable row level security;

  create policy "anon_select_customers" on public.customers for select using (true);
  create policy "anon_insert_customers" on public.customers for insert with check (true);
  create policy "anon_update_customers" on public.customers for update using (true) with check (true);

  create policy "anon_select_parcels"   on public.parcels   for select using (true);
  create policy "anon_insert_parcels"   on public.parcels   for insert with check (true);
  create policy "anon_update_parcels"   on public.parcels   for update using (true) with check (true);

  create policy "anon_select_batches"   on public.batches   for select using (true);
  create policy "anon_insert_batches"   on public.batches   for insert with check (true);
  create policy "anon_update_batches"   on public.batches   for update using (true) with check (true);
  ```
- **Produksi:** pakai Auth + RLS yang ketat (role-based), jangan biarkan `USING (true)` & `WITH CHECK (true)`.

## 🧮 Perhitungan Biaya
- Volume: `(p × l × t) / 6000`
- Tagihan: `baseFee + jasaJastip + ceil(max(berat, volumetrik)) × tarifPerKg`
- Tarif default dapat diset di `App.jsx`.

## 🖼️ Screenshot (contoh)
- Customers / Pre-Alert / Inbound / Billing / Batch DLU
> Tambahkan gambar UI kamu di sini (folder `/docs`), atau tempelkan GIF alur end-to-end.

## 🗺️ Roadmap
- WhatsApp auto-notify (Cloud API atau provider resmi)
- Web Push (Firebase) untuk status paket
- Label QR internal & scan di Flores
- Auth + RLS production-grade

## 🤝 Lisensi & Kredit
MIT. Dibuat untuk membantu pelaku jastip mengelola alur **alamat virtual → konsolidasi → batch DLU** dengan biaya nol.

---
**Kontak:** Leinsgreenadz@gmail.com. Untuk konsultasi implementasi produksi, silakan hubungi.
