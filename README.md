# MD Previewer

Workspace Markdown dengan Express, EJS, JavaScript biasa, dan PostgreSQL. Tidak ada build frontend. Tampilan memakai Inter, tema terang/sistem, dan dark mode Graphite.

## Fitur

- Navigasi folder dan breadcrumb, favorit, serta 50 dokumen terakhir dibuka.
- Edit langsung dengan render otomatis pada tab Dokumen, serta tab sumber Markdown yang tersinkron. Di dalam list pada tab Dokumen, Tab membuat item menjadi sublist dan Shift+Tab mengembalikannya satu tingkat. Perubahan otomatis disimpan ke dokumen sekitar 1–2 detik setelah berhenti mengetik; Simpan atau Ctrl+S tetap bisa digunakan untuk langsung menyimpan. File publik otomatis ikut diperbarui.
- Syntax highlighting, daftar isi, dan link ke heading.
- Dokumen publik untuk guest memiliki daftar isi dari heading dokumen dengan penanda aktif saat klik/scroll. Sidebar tetap terlihat di desktop; pada layar kecil, daftar isi pindah ke atas dokumen. Dokumen tanpa heading memakai lebar baca penuh tanpa sidebar kosong.
- Pencarian judul, path, dan isi dokumen dengan PostgreSQL full-text search.
- Buat folder/dokumen, rename, pindahkan, unduh, dan upload Markdown dengan konfirmasi nama/isi.
- Klik judul file pada halaman dokumen untuk mengganti nama, lalu klik **Simpan nama**. Nama tidak mengikuti autosave isi dokumen; **Batal** atau Escape membatalkan. Klik di luar kolom tidak menyimpan. Rename mengubah URL path file; pengaturan akses dan link lama `/share/:id` tetap tersimpan.
- Akses publik/privat, URL path asli, serta kompatibilitas link lama `/share/:id`.
- Sampah dengan pemulihan dan hapus permanen, riwayat versi dengan preview/pemulihan.
- Autosave dokumen dengan status penyimpanan, draft pemulihan, dan deteksi konflik antarperangkat.
- Template dokumen yang bisa dibuat, diedit, dan digunakan kembali.
- Aktivitas workspace dan session login tersimpan di PostgreSQL.

Login memakai passkey dengan pusat autentikasi di `https://itsazmi.com/mynotes` (RP ID `itsazmi.com`). Domain lama dan lokal membuka pusat login melalui popup, kemudian menerima session masing-masing melalui handoff sekali pakai. Favorit, riwayat bacaan, tema, template, dan draft menjadi milik **workspace bersama**, belum per akun. Favorit/riwayat browser lama dapat diimpor sekali lewat sidebar setelah login. Pengunjung publik hanya mendapat dokumen yang dibuka; tema pengunjung disimpan pada browsernya.

## Persyaratan

- Node.js 22 atau lebih baru dan npm (server dan lokal saat ini Node.js 24).
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
HOST=127.0.0.1
JSON_BODY_LIMIT=5mb
ACCESS_CODE_HASH='<bcrypt hash kode akses>'
PASSKEY_AUTH_URL=https://itsazmi.com/mynotes
PASSKEY_APP_URLS=https://itsazmi.com/mynotes,https://mdpreview.azmirf.my.id,https://mdpreview.azmirf.my.id/mynotes,http://localhost:8027,http://localhost:8027/mynotes
SESSION_SECRET='<secret acak minimal 32 byte yang tetap>'
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

`SESSION_SECRET` wajib tersedia untuk seluruh mode; aplikasi menolak startup jika kosong, hanya spasi, atau kurang dari 32 byte UTF-8. Panjang bukan jaminan keacakan: gunakan generator di atas. Secret yang sudah kuat tidak perlu diganti; menggantinya akan membuat cookie login lama tidak berlaku.

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

Listener default hanya `127.0.0.1`. `HOST` dapat diubah bila memang memerlukan interface lain; akses langsung jaringan harus dibatasi firewall. Di balik nginx setempat, pertahankan `HOST=127.0.0.1`. Aplikasi hanya mempercayai forwarded headers dari peer loopback, sesuai contoh nginx yang meneruskan ke loopback.

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
- Autosave dan Simpan memakai alur yang sama: tulis draft, lalu simpan dokumen dengan revisi dan token draft yang cocok. Riwayat versi ikut diperbarui. Konflik menghentikan autosave dan mempertahankan tulisan di editor; salin/unduh sebelum memuat ulang. Tunggu status **Semua perubahan tersimpan** sebelum menutup halaman. Kegagalan jaringan/server dicoba ulang setelah 5 detik; login ulang melanjutkan penyimpanan tulisan yang tertunda.
- Draft bukan versi publik. Saat pemulihan draft belum diselesaikan, editor meminta pemulihan atau pembuangan secara eksplisit. Draft dari revisi lama dapat disalin/diunduh untuk digabungkan.
- Pemulihan riwayat membuat revisi baru. Selesaikan draft yang masih tersimpan sebelum memulihkan versi.
- Dialog riwayat menampilkan 100 versi terbaru; versi lebih lama tetap disimpan di DB.
- Restore sampah tidak menimpa path aktif yang sama. Pulihkan folder induk terlebih dahulu jika diperlukan.
- Hapus permanen menghapus isi, draft, dan riwayat item tersebut.

