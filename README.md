# MD Previewer

Workspace Markdown dengan Express, EJS, JavaScript biasa, dan PostgreSQL. Tidak ada build frontend. Tampilan memakai Inter, tema terang/sistem, dan dark mode Graphite.

## Fitur

- Navigasi folder dan breadcrumb, favorit, serta 50 dokumen terakhir dibuka.
- Edit langsung dengan render otomatis pada tab Dokumen, serta tab sumber Markdown yang tersinkron. Draft disimpan otomatis; Simpan atau Ctrl+S menerbitkan perubahan.
- Syntax highlighting, daftar isi, dan link ke heading.
- Pencarian judul, path, dan isi dokumen dengan PostgreSQL full-text search.
- Buat folder/dokumen, rename, pindahkan, unduh, dan upload Markdown dengan konfirmasi nama/isi.
- Akses publik/privat, URL path asli, serta kompatibilitas link lama `/share/:id`.
- Sampah dengan pemulihan dan hapus permanen, riwayat versi dengan preview/pemulihan.
- Autosave draft privat dengan deteksi konflik antarperangkat dan dialog pemulihan.
- Template dokumen yang bisa dibuat, diedit, dan digunakan kembali.
- Aktivitas workspace dan session login tersimpan di PostgreSQL.

Login memakai satu kode akses bersama. Favorit, riwayat bacaan, tema, template, dan draft menjadi milik **workspace bersama**, belum per akun. Favorit/riwayat browser lama dapat diimpor sekali lewat sidebar setelah login. Pengunjung publik hanya mendapat dokumen yang dibuka; tema pengunjung disimpan pada browsernya.

## Persyaratan

- Node.js 20 atau lebih baru dan npm.
- PostgreSQL 14 atau lebih baru yang dapat dijangkau aplikasi.
- Hak membuat schema/tabel pada database. Hak `CREATEDB` diperlukan jika database belum dibuat.
- Hak tulis pada `docs/`, `.data/`, dan `uploads/`.
- Tailscale aktif jika host DB menggunakan alamat jaringan Tailscale.

Font Inter disertakan di `public/fonts/` dengan lisensi pada `OFL-Inter.txt`.
Editor Vditor disajikan dari dependency npm di server yang sama, tanpa build frontend atau CDN pihak ketiga.

## Instalasi

```sh
git clone <url-repository> md-previewer
cd md-previewer
npm ci
cp .env.example .env
```

Di PowerShell, gunakan `Copy-Item .env.example .env`. Isi `.env`:

```dotenv
PORT=8026
JSON_BODY_LIMIT=5mb
ACCESS_CODE_HASH='<bcrypt hash kode akses>'
SESSION_SECRET='<secret acak yang tetap>'
DB_HOST=<host PostgreSQL>
DB_PORT=5432
DB_USER=<role PostgreSQL>
DB_PASSWORD='<password>'
DB_NAME=<nama database>
```

Buat hash kode akses dan secret:

```sh
node -e "require('bcrypt').hash('ganti-kode-akses',12).then(console.log)"
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
npm run db:setup
```

Perintah setup mengecek koneksi dan hak schema/tabel, serta membuat database bila belum tersedia. Tidak mengimpor dokumen. Jangan masukkan `.env`, `.data/`, atau isi `docs/` ke Git.

### Migrasi pertama dari server

Hentikan aplikasi lama agar snapshot konsisten. Backup seluruh aplikasi dan metadata akses sebelum migrasi. Siapkan snapshot privat berisi:

```text
snapshot/
  docs/              # seluruh dokumen/aset server
  file-access.json   # salinan .data/file-access.json server
```

Metadata wajib tersedia agar pengaturan privat dan share ID lama tetap utuh. Bila aplikasi sumber memang belum pernah memiliki metadata akses, buat `{}` secara eksplisit setelah memastikan keadaan itu. Dokumen tanpa record akses mengikuti perilaku lama: publik. Dokumen baru dari aplikasi dimulai privat.

```sh
node scripts/import-server-docs.js --server-snapshot /lokasi/snapshot
```

Import berjalan dalam satu transaksi dan menolak database yang sudah berisi workspace. Symlink, path berbahaya, perbedaan kapitalisasi yang bertabrakan, serta Markdown non-UTF-8/NUL ditolak. Untuk lokal dan homeserver yang memakai DB sama, import **sekali dari snapshot homeserver**. Lokal tidak mengimpor dokumennya sendiri.

## Menjalankan

```sh
npm start
```

Buka `http://localhost:8026`. Untuk pengembangan:

```sh
npm run dev
```

Nodemon mengabaikan `docs/`, `.data/`, dan `uploads/` agar sinkronisasi tidak memicu restart berulang. Setelah database sudah diimpor, salinan aplikasi lain cukup memakai lima credentials DB yang sama dan menjalankan aplikasi.

## Penyimpanan dan sinkronisasi

**PostgreSQL adalah sumber utama isi dokumen dan metadata.** `docs/` merupakan salinan untuk akses filesystem lokal, diperbarui saat startup, setelah perubahan lokal, dan setiap sekitar 5 detik. Browser yang sedang membaca memuat perubahan perangkat lain setiap sekitar 15 detik; editor aktif tidak ditimpa otomatis.

Backup isi `docs/` lokal sebelum mengaktifkan migrasi. File lokal yang belum terdaftar tidak otomatis diimpor. Edit langsung pada file mirror yang terdaftar akan ditimpa oleh DB; lakukan perubahan lewat aplikasi. Untuk sinkronisasi manual:

