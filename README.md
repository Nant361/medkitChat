# Medikit Chat (Node.js + React)

Aplikasi telemedicine berbasis chat dengan opsi asisten AI untuk edukasi awal keluhan pasien.
Keputusan akhir tetap oleh dokter, dan seluruh riwayat konsultasi disimpan.

## Fitur Utama
- Chat jarak jauh pasien dan dokter dengan pembaruan berkala (polling).
- Opsi AI edukasi awal sebelum konsultasi dokter (tanpa diagnosis).
- Riwayat konsultasi per pasien dan status (menunggu, dibalas dokter, selesai).
- Label khusus untuk jawaban AI dan jawaban resmi dokter.

## Teknologi
- Backend: Node.js, Express, Supabase (Postgres)
- Frontend: React (Vite)

## Menjalankan Aplikasi

1. Siapkan database Supabase:
   - Jalankan SQL schema di `docs/supabase.sql` melalui Supabase SQL editor.
   - Pastikan project URL dan service role key tersedia.

2. Install dependensi:

```bash
npm install
```

3. Jalankan aplikasi (server + client):

```bash
npm run dev
```

- Server: `http://localhost:3001`
- Client: `http://localhost:5173`
- Konfigurasi dev client ada di `client/.env.development`

## Deploy ke Vercel (satu project)
1. Push repo ke GitHub/GitLab.
2. Import ke Vercel.
3. Set Build Command: `npm run build`
4. Set Output Directory: `client/dist`
5. Tambahkan Environment Variables di Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLIENT_ORIGIN` (isi domain Vercel, mis. `https://medikit-chat.vercel.app`)
   - `GEMINI_API_KEY` (opsional)
   - `GEMINI_MODEL` (opsional)
6. `VITE_API_URL` tidak perlu di-set di Vercel (biarkan kosong agar memakai `/api` di domain yang sama).
7. Endpoint API otomatis tersedia di `/api` melalui Vercel Functions.

## Akun Demo
- Dokter: `drmaya` / `dokter123` (Spesialis Penyakit Dalam)
- Dokter: `drandi` / `dokter123` (Spesialis Anak)
- Dokter: `drsiti` / `dokter123` (Spesialis Kebidanan dan Kandungan)
- Dokter: `drrafi` / `dokter123` (Spesialis Kulit dan Kelamin)
- Dokter: `drnia` / `dokter123` (Spesialis THT)
- Dokter: `drbudi` / `dokter123` (Spesialis Mata)
- Dokter: `drintan` / `dokter123` (Spesialis Saraf)
- Dokter: `drdimas` / `dokter123` (Spesialis Jantung)
- Dokter: `drlaila` / `dokter123` (Spesialis Bedah)
- Dokter: `drrizky` / `dokter123` (Spesialis Ortopedi)
- Pasien: `ayu` / `pasien123`
- Pasien: `bima` / `pasien123`

## Struktur Data
- `users`: pasien dan dokter
- `consultations`: status dan waktu konsultasi
- `messages`: pesan pasien, AI, dan dokter

Lihat detail model di `docs/models.md`.

## Catatan AI
- AI hanya memberikan edukasi umum, bukan diagnosis.
- Aturan respons aman ada di `server/ai.js`.
- Jika `GEMINI_API_KEY` diisi, sistem memakai Gemini API. Jika kosong, fallback ke respons lokal berbasis aturan.

## Environment Variables (opsional)
- `PORT`: port server (default `3001`)
- `CLIENT_ORIGIN`: origin client untuk CORS (default `http://localhost:5173`, bisa dipisah koma)
- `VITE_API_URL`: base URL API di sisi client (kosongkan agar pakai `/api` di domain yang sama)
- `GEMINI_API_KEY`: API key Google Gemini (aktifkan AI API)
- `GEMINI_MODEL`: model Gemini (default `gemini-1.5-flash`)
- `SUPABASE_URL`: URL project Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: service role key Supabase (untuk akses server-side)
