# MD Previewer

Workspace untuk membaca, menulis, dan mengelola dokumen Markdown dengan tampilan bergaya Notion. Dokumen disimpan sebagai file di folder `docs/`, tanpa database.

## Fitur

- Navigasi folder, pencarian nama file, favorit, dan riwayat dokumen.
- Editor Markdown dan pratinjau dengan syntax highlighting.
- Membuat, mengubah nama, menghapus, mengimpor, dan mengunduh dokumen.
- Tema Sistem, Terang, dan Gelap.
- Pengaturan file Publik/Privat dan link berbagi publik dari daftar maupun detail file.
- Login menggunakan satu kode akses bersama untuk mengelola seluruh workspace.

## Persyaratan

- Node.js dan npm terpasang.
- Git jika mengambil project melalui clone.
- Hak baca/tulis pada direktori project untuk menyimpan dokumen, metadata, upload sementara, dan log.

Backend menggunakan Express dan EJS. Frontend menggunakan JavaScript dan CSS biasa; tidak ada langkah build frontend.

## Instalasi

### 1. Masuk ke direktori project

Jika belum memiliki source code:

```sh
git clone <URL_REPOSITORY> md-previewer
cd md-previewer
```

Jika source code sudah ada, buka terminal di root project, tempat `package.json` berada.

### 2. Install dependency

```sh
npm install
```

### 3. Buat konfigurasi `.env`

Buat file bernama `.env` di root project:

```dotenv
PORT=8026
NODE_ENV=development
ACCESS_CODE_HASH='TEMPEL_HASH_BCRYPT_DI_SINI'
SESSION_SECRET='TEMPEL_SECRET_ACAK_DI_SINI'
JSON_BODY_LIMIT=5mb
```

Generate hash kode akses dengan perintah berikut. Ganti `ganti-dengan-kode-akses-anda` dengan kode yang ingin digunakan untuk login:

```sh
node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" "ganti-dengan-kode-akses-anda"
```

Salin hasilnya ke `ACCESS_CODE_HASH`, tetap di dalam tanda kutip tunggal. Yang dimasukkan saat login adalah kode akses asli, bukan hash.

Generate secret sesi:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Salin hasilnya ke `SESSION_SECRET`. Gunakan secret sendiri; jangan memakai nilai fallback dari source code. File `.env` diabaikan oleh Git.

| Variabel | Fungsi |
| --- | --- |
| `PORT` | Port aplikasi; default `8026`. |
| `NODE_ENV` | Gunakan `development` untuk HTTP lokal dan `production` untuk deployment HTTPS. |
| `ACCESS_CODE_HASH` | Hash bcrypt dari kode akses workspace; wajib diisi agar login dapat digunakan. |
| `SESSION_SECRET` | Secret untuk menandatangani cookie sesi. |
| `JSON_BODY_LIMIT` | Batas body JSON, termasuk request simpan dokumen; default `5mb`. Tidak mengubah batas import file. |

### 4. Siapkan dokumen

Folder `docs/` harus tersedia sebelum aplikasi dijalankan. Repository menyertakan `docs/.gitkeep` agar folder tersebut tetap ada pada clone baru.

Tambahkan file `.md` beserta subfoldernya ke `docs/`, atau buat dokumen melalui aplikasi setelah login. Pada instalasi baru, workspace dapat dimulai dalam keadaan kosong.

**File yang ditambahkan langsung ke `docs/` default-nya publik jika belum memiliki pengaturan akses.** Dokumen yang dibuat atau diimpor melalui aplikasi mulai sebagai privat. Gunakan menu **Bagikan** untuk mengubahnya.

## Menjalankan web

Jalankan dari root project:

```sh
npm start
```

Buka **http://localhost:8026**, lalu masukkan kode akses yang digunakan saat membuat hash. Sesuaikan URL jika `PORT` diubah. Tekan `Ctrl+C` di terminal untuk menghentikan server.

Untuk pengembangan dengan restart otomatis saat source berubah:

```sh
npm run dev
```

Jalankan salah satu mode tersebut. Jika port `8026` sudah dipakai proses PM2 atau server lain, hentikan proses tersebut atau gunakan port berbeda di `.env`.

## Menjalankan di server dengan PM2