## Autentikasi passkey

### Pendaftaran dan pengelolaan passkey

1. Buka `https://itsazmi.com/mynotes/`. Sebelum ada passkey, kode akses lama hanya memberi izin pendaftaran pertama selama 5 menit; kode tersebut tidak membuka workspace.
2. Isi kode, beri nama perangkat, lalu daftarkan passkey melalui biometrik, PIN perangkat, password manager atau security key. Setelah berhasil, kode akses tidak lagi bisa dipakai untuk masuk atau mendaftarkan perangkat.
3. Login berikutnya memakai tombol **Masuk dengan passkey**. Untuk domain lama/lokal, izinkan popup pusat login, periksa alamat tujuan yang ditampilkan, lalu verifikasi passkey. Halaman asal tetap terbuka sehingga draft/editor tidak hilang.
4. Buka **Pengelolaan → Keamanan** untuk menambah passkey cadangan, mengganti nama atau mencabut perangkat. Penambahan dilakukan pada pusat login. Perubahan keamanan membutuhkan verifikasi passkey dalam 5 menit terakhir; gunakan **Verifikasi ulang** jika diminta. Passkey terakhir tidak dapat dicabut. Pencabutan mengakhiri sesi yang menggunakan passkey tersebut pada request berikutnya.

Data kredensial publik disimpan di `mdpreview.passkeys`; private key tetap berada pada authenticator/password manager. Challenge dan handoff sementara memakai `auth_challenges`/`auth_bridges`, terikat ke session serta alamat aplikasi, dibatasi masa berlaku dan dikonsumsi sekali. Popup mengirim rahasia penyelesaian baru ke jendela asal melalui `postMessage`; penerima memeriksa origin, jendela pengirim dan token permintaan. Token tautan saja tidak dapat diklaim untuk login. Server memeriksa signature, RP ID, origin dan user verification. Endpoint login kode lama mengembalikan 410; session lama perlu masuk lagi dengan passkey.

**Jika semua perangkat hilang**, dari root project pada terminal homeserver jalankan:

```sh
npm run auth:recover
```

Buka URL privat yang dicetak untuk menambahkan passkey pengganti. Token berlaku 15 menit, hanya bisa digunakan sekali, dan penerbitan token baru membatalkan token lama. Jangan bagikan atau commit URL itu. Pemulihan tidak menghapus passkey lama maupun dokumen; setelah masuk, cabut perangkat yang hilang dari halaman Keamanan.

`PASSKEY_AUTH_URL` dan daftar `PASSKEY_APP_URLS` harus sama di server/lokal yang berbagi DB. Daftar menggunakan **URL aplikasi lengkap termasuk prefix dan port**, tanpa trailing slash; origin lain tidak dapat membuat/menukar handoff. Lokal default `http://localhost:8027`; HTTPS wajib untuk alamat lain. Untuk lingkungan dev terpisah, gunakan database terpisah dan pusat login `http://localhost:<port>`. Mengganti hostname RP setelah mendaftarkan passkey memerlukan pendaftaran baru. Login dari domain lama/lokal membutuhkan pusat login online.

Library browser disajikan dari npm lokal pada `/static/passkeys/<version>/`; tidak bergantung CDN atau Related Origin Requests. Cookie session otomatis memakai Secure pada HTTPS; `NODE_ENV=production` mewajibkan Secure untuk seluruh request.

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

Gunakan `NODE_ENV=production` di balik HTTPS proxy. Pertahankan `SESSION_SECRET` agar session PostgreSQL tetap dapat dipakai setelah restart. Cookie dan session berlaku 7 hari dan diperpanjang pada setiap request session (rolling session); polling workspace setiap 15 detik juga memperbaruinya selama halaman terbuka dan terhubung. Setelah tidak ada request selama 7 hari, login kembali diperlukan. Session lama menyimpan durasi sebelumnya; keluar lalu masuk sekali untuk mendapatkan durasi 7 hari. Verifikasi perubahan passkey tetap dibatasi 5 menit sejak autentikasi. Domain/prefix berbeda memiliki cookie login masing-masing.

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

Gunakan `pg_dump --format=custom --no-owner --no-privileges` dengan client yang versinya minimal sama dengan PostgreSQL server. Simpan dump dan `.env` dengan izin `0600` di direktori `0700`. Verifikasi dengan `pg_restore --exit-on-error --no-owner --no-privileges` ke database kosong yang terpisah; jangan arahkan restore ke database aktif. Periksa tabel/jumlah entri dan simpan checksum dump. Backup pada disk server yang sama masih perlu salinan di lokasi terpisah.

