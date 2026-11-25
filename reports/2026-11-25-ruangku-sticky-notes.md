# Ruangku dan Sticky notes

## Perubahan identitas dan navigasi

- Nama aplikasi menjadi **Ruangku** di sidebar, judul tab, login, halaman publik, dan label registrasi passkey baru.
- Ikon identitas dan favicon menjadi **R**. Favicon memakai URL aset berversi agar perubahan terlihat setelah aplikasi dimuat ulang.
- Urutan menu: **Hari ini → Workspace → Task board → Sticky notes → Terakhir dibuka**.
- Pencarian tetap satu grup dengan header. Keluar berada di bawah Keamanan dalam area menu yang di-scroll.
- RP ID, domain, sesi, credential passkey, nama proses PM2, dan alamat deployment tetap kompatibel.

## Sticky notes

Halaman `?view=sticky` memakai canvas dari mockup di dalam shell Neutral Gray / Graphite yang sudah dipakai aplikasi.

- Tambah dan edit judul/isi langsung; autosave setelah berhenti mengetik selama 800 ms.
- Geser kartu melalui pegangan; resize melalui sudut kanan bawah. Pegangan juga mendukung tombol panah dan Shift + panah.
- Enam warna: Kuning, Sage, Rose, Biru, Lilac, dan Stone, dengan pasangan warna untuk Graphite.
- Duplikat, hapus, dan urungkan penghapusan selama 10 detik.
- Cari judul/isi, geser canvas, zoom 10–150%, tampilkan semua, dan rapikan posisi dengan urungkan.
- Panduan penggunaan, kondisi kosong, pencarian kosong, memuat, serta kegagalan jaringan tersedia.
- Mendukung menu keyboard, fokus, layar kecil, dan reduced motion.

## Penyimpanan dan sinkronisasi

- PostgreSQL menyimpan satu canvas pribadi pada `mdpreview.sticky_board`: `id`, `revision`, `notes` (JSONB), dan `modified`.
- Tidak ada data contoh yang dimasukkan ke DB. Canvas baru mulai kosong.
- Maksimal 100 catatan; judul 120 karakter dan isi 10.000 karakter per catatan.
- Ukuran canvas 2300 × 1550 px. Ukuran catatan 240–700 × 210–800 px.
- `GET /api/sticky-notes` membaca canvas; `POST /api/sticky-notes` menyimpan snapshot dengan revisi yang diharapkan. Keduanya memerlukan sesi login. Penulisan mengikuti pemeriksaan origin dan transaksi aplikasi.
- Revisi yang sudah berubah menghasilkan HTTP 409. Perubahan lokal tetap tampil, tersedia Unduh salinan (JSON), dan Muat versi server dengan konfirmasi. Konflik tidak digabung otomatis.
- Sinkronisasi dibaca lewat refresh workspace setiap 15 detik ketika halaman aktif dan tidak sedang diedit. Edit yang belum tersimpan tidak ditimpa hasil refresh.
- Pindah halaman/logout ditahan saat perubahan belum tersimpan atau sedang disimpan. Browser meminta konfirmasi sebelum meninggalkan perubahan yang belum tersimpan.
- Audit `STICKY_NOTES_SAVE` mencatat jumlah catatan, tanpa isi catatan.

## Review dan batas

- Sintaks 13 berkas JavaScript dan empat template EJS dikompilasi; pemeriksaan whitespace diff bersih.
- Preview terisolasi dengan API memori pada 1440, 1024, 760, dan 390 px, tema Terang dan Graphite; tidak ada overflow halaman atau exception JavaScript yang tercatat.
- Preview mencatat tambah/edit, warna, drag/resize, duplikat, hapus/urungkan, dan persistence setelah refresh. Preview tidak menyentuh DB aplikasi.
- Review kode independen selesai. Perbaikan mencakup guard navigasi setelah request dokumen, perlindungan jalur upload, serialisasi save/reload, pemeriksaan edit selama reload, dan pembersihan Undo saat memakai versi server.
- Tidak menjalankan suite pengujian aplikasi atau interaksi terautentikasi di production. Belum diperiksa pada perangkat fisik, Safari/Firefox, atau screen reader.
- Catatan berupa teks biasa; tidak mendukung attachment, Markdown, atau mention. Canvas terbatas, bukan infinite canvas. Penumpukan saat memilih kartu bersifat sementara.
- Salinan JSON merupakan ekspor pemulihan; belum ada fitur impor. Jangan tutup halaman saat simpan gagal sebelum mengunduh salinan atau menyelesaikan konflik.
- Tidak mengubah isi dokumen, task, R2, atau konfigurasi nginx.

## Deployment

- Diterapkan ke homeserver pada 25 November 2026; PM2 `md-previewer` direstart dan disimpan, PID 953464.
- Kedua alamat root legacy dan `itsazmi.com/mynotes/` merespons 200 dengan nama/urutan menu yang sesuai; 12 aset per alamat cocok dengan hash source, versi `90a9b272079c`.
- API workspace, task board, dan sticky notes tetap menolak akses anonim dengan 401.
- Tabel `mdpreview.sticky_board` siap pada DB bersama, revisi 1 dengan 0 catatan saat deploy. Tidak memasukkan data contoh.
- Fingerprint 147 entri dan 8 task sebelum/sesudah deployment sama.
- Backup kode: `/home/azmirf/backups/md-previewer/ruangku-code-20261125T081120Z`.
- Belum commit/push pada pekerjaan ini.