Selesaikan instalasi dan konfigurasi `.env` terlebih dahulu. Untuk deployment HTTPS, ubah `NODE_ENV=production`, lalu jalankan dari root project:

```sh
npm install -g pm2
pm2 start server.js --name md-previewer
pm2 save
```

Perintah pengelolaan:

```sh
pm2 status
pm2 logs md-previewer
pm2 restart md-previewer
pm2 stop md-previewer
```

Jika proses `md-previewer` sudah ada, gunakan `pm2 restart md-previewer`. Untuk menjalankan PM2 kembali setelah reboot pada server Linux, jalankan `pm2 startup`, ikuti perintah yang ditampilkan, lalu jalankan `pm2 save`.

### Reverse proxy dan HTTPS

Contoh konfigurasi tersedia di [`nginx/mdpreview.conf`](nginx/mdpreview.conf). Sesuaikan domain, lokasi sertifikat TLS, dan port upstream sebelum mengaktifkannya. Teruskan header `Host` dan `X-Forwarded-Proto` seperti pada contoh.

Pada mode `production`, cookie sesi hanya dikirim melalui HTTPS. Mengakses server langsung melalui HTTP pada mode ini akan membuat sesi login tidak bertahan.

Untuk mendukung import hingga 5 MB melalui nginx, tambahkan konfigurasi berikut di blok `server` HTTPS:

```nginx
client_max_body_size 6m;
```

Nilainya memberi ruang untuk overhead multipart. Jika `JSON_BODY_LIMIT` dinaikkan, sesuaikan juga batas nginx. Batas file import di aplikasi tetap 5 MB.

## Penyimpanan dan backup

| Lokasi | Isi |
| --- | --- |
| `docs/` | Dokumen Markdown dan asetnya. Git hanya melacak `.gitkeep`; isi dokumen tetap lokal. |
| `.data/file-access.json` | Status Publik/Privat dan ID link berbagi. Dibuat saat pengaturan akses disimpan. |
| `.env` | Konfigurasi dan secret lokal. |
| `uploads/` | File upload sementara. |
| `access.log`, `audit.log` | Log request dan aktivitas aplikasi. |

**Backup dan pulihkan `docs/` bersama `.data/file-access.json` jika file metadata sudah ada.** Kehilangan metadata menghilangkan ID link berbagi dan membuat file tanpa pengaturan kembali dianggap publik. Simpan juga konfigurasi `.env` secara aman agar instalasi dapat dipulihkan.

Favorit, riwayat dokumen, dan pilihan tema tersimpan di browser masing-masing. Sesi login tersimpan di memori server; restart proses mengharuskan pengguna login ulang. Kode akses memberikan hak kelola seluruh workspace; aplikasi belum memiliki akun dan izin per pengguna.

## Struktur project

```text
docs/                      Dokumen lokal
public/app.js              Interaksi workspace
public/style.css           Styling dan tema
views/layout.ejs           Tampilan workspace dan halaman publik
server.js                  Server, API, autentikasi, dan rendering Markdown
file-access.js             Penyimpanan pengaturan akses dan link berbagi
nginx/mdpreview.conf       Contoh reverse proxy HTTPS
scripts/check-sharing.cjs  Pemeriksaan terisolasi untuk fitur sharing
mockup-notion.html         Mockup desain
```

## Kendala umum

- **Login gagal:** pastikan `ACCESS_CODE_HASH` berisi hash bcrypt yang valid dan masukkan kode aslinya. Restart aplikasi setelah mengubah `.env`.
- **Login tidak bertahan di localhost:** gunakan `NODE_ENV=development` untuk HTTP lokal.
- **`EADDRINUSE`:** port sedang digunakan. Periksa proses yang aktif atau ubah `PORT`.
- **`ENOENT` untuk `docs`:** buat kembali folder `docs/` di root project sebelum menjalankan server.
- **Upload atau simpan mendapat HTTP 413:** periksa batas ukuran di aplikasi dan reverse proxy. Import dibatasi 5 MB per file.
- **Error metadata akses:** pulihkan `.data/file-access.json` dari backup yang sesuai; jangan menghapusnya untuk melewati error karena pengaturan privat dan ID link akan hilang.
