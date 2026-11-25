# Laporan fitur workspace pribadi

Tanggal: 25 November 2026

## Ringkasan

Empat pengembangan: halaman **Hari ini**, hubungan antardokumen dengan suggestion, pembuatan task dari dokumen, dan slash command pada live editor. Menggunakan PostgreSQL, editor, task board, tema, dan shell aplikasi yang sudah ada. Tidak menambah dependency atau proses build frontend.

## 1. Hari ini

Menu **Hari ini** tersedia di sidebar dan URL `/?view=today`, termasuk `/mynotes/?view=today`.

- **Lewat Deadline:** task aktif dengan Deadline sebelum hari ini.
- **Hari ini:** task aktif dengan Deadline hari ini.
- **Sedang dikerjakan:** task dengan status yang ditandai **Dikerjakan**.
- **Fokus hari ini:** pilih maksimal tiga task aktif melalui dialog dengan pencarian.
- Klik task membuka detail task board yang sama, termasuk aturan draft dan simpan manual.
- Task selesai dan arsip tidak ditampilkan sebagai pekerjaan aktif.
- Satu task dapat tampil di beberapa bagian bila memenuhi beberapa kriteria; setiap bagian adalah sudut pandang berbeda dari data task yang sama.
- Pilihan fokus tidak mengubah Deadline, prioritas, atau status task.
- Tanggal mengikuti **Asia/Jakarta (WIB)**. Fokus dimulai kosong pada hari berikutnya; data task tetap ada. Halaman memuat ulang data saat polling workspace berjalan, sekitar 15 detik ketika tidak sedang berinteraksi dengan dialog/editor.
- Pilihan fokus tersinkron melalui database yang sama. Perubahan hari atau perubahan fokus dari perangkat lain ditolak dengan pesan konflik; gunakan **Muat ulang pilihan** sebelum menyimpan ulang.

### Status pengerjaan

Di **Task board → Kelola status**, tersedia penanda **Dikerjakan** dan **Selesai**. Keduanya saling eksklusif. Nama dan warna status tetap dapat diubah. Saat migrasi pertama, status bernama `Dikerjakan`, `Sedang dikerjakan`, atau `In progress` ditandai otomatis jika belum berstatus selesai. Setelah itu penanda dikelola manual.

## 2. Hubungan antardokumen

### Menambahkan tautan

1. Buka dokumen Markdown pada tab **Dokumen**.
2. Ketik `[[` lalu nama atau bagian path dokumen.
3. Suggestion menampilkan nama file dan path lengkap untuk membedakan nama yang sama.
4. Pilih dengan klik atau **↑ / ↓**, lalu **Enter** atau **Tab**. **Escape** menutup menu.

Tujuan dapat berupa Markdown atau PDF. Suggestion menggunakan daftar dokumen workspace setelah login, maksimal 10 hasil. Dokumen yang sedang diedit tidak ditawarkan sebagai tujuan.

Tautan disimpan sebagai Markdown biasa dengan alamat stabil berdasarkan UUID:

```markdown
[Catatan meeting.md](/share/document/<uuid-dokumen>)
```

- Rename atau pindah folder tidak memutus tautan karena UUID tetap sama.
- Live editor menampilkan nama terbaru dan membuka tautan di tab baru.
- Di **Dokumen terkait dan aksi lainnya**, bagian **Dirujuk oleh** menampilkan dokumen sumber dan **Tautan dokumen** menampilkan tujuan tautan.
- Daftar relasi diperbarui setelah isi dokumen berhasil disimpan otomatis.
- Referensi di blok kode dan inline code tidak dianggap sebagai hubungan dokumen.
- Hanya referensi dengan format stabil di atas yang masuk daftar relasi. Link Markdown lama berbasis path tetap berfungsi seperti sebelumnya, tetapi tidak otomatis diubah atau dimasukkan ke backlinks.
- Dokumen yang dihapus tidak dapat dibuka; tautan sumber tetap ada sehingga pemulihan dokumen dari Sampah dapat mengaktifkannya kembali.
- Suggestion dan daftar relasi hanya untuk pengguna login. Pengunjung yang mengikuti tautan ke dokumen privat mendapat halaman login; tidak menerima daftar workspace atau isi privat.

## 3. Dokumen menjadi task

### Dari teks pilihan

Blok teks di live editor, lalu klik **Jadikan task** pada toolbar seleksi. **Alt+Shift+F** memindahkan fokus ke toolbar setelah teks dipilih.

- Judul menggunakan baris pertama teks pilihan, maksimal 120 karakter.
- Deskripsi menggunakan teks pilihan beserta mention dokumen asal.
- Teks asli tidak dihapus atau dipindahkan.
- Batas deskripsi tetap 3.000 karakter, termasuk referensi sumber; pilihan yang terlalu panjang ditolak dengan pesan.
- Isi dokumen disimpan terlebih dahulu sebelum pindah ke task board. Konflik atau kegagalan simpan menghentikan perpindahan agar tulisan tetap tersedia.
- Form task tetap bisa diedit; task baru masuk papan setelah **Simpan task**. Draft task baru yang sudah ada harus dipulihkan atau dibuang dahulu.

### Dari slash command

Ketik `/task`, lalu pilih **Buat task**. Form task baru dibuka dengan referensi dokumen asal; judul diisi manual. Mekanisme detail task, draft, validasi, dan simpan manual menggunakan alur yang sama.