## Struktur kode

| File | Fungsi |
| --- | --- |
| `server.js` | Entry point untuk npm dan PM2 |
| `src/backend/app.js`, `start.js` | Susunan middleware/router dan startup/shutdown |
| `src/backend/config/` | Konfigurasi environment dan path root project |
| `src/backend/database/` | Pool PostgreSQL, transaksi, schema, inisialisasi dan audit |
| `src/backend/middleware/` | Session, pemeriksaan autentikasi/origin dan penanganan error |
| `src/backend/modules/` | Fitur auth, documents, workspace, templates dan activity |
| `src/backend/modules/documents/` | Penyimpanan dokumen, path, mirror, Markdown, draft, riwayat, sampah dan router |
| `src/backend/rendering/` | Rendering halaman dan helper HTTP |
| `src/frontend/views/` | Shell EJS dan partial sidebar, topbar, ikon serta dialog |
| `src/frontend/public/js/` | Entry `main.js`, core, components dan modul fitur browser |
| `src/frontend/public/css/` | Entry `main.css` dan stylesheet sesuai bagian UI, dengan urutan cascade dipertahankan |
| `src/frontend/public/fonts/`, `favicon.svg` | Aset Inter dan favicon |
| `scripts/` | Operasional setup DB, import server dan sinkronisasi mirror |
| `tests/` | Pemeriksaan terisolasi dan helper import modul frontend |
| `mockups/` | Referensi mockup HTML |

Backend tetap CommonJS; frontend memakai ES Modules native tanpa build step. `main.js` menghubungkan state, modul fitur dan event delegation melalui `data-action`, tanpa fungsi aplikasi di `window` atau handler HTML inline. CSS dan modul JS disajikan melalui `/static/v/<hash>/`; import relatif mewarisi versi tersebut agar cache browser tidak mencampur modul dari deployment berbeda. Mount root dan `/mynotes/` memakai struktur aset yang sama.

`.env`, `docs/`, `uploads/` dan `.data/` tetap berada di root project. Pemindahan kode tidak mengubah nama tabel, URL API atau format data PostgreSQL.

## Kendala umum

Pemeriksaan regresi terisolasi tersedia di `node tests/check-sharing.cjs`. Script membuat database sementara dengan nama acak, memeriksa storage/konflik/privacy/prefix dan konsumsi challenge/handoff melalui aplikasi terpisah, lalu menghapus database sementara itu. Role memerlukan `CREATEDB`; script tidak memakai dokumen workspace aktif. Pemeriksaan konfigurasi passkey tersedia di `node tests/check-passkey.cjs`. Pemeriksaan dialog tersedia di `node tests/check-delete-dialog.cjs` dan `node tests/check-upload-dialog.cjs`; keduanya memakai modul frontend dengan mock DOM. Script tidak menggantikan verifikasi passkey memakai perangkat nyata. Jalankan hanya ketika ingin melakukan pemeriksaan.

`tests/check-runtime-config.cjs` memeriksa penolakan secret lemah, listener dan trust proxy. `tests/check-passkey-flow.cjs` memakai authenticator software ES256 untuk pendaftaran, signature, origin/RP ID, UV, counter, bridge, expiry/replay, step-up dan recovery. Tes flow menulis credential dummy ke DB fixture: jalankan **hanya** pada container disposable tanpa jaringan eksternal, tanpa `.env` aktual, dengan PostgreSQL loopback di namespace yang sama. Guard mengharuskan `MDPREVIEW_TEST_ISOLATED=1`, `DB_HOST=127.0.0.1`, `DB_USER=fixture`, dan `DB_NAME=postgres`; flag ini bukan pengganti isolasi OS. Jangan gunakan credentials/database bersama. Mount source, dependencies dan toolchain read-only; sediakan scratch untuk DB/temp/log, environment aman serta batas resource dan waktu. Tes software tidak memeriksa prompt biometrik, sinkronisasi password manager atau interaksi popup browser nyata.

- **Koneksi DB gagal:** cek Tailscale, host/port, credentials, serta hak role PostgreSQL.
- **Workspace belum diimpor:** jalankan import satu kali dari snapshot server yang lengkap.
- **Port sudah dipakai:** hentikan proses aplikasi sebelumnya sebelum menjalankan proses baru.
- **Konflik dokumen/draft:** salin tulisan, muat versi terbaru, lalu gabungkan perubahan.
- **Mirror tertinggal:** cek log dan izin filesystem, lalu jalankan `npm run docs:sync`.
- **Login gagal setelah pindah domain:** login pada domain yang sedang dibuka.
- **413:** sesuaikan `JSON_BODY_LIMIT` dan `client_max_body_size`; upload file dibatasi 5 MB.