```sh
npm run docs:sync
```

Aplikasi menolak startup bila DB belum diimpor atau tidak tersedia. Kegagalan mirror dicatat dan dicoba lagi; perubahan yang sudah tersimpan di DB tetap aman. Jangan sajikan `docs/` langsung lewat nginx karena akan melewati pemeriksaan akses.

`docs/steering` dan `docs/superpowers` disembunyikan dari listing/pencarian/favorit. Akses URL langsung tetap mengikuti status publik/privat dokumen. Hidden files tidak disajikan.

## Berbagi, konflik, dan pemulihan

- Menu Bagikan menghasilkan path asli, misalnya `/proyek/catatan.md`. URL mengikuti domain/prefix yang dibuka.
- File privat meminta login. File di sampah tidak dapat dibuka melalui URL publik atau share ID lama.
- Move/rename mempertahankan ID, favorit, akses, dan riwayat. URL path berubah; link `/share/:id` tetap berlaku selama file publik.
- Simpan memerlukan revisi dan token draft yang cocok. Konflik mempertahankan tulisan di editor; salin/unduh sebelum memuat ulang.
- Draft bukan versi publik. Saat pemulihan draft belum diselesaikan, editor meminta pemulihan atau pembuangan secara eksplisit. Draft dari revisi lama dapat disalin/diunduh untuk digabungkan.
- Pemulihan riwayat membuat revisi baru. Selesaikan draft yang masih tersimpan sebelum memulihkan versi.
- Dialog riwayat menampilkan 100 versi terbaru; versi lebih lama tetap disimpan di DB.
- Restore sampah tidak menimpa path aktif yang sama. Pulihkan folder induk terlebih dahulu jika diperlukan.
- Hapus permanen menghapus isi, draft, dan riwayat item tersebut.

## Deploy dengan PM2

Pasang dependencies, isi `.env`, dan lakukan import pertama sebelum mengaktifkan versi baru:

```sh
npm ci --omit=dev
pm2 start server.js --name md-previewer
pm2 save
```

Untuk deployment berikutnya:

```sh
npm ci --omit=dev
pm2 restart md-previewer
pm2 save
```

Gunakan `NODE_ENV=production` di balik HTTPS proxy. Pertahankan `SESSION_SECRET` agar session PostgreSQL tetap dapat dipakai setelah restart. Session berlaku 30 menit; domain/prefix berbeda memiliki cookie login masing-masing.

## Nginx dan Cloudflare Tunnel

Contoh konfigurasi: `nginx/mdpreview.conf`. Node memakai 8026, nginx origin memakai `127.0.0.1:8027`. Domain lama `mdpreview.azmirf.my.id` tetap melayani root. Domain `itsazmi.com` melayani `/mynotes/` tanpa menghapus prefix; `/mynotes` diarahkan ke slash.

Cloudflare published application:

| Input | Nilai |
| --- | --- |
| Domain | `itsazmi.com` |
| Subdomain | kosong |
| Path | `^/mynotes(/.*)?$` |
| Service URL | `http://localhost:8027` |

Letakkan rule ini sebelum rule `itsazmi.com` tanpa path. Samakan batas body nginx dengan kebutuhan upload/JSON aplikasi. Portfolio di port 8002 tidak perlu diubah.

## Backup

Backup PostgreSQL dengan `pg_dump`, serta simpan `.env` secara privat. Backup `docs/` saja tidak mencakup akses privat, draft, sampah, riwayat, atau session. Database menyimpan semuanya, termasuk isi yang sudah dipindahkan ke sampah. Lindungi backup dengan hak akses terbatas. Jadwal dan retensi backup mengikuti pengelolaan server.

## Struktur kode

| File | Fungsi |
| --- | --- |
| `server.js` | Auth/session, rendering, mount root dan prefix |
| `workspace-routes.js` | API dan akses dokumen |
| `database.js`, `db/schema.sql` | Transaksi dan penyimpanan workspace |
| `document-path.js`, `document-sync.js` | Validasi path dan mirror filesystem |
| `scripts/` | Setup DB, import server, sinkronisasi dan pemeriksaan terisolasi |
| `views/layout.ejs` | Shell dan dialog |
| `public/app.js`, `public/workspace-tools.js` | Navigasi dan fitur browser |

## Kendala umum

Pemeriksaan regresi terisolasi tersedia di `node scripts/check-sharing.cjs`. Script membuat database sementara dengan nama acak, memeriksa storage/konflik/privacy/prefix melalui aplikasi terpisah, lalu menghapus database sementara itu. Role memerlukan `CREATEDB`; script tidak memakai dokumen workspace aktif. Jalankan hanya ketika ingin melakukan pemeriksaan.

- **Koneksi DB gagal:** cek Tailscale, host/port, credentials, serta hak role PostgreSQL.
- **Workspace belum diimpor:** jalankan import satu kali dari snapshot server yang lengkap.
- **Port sudah dipakai:** hentikan proses aplikasi sebelumnya sebelum menjalankan proses baru.
- **Konflik dokumen/draft:** salin tulisan, muat versi terbaru, lalu gabungkan perubahan.
- **Mirror tertinggal:** cek log dan izin filesystem, lalu jalankan `npm run docs:sync`.
- **Login gagal setelah pindah domain:** login pada domain yang sedang dibuka.
- **413:** sesuaikan `JSON_BODY_LIMIT` dan `client_max_body_size`; upload file dibatasi 5 MB.