## 4. Slash command pada live editor

Ketik `/` pada awal baris untuk membuka menu, lalu lanjut mengetik untuk memfilter nama command atau keterangannya.

| Command | Hasil |
| --- | --- |
| `/task` | Membuka form task baru dengan sumber dokumen |
| `/checkbox` | Membuat checklist; sumber Markdown `- [ ] ` |
| `/h1`, `/h2`, `/h3` | Membuat heading tingkat 1, 2, atau 3 |
| `/bullet` | Membuat list bullet |
| `/number` | Membuat list bernomor |
| `/quote` | Membuat blok kutipan |
| `/code` | Membuat blok kode |
| `/table` | Menyisipkan tabel awal dua kolom |
| `/divider` | Menyisipkan garis pemisah |
| `/doc` | Memulai suggestion dokumen, sama dengan `[[` |
| `/image` | Memilih dan mengupload gambar melalui alur upload gambar dokumen |
| `/date` | Menyisipkan tanggal WIB saat ini sebagai teks biasa |

### Interaksi dan penyimpanan

- Menu menampilkan ikon, nama aksi, penjelasan singkat, dan keyword.
- **↑ / ↓** memilih, **Enter / Tab** menerapkan, **Escape** membatalkan menu.
- `/` di URL, inline code, atau blok kode tidak membuka menu command.
- Komposisi input (IME) tidak dipotong oleh navigasi menu.
- Command dan suggestion berlaku di tab **Dokumen**. Tab **Markdown** tetap menjadi editor sumber biasa.
- Checklist dokumen tidak membuat task board. Gunakan `/task` atau **Jadikan task** untuk itu.
- Perubahan format dan tautan mengikuti autosave dokumen. Pembuatan task tetap manual.
- `/image` menggunakan format PNG/JPEG/GIF/WebP, maksimal 5 MB, dan lokasi sejajar dengan file Markdown. Gambar tetap disimpan di PostgreSQL dan mirror `docs/`; tidak mengubah penyimpanan lampiran task di R2.
- Membatalkan pemilih gambar tidak melakukan upload.
- Tampilan mengikuti tema Neutral Gray dan Graphite serta pengaturan Reduced Motion.

## Penyimpanan dan API

- Kolom baru: `mdpreview.task_statuses.in_progress` (boolean).
- `mdpreview.settings`: `today_status_seeded` untuk migrasi penanda status satu kali; `today_focus` untuk tanggal, UUID task pilihan, dan token konflik fokus.
- Relasi dokumen dihitung dari link Markdown stabil di konten PostgreSQL. Tidak membuat salinan isi dokumen atau tabel relasi baru.
- API login: `GET /api/today`, `POST /api/today`, `GET /api/document-links?document=<uuid>`.
- Resolver: `GET /share/document/:id`, memeriksa keberadaan dan izin akses sebelum mengarahkan ke path terbaru.
- Semua endpoint mengikuti mount root dan `/mynotes`.
- Tidak mengimpor, menulis, atau menyinkronkan file `docs/` secara manual. Mirror tetap mengikuti mekanisme aplikasi.

## Pemeriksaan dan deployment

- Sudah diterapkan ke homeserver; proses PM2 `md-previewer` direstart dan disimpan, PID `924156`.
- Kedua alamat merespons HTTP 200: `https://itsazmi.com/mynotes/` dan `https://mdpreview.azmirf.my.id/`.
- Versi aset aktif `7a36d0e93214`; 15 aset frontend yang berubah cocok dengan file lokal pada kedua alamat.
- Migrasi kolom `in_progress` dan penanda migrasi satu kali terkonfirmasi di PostgreSQL.
- Fingerprint isi sebelum dan sesudah deployment tetap sama: 147 entri dokumen/folder/aset dan 8 task. Angka mencakup seluruh entri database, bukan hanya file Markdown.
- Endpoint workspace, task board, Hari ini, dan relasi dokumen tetap mengembalikan HTTP 401 tanpa login. Resolver UUID tidak valid mengembalikan 404.
- Pemeriksaan sintaks 20 file JavaScript dan `git diff --check` selesai tanpa error. Review kode memperbaiki pengecualian root editor `PRE`, token fokus saat polling bersamaan, dan batas tiga pilihan setelah gagal simpan.
- Preview terisolasi memakai data contoh di memori, tema terang/gelap, serta lebar 1440 dan 390 piksel. Alur menu command, heading, suggestion PDF, sumber Markdown tautan, dan `/task` diperiksa tanpa menulis data pengguna.
- Self-check terisolasi memastikan referensi di kode tidak dianggap backlink, UUID tautan dinormalisasi, fokus mengecualikan task selesai/arsip, dan penyimpanan menolak hari/token lama, task tidak aktif, duplikat, serta lebih dari tiga pilihan. Tidak menggunakan database produksi.
- Backup kode sebelum deployment: `/home/azmirf/backups/md-previewer/productivity-code-20261125T071523Z`.

Belum diperiksa melalui sesi passkey pengguna di browser produksi atau perangkat fisik. Tidak menjalankan suite pengujian aplikasi. Relasi dokumen masih dihitung dari kandidat konten saat dibuka; bila jumlah dokumen berkembang besar, pertimbangkan indeks relasi.

Tidak ada commit/push yang diminta pada pekerjaan ini. Perubahan sebelumnya tetap dipertahankan.
