# Memori

Album foto berbasis web dengan autentikasi Supabase, role pengguna dan administrator, pengelolaan memori khusus admin, serta dukungan PWA.

## Menjalankan lokal

Layani folder ini melalui HTTP atau HTTPS (service worker tidak berfungsi melalui `file://`). Contoh:

```powershell
python -m http.server 8000
```

Buka `http://localhost:8000`.

## Menyiapkan Supabase

1. Buat proyek Supabase dan jalankan `data.sql` di SQL Editor.
2. Aktifkan autentikasi email/kata sandi.
3. Daftarkan akun pengguna pertama, lalu promosikan akun admin dari SQL Editor. Hanya admin yang dapat menambah memori:

   ```sql
   UPDATE public.users
   SET role = 'admin'
   WHERE email = 'admin@contoh.com'
     AND auth_user_id IS NOT NULL;
   ```

4. Tambahkan domain produksi dan domain preview Vercel ke URL konfigurasi Auth Supabase.

Setelah pembaruan tabel galeri atau galeri multi-foto, jalankan kembali `data.sql` agar tabel `galleries`, kolom `gallery_id`, izin, bucket `photos`, dan cache schema PostgREST diperbarui. Foto baru disimpan di bucket `photos`; bucket `memories` tetap tersedia untuk foto lama. Tab galeri dirender dinamis dari tabel `galleries`; admin dapat menambah galeri baru dan mengganti nama tab lewat **Panel admin → Galeri**. Setiap tab memiliki pencarian dan urutan A–Z berdasarkan nama, judul, atau caption.

Tab **Biodata** (galeri dengan nama `Biodata` atau slug `biodata`/`individu`) menampilkan data individu lengkap: nama, tanggal acara/TTL, alamat lengkap, caption, Instagram, dan WhatsApp, dengan filter daerah. Admin dapat menambah satu data secara manual atau mengimpor banyak baris dari Excel/CSV; tombol **Unduh template Excel** menyediakan kolom Nama, Tanggal acara/TTL, Daerah/Alamat, Caption, Instagram, dan WhatsApp. Foto individu memakai placeholder dan dapat diganti lewat Edit.

Tab lain hanya berisi album: pilih galeri tujuan, unggah hingga 20 foto, lalu isi judul dan caption. Kartu dan detail album hanya menampilkan judul, caption, dan foto. RLS membatasi perubahan data hanya untuk admin. Informasi galeri terlihat oleh semua pengguna yang masuk.

Migrasi pertama mereset role lama menjadi `user` karena versi demo sebelumnya mengizinkan perubahan role dari browser. Migrasi juga mengganti policy RLS pada tabel aplikasi `users`, `memories`, dan `activity_logs`.

Supabase URL dan anon key di `app.js` memang digunakan oleh browser. Jangan pernah memasukkan `service_role` key atau kredensial rahasia ke kode klien; akses data dibatasi oleh RLS.

## Deploy ke Vercel

Proyek ini berupa situs statis tanpa proses build:

1. Impor repository GitHub ini ke Vercel.
2. Pilih preset **Other** dan biarkan Build Command serta Output Directory kosong/default.
3. Deploy. Setiap push ke branch `main` akan memicu deployment baru.

Vercel menyediakan HTTPS yang dibutuhkan agar PWA dan service worker berfungsi. Aplikasi memeriksa versi shell secara berkala dan saat tab kembali aktif; jika ada perubahan, tombol **Perbarui sekarang** akan mengaktifkan versi baru lalu memuat ulang aplikasi.
