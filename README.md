# Ruangku

Workspace pribadi dengan Express, PostgreSQL, dan migrasi bertahap ke TypeScript serta Vue 3. Build memakai Vite; shell EJS dan fitur JavaScript yang belum dimigrasikan tetap digunakan. Tampilan memakai Inter, tema terang/sistem, dan dark mode Graphite.

## Fitur

Pengembangan workspace pribadi terbaru: **Hari ini**, fokus harian maksimal tiga task (WIB), hubungan antardokumen melalui `[[`, **Jadikan task** dari teks pilihan, dan command `/` di live editor. Panduan fitur dan penyimpanannya ada di [laporan fitur workspace pribadi](reports/2026-11-25-workspace-productivity.md).

- Navigasi folder dan breadcrumb, favorit, serta 50 dokumen terakhir dibuka.
- Edit langsung dengan render otomatis pada tab Dokumen, serta tab sumber Markdown yang tersinkron. Di dalam list pada tab Dokumen, Tab membuat item menjadi sublist dan Shift+Tab mengembalikannya satu tingkat. Perubahan otomatis disimpan ke dokumen sekitar 1–2 detik setelah berhenti mengetik; Simpan atau Ctrl+S tetap bisa digunakan untuk langsung menyimpan. File publik otomatis ikut diperbarui.
- Pada tab **Dokumen**, pilih teks lalu tekan **Ctrl+B** untuk bold, **Ctrl+I** untuk italic, atau **Ctrl+U** untuk underline (gunakan Cmd pada Mac). Format langsung terlihat dan ikut autosave. Underline disimpan sebagai `<u>teks</u>` di sumber Markdown; pada browser modern tag tersebut disembunyikan dari editor live. Shortcut ini berlaku saat fokus berada di editor dokumen.
- Syntax highlighting, daftar isi, dan link ke heading.
- Dokumen publik untuk guest memiliki daftar isi dari heading dokumen dengan penanda aktif saat klik/scroll. Sidebar tetap terlihat di desktop; pada layar kecil, daftar isi pindah ke atas dokumen. Dokumen tanpa heading memakai lebar baca penuh tanpa sidebar kosong.
- Pencarian judul, path, dan isi dokumen dengan PostgreSQL full-text search.
- Buat folder/dokumen, rename, pindahkan, unduh, dan upload Markdown dengan konfirmasi nama/isi.
- Upload beberapa file sekaligus melalui drag & drop atau **Pilih file**: Markdown, PDF, PNG, JPEG, GIF, dan WebP, maksimal 5 MB per file. Dialog menyediakan daftar pilihan, pratinjau per file, ubah nama, dan keluarkan file sebelum **Upload semua**. Upload berjalan berurutan; retry melewati file yang sudah berhasil. Gambar folder disimpan privat di PostgreSQL sebagai `image`, ikut mirror `docs/`, muncul pada filter **Gambar**, dan dibuka di tab baru setelah login. Gambar yang disisipkan melalui editor tetap berupa `asset` dan tidak ikut daftar folder.
- Upload PDF dengan pratinjau sebelum konfirmasi, viewer PDF, serta mention PDF di task board.
- Klik judul file pada halaman dokumen untuk mengganti nama, lalu klik **Simpan nama**. Nama tidak mengikuti autosave isi dokumen; **Batal** atau Escape membatalkan. Klik di luar kolom tidak menyimpan. Rename mengubah URL path file; pengaturan akses dan link lama `/share/:id` tetap tersimpan.
- Akses publik/privat, URL path asli, serta kompatibilitas link lama `/share/:id`.
- Sampah dengan pemulihan dan hapus permanen, riwayat versi dengan preview/pemulihan.
- Autosave dokumen dengan status penyimpanan, draft pemulihan, dan deteksi konflik antarperangkat.
- Template dokumen yang bisa dibuat, diedit, dan digunakan kembali.
- Aktivitas workspace dan session login tersimpan di PostgreSQL.
- Task board pribadi: tambah/edit/hapus task, drag & drop antarstatus, pencarian, prioritas, dan tenggat opsional. Kelola nama, warna, serta urutan status; task dipindahkan ke status tujuan saat statusnya dihapus.

Login memakai passkey dengan pusat autentikasi di `https://itsazmi.com/mynotes` (RP ID `itsazmi.com`). Domain lama dan lokal membuka pusat login melalui popup, kemudian menerima session masing-masing melalui handoff sekali pakai. Favorit, riwayat bacaan, tema, template, dan draft menjadi milik **workspace bersama**, belum per akun. Favorit/riwayat browser lama dapat diimpor sekali lewat sidebar setelah login. Pengunjung publik hanya mendapat dokumen yang dibuka; tema pengunjung disimpan pada browsernya.

### Gambar di dokumen Markdown

Pada detail Markdown, drag & drop satu gambar PNG, JPEG, GIF, atau WebP (maksimal 5 MB), atau salin gambar/screenshot lalu **Ctrl+V** (**Cmd+V** di Mac) saat kursor berada di editor. Gambar langsung diupload dan disisipkan di posisi kursor, tanpa dialog konfirmasi. Ini bekerja pada tab **Dokumen** dan **Markdown**. Paste teks tetap mengikuti editor biasa. File disimpan dengan nama unik di folder yang sama dengan `.md`; byte asli ada di PostgreSQL sebagai `asset` dan ikut mirror `docs/`.

Klik gambar di tab **Dokumen**, atur lebar lewat slider atau input piksel, lalu klik **Terapkan ukuran**. Proporsi tetap dan gambar menyesuaikan lebar layar. Ukuran disimpan sebagai elemen `<img width="…">` di sumber Markdown melalui autosave. **Batal** tidak mengubah ukuran. Gambar pada dokumen publik mengikuti akses dokumen yang merujuknya; SVG tidak diterima. Menghapus gambar dari konten tidak menghapus file gambarnya.

### Upload dan membaca PDF

Drag & drop satu atau beberapa file `.pdf` ke halaman workspace atau pilih lewat upload file. PDF dapat dicampur dengan Markdown dan gambar. Dialog menampilkan nama, folder tujuan, dan pratinjau per file dari perangkat. Periksa atau ubah nama dengan ekstensi `.pdf`, lalu klik **Upload** atau **Upload semua**. Menutup dialog sebelum konfirmasi membatalkan pilihan. Ukuran maksimal 5 MB per file dan nama yang sudah ada tidak ditimpa. Jika sebagian upload sudah berhasil, menutup dialog tidak menghapus file yang sudah tersimpan.

PDF disimpan sebagai byte asli di PostgreSQL (`entries.kind='pdf'`, kolom `content`) dan dimaterialisasi ke `docs/`. File baru **privat**; pengaturan publik/privat, share path asli, favorit, terakhir dibuka, rename, pindah, dan Sampah berlaku juga untuk PDF. Klik file untuk membuka viewer; tersedia tautan buka tab baru dan unduh jika viewer browser tidak tampil. Endpoint `/media?document=<path>` selalu memeriksa akses terkini dan tidak menyimpan cache respons. Nginx mengizinkan frame dari origin yang sama hanya pada endpoint media; halaman aplikasi tetap memakai `X-Frame-Options: DENY`.

Ketik `@` di **Deskripsi** atau **Hasil task** untuk memilih Markdown maupun PDF. Mention memakai ID yang tetap setelah rename/pindah dan ikut dalam guard penghapusan file. Pencarian PDF mencakup nama/path, belum isi PDF atau OCR. PDF hanya dibaca; editor, draft, dan riwayat versi tetap untuk Markdown. Pratinjau bergantung pada viewer PDF browser dan tersedia tautan alternatif untuk perangkat yang tidak mendukungnya.

### Task board

Buka **Task board** di sidebar atau `/?view=tasks` (`/mynotes/?view=tasks` pada domain utama). Papan hanya tersedia setelah login dan dipakai bersama oleh semua perangkat pada workspace ini. Tidak ada link publik untuk papan.

Di detail task, pilih **Tambah lampiran** untuk memilih beberapa file sekaligus, maksimal **10 lampiran per task** dan **100 MB per file** (104.857.600 byte). Simpan task baru terlebih dahulu sebelum menambah lampiran. Upload dan penghapusan lampiran langsung disimpan, terpisah dari tombol **Simpan task**; perubahan deskripsi/hasil yang belum disimpan tetap dipertahankan. Jika batch gagal, file sebelumnya yang berhasil tetap tersimpan dan pesan menyebutkan jumlahnya.

Seret satu atau beberapa file ke bagian **Lampiran** di detail task, atau klik **Tambah lampiran**. Daftar konfirmasi menampilkan nama dan ukuran file; file baru dikirim setelah menekan **Upload**. **Batal** atau Escape membuang pilihan tanpa mengupload. Folder tidak didukung. Jika sebagian batch gagal, file yang berhasil tetap tersimpan dan daftar konfirmasi hanya menyisakan file yang belum berhasil; retry tidak mengirim ulang file yang sudah berhasil. Muat ulang papan setelah konflik mengharuskan memilih file kembali. Perubahan teks task yang belum disimpan tetap dipertahankan.

Format lampiran: PDF, ZIP, RAR, Excel (XLS/XLSX/CSV UTF-8), PowerPoint (PPT/PPTX), Markdown (MD/Markdown UTF-8), gambar (PNG/JPG/JPEG/GIF/WebP/AVIF/BMP), dan video (MP4/M4V/MOV/WebM/MKV/AVI). Klik nama file untuk membuka URL view R2; akses memerlukan login. Arsip tetap menyimpan lampiran, tetapi harus dipulihkan sebelum menambah/menghapus. Menghapus task menghapus lampirannya secara permanen. Nginx mengizinkan body 101 MB hanya pada endpoint upload lampiran; batas upload dokumen tetap 5 MB.

Upload browser mengirim file sebagai body `application/octet-stream`, tanpa overhead multipart agar file tepat 100 MB tetap muat pada batas request Cloudflare. Nama file dikirim melalui header terenkode `X-Upload-Filename`; ID task dan revisi ada pada query. Nginx meneruskan body dengan `proxy_request_buffering off`. Node mengalirkan request ke file sementara di `uploads/`, memvalidasi signature/UTF-8 dan menghitung MD5 per chunk, lalu mengalirkan file tersebut ke R2 dengan `createReadStream` dan panjang/checksum eksplisit. Tidak ada pembacaan utuh file upload ke RAM atau penulisan binary baru ke DB. File sementara dihapus setelah sukses, gagal, atau koneksi upload terputus. Request multipart dari klien lama tetap diterima, tetapi overhead-nya dapat melewati batas Cloudflare untuk file tepat 100 MB. Batas zona Cloudflare yang diturunkan di bawah 100 MB tetap harus dinaikkan pada konfigurasi zona.

Byte lampiran task disimpan di **Cloudflare R2 private**, dengan key `md-preview/task-attachments/<task-id>/<id-unik-upload>/<nama-file>`. Prefix `md-preview` adalah folder utama dalam bucket. ID unik menjaga nama yang sama tidak saling menimpa; nama task tidak digunakan sebagai folder sehingga rename task tidak memindahkan object. PostgreSQL hanya menyimpan metadata/link object di `mdpreview.task_attachments` dan registry/antrean pembersihan `mdpreview.task_attachment_objects`. Lampiran tidak masuk mirror `docs/`.

Klik nama lampiran untuk membuka tab baru. Setelah memeriksa login dan keberadaan lampiran, API `/api/task-board/attachments/:id/view` mengarahkan ke **URL R2 bertanda tangan yang berlaku 15 menit**, dengan tipe file dan `Content-Disposition: inline`. PDF/gambar/video yang didukung browser bisa langsung dilihat; Markdown/CSV tampil sebagai teks. ZIP/RAR/Office atau format yang tidak didukung browser dapat tetap diunduh oleh browser. Klik lagi dari aplikasi untuk URL baru setelah kedaluwarsa. URL sementara dapat dipakai siapa pun yang memegangnya hingga kedaluwarsa, jadi jangan membagikannya sebagai tautan publik permanen. Bucket tetap private; tidak memerlukan domain R2 publik atau browser CORS. Endpoint `/download` yang lama tetap menyediakan unduhan setelah login.

Penghapusan lampiran, termasuk saat task dihapus, langsung menghapus metadata dan menjadwalkan penghapusan object. Worker berjalan saat startup dan setiap 60 detik; kegagalan R2 tetap dalam antrean untuk dicoba lagi. Upload yang terputus atau gagal menyimpan metadata dibersihkan setelah satu jam; object yang masih direferensikan tidak dihapus. Jangan membuat lifecycle R2 yang menghapus prefix ini berdasarkan usia karena task aktif/arsip dapat menyimpan lampiran tanpa batas waktu.

Isi `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, dan `R2_SECRET_ACCESS_KEY` di `.env` **lokal dan server**, dengan endpoint/bucket yang sama. Buat API credential R2 dengan **Object Read & Write** untuk bucket tersebut saja; pertahankan bucket private. Upload baru tidak memakai binary DB sebagai fallback jika R2 belum siap.

```sh
npm run r2:check
# Deploy kode baru ke semua instance dan restart sebelum menjalankan migrasi.
# Buat serta verifikasi backup PostgreSQL terlebih dahulu.
npm run attachments:migrate
```

`r2:check` membuat object sementara, memverifikasi baca ulang, lalu menghapusnya. `attachments:migrate` memindahkan lampiran lama satu per satu, membaca ulang R2 dan membandingkan SHA-256 sebelum mengosongkan binary DB. UUID lampiran, URL download, nama, slot dan tanggal tetap. Bila gagal, bytes lama tetap tersedia; perintah aman dijalankan ulang setelah memperbaiki koneksi. Kode baru tetap dapat mengunduh lampiran lama selama migrasi. Jalankan migrasi dari satu instance saja; tidak perlu sinkronisasi file lokal. Dokumen Markdown, PDF workspace, dan gambar di dalam dokumen masih menggunakan PostgreSQL/mirror seperti sebelumnya.

Task dan status disimpan di PostgreSQL, bukan `docs/` atau localStorage. Startup membuat tabel `mdpreview.task_board`, `mdpreview.task_statuses`, dan `mdpreview.tasks` beserta empat status awal; tidak menambahkan task contoh. Backup PostgreSQL lengkap juga mencakup data papan.

Gunakan tab **Papan**, **Time table**, **Daftar**, atau **Arsip**; pencarian berlaku pada tampilan yang sedang dibuka. Menu **Pengaturan** menyediakan **Kelola tag**, **Kelola status**, dan **Kelola view tersimpan**. Kartu menampilkan satu nama tag dengan jumlah tag lainnya; deadline yang terlewat diberi label **Lewat**. Arsip memakai daftar ringkas dengan tombol **Pulihkan**.

**Tags:** buka **Pengaturan → Kelola tag** untuk membuat, mengganti nama, atau menghapus tag bersama. Nama harus berbeda tanpa membedakan huruf besar/kecil, maksimal 32 karakter; tersedia hingga 100 tag. Perubahan pengelolaan diterapkan saat **Simpan tag**. Menghapus tag memakai konfirmasi dan hanya melepasnya dari task aktif maupun arsip; task tetap tersimpan.

Di detail task, pilih beberapa tag pada field **Tags** (maksimal 20 per task), lalu **Simpan task**. Tag tampil pada kartu dan namanya ikut dalam pencarian Papan, Time table, serta Arsip. Pilihan tag pada task arsip hanya bisa dibaca sampai dipulihkan. Task lama dimulai tanpa tag; payload API lama yang tidak menyertakan `tagIds` tetap mempertahankan pilihan tersimpan. Data tag memakai tabel `mdpreview.task_tags` dan relasi `mdpreview.task_tag_links` yang ikut dalam backup PostgreSQL. Saat konflik, muat ulang mempertahankan pilihan task yang masih tersedia dan memberi tahu jika tag sudah dihapus; draft pengaturan tag direset ke data terbaru.

Di deskripsi task, ketik `@` lalu nama file untuk memilih dokumen dari suggestion (nama dan path ditampilkan). Gunakan panah atas/bawah dan Enter/Tab, atau klik hasilnya; Escape menutup suggestion. Mention bisa diklik dari editor maupun kartu dan membuka dokumen di tab baru, sehingga form task yang belum disimpan tetap terbuka. Referensi memakai ID dokumen: rename/pindah file tetap tersambung, sedangkan dokumen yang dihapus ditandai tidak tersedia. Dokumen privat tetap memerlukan login. Folder `steering`/`superpowers` tidak masuk suggestion. Mention disimpan bersama deskripsi ketika menekan **Simpan task**, tanpa tabel baru.

URL `http://` dan `https://` di deskripsi task menjadi hyperlink yang membuka tab baru, termasuk di editor, kartu, dan arsip. URL yang ditempel langsung menjadi tautan; saat mengetik, tekan spasi atau Enter setelah URL. Deskripsi tetap disimpan sebagai teks ketika menekan **Simpan task**.

**Hasil task** menyimpan hasil pengerjaan secara terpisah dari deskripsi. Pilih tab **Deskripsi** atau **Hasil task** di detail; berpindah tab mempertahankan kedua isinya. Editor ini juga mendukung mention `@dokumen` dan hyperlink dengan perilaku yang sama. Kedua field disimpan bersama secara manual lewat **Simpan task**, masing-masing maksimal 3.000 karakter termasuk referensi. Indikator footer menunjukkan perubahan yang belum diterapkan ke papan; menutup form yang berubah menawarkan **Simpan draft & tutup**. Hasil ikut masuk pencarian papan/arsip dan pengecekan referensi sebelum menghapus file. Task arsip mempertahankan hasil dan tautannya, tetapi hanya bisa dibaca sampai dipulihkan.

Deskripsi dan Hasil task memakai editor Markdown langsung: ketik atau tempel `**bold**`, `*italic*`, heading, daftar, kutipan, atau blok kode untuk melihat formatnya di area edit. Ctrl+B/Ctrl+I (Cmd di Mac) juga tersedia. Isinya disimpan sebagai Markdown, bukan HTML. Mention `@` tetap menyimpan referensi dokumen yang stabil dan URL HTTP/HTTPS membuka tab baru. Task lama tetap bisa diedit; membuka task tanpa mengubah field mempertahankan teks aslinya. Batas 3.000 karakter mencakup tanda Markdown dan token mention. Render otomatis tidak menyimpan task secara otomatis; gunakan **Simpan task**.

Isi **Tanggal mulai** dan **Deadline / tanggal akhir** untuk menjadwalkan task; keduanya opsional. Deadline tidak boleh sebelum tanggal mulai, dan tanggal yang sama diperbolehkan. Deadline task lama dipertahankan sebagai tanggal akhir; tanggal mulai tidak diisi otomatis. Secara internal API tetap memakai `due` untuk tanggal akhir, ditambah `startDate` dan `result`. Payload lama yang tidak menyertakan field baru tetap mempertahankan nilai yang sudah tersimpan.

Filter **Periode dari / sampai** menampilkan task yang rentang Tanggal mulai sampai Deadline beririsan dengan periode pilihan, termasuk kedua batas tanggal. **Hari ini** memakai rentang yang sama; **Lewat deadline** tetap memakai Deadline untuk task yang belum selesai. Jika hanya satu tanggal task diisi, task dianggap terjadwal pada tanggal itu saja; task tanpa tanggal tidak masuk filter tanggal. View tersimpan memakai aturan periode ini juga.

Tab **Time table** menampilkan timeline mingguan task aktif, dengan default minggu berjalan (Senin–Minggu) berdasarkan tanggal lokal perangkat. Pilih tanggal untuk membuka minggu terkait, gunakan panah minggu sebelumnya/berikutnya, atau **Minggu ini**. Klik nama atau bar task untuk membuka detail dan mengubah jadwal. Bar mencakup kedua tanggal dan dipotong sesuai minggu yang dipilih; task dengan hanya satu tanggal ditandai sebagai titik dengan keterangan tanggal yang belum diisi. Task tanpa tanggal tetap ada di **Belum dijadwalkan**. Pencarian juga berlaku di tampilan ini; task arsip tetap di tab Arsip. Di layar kecil, geser area timeline secara horizontal, sementara nama task tetap terlihat. Jadwal diubah lewat detail task, tanpa drag bar.

Hapus file melalui daftar file atau menu detail. Jika file, termasuk isi folder yang dihapus, disebut di task board, dialog menampilkan jumlah dokumen/task terdampak dan meminta konfirmasi lagi. Server mengecek ulang referensi saat penghapusan; perubahan referensi dari perangkat lain memerlukan konfirmasi baru. File masuk ke **Sampah**, task dan teks mention tetap disimpan, tetapi tautannya tidak tersedia. Memulihkan file mengaktifkan kembali referensinya; menghapus permanen dari Sampah membuat referensi tersebut tidak bisa dipulihkan.

Klik kartu untuk mengedit lalu **Simpan task**. Status bisa diubah lewat drag & drop desktop atau pilihan Status pada editor, termasuk pada HP. **Kelola status** mendukung 1–50 status dengan nama berbeda, warna, dan urutan kolom. Menghapus status yang berisi task wajib memilih tujuan pemindahan; task tetap tersimpan. Penghapusan task bersifat permanen dan memakai konfirmasi.

Task yang sudah selesai dapat diarsipkan secara manual. Di **Kelola status**, centang **Selesai** pada status yang menandakan pekerjaan selesai; status Selesai yang sudah ada ditandai sekali saat migrasi. Penanda ini tetap berlaku setelah nama atau urutan status diganti. Buka detail task pada status tersebut lalu pilih **Arsipkan** dan konfirmasi. Simpan perubahan form terlebih dahulu sebelum mengarsipkan.

Tab **Arsip** menampilkan task yang sudah diarsipkan dan mendukung pencarian judul/deskripsi/mention. Task arsip tidak masuk kolom atau hitungan task aktif; detailnya hanya bisa dibaca dan mention tetap bisa dibuka. Pilih **Pulihkan** untuk mengembalikan task ke papan pada statusnya saat ini, kemudian task bisa diedit lagi. Mengubah atau menghapus status tetap mempertahankan task arsip; pemindahan status berlaku pada task aktif maupun arsip. Arsip tidak menghapus data, dan guard penghapusan dokumen tetap memeriksa mention dari task arsip.

Saat dua perangkat mengubah papan bersamaan, revisi lama ditolak. Muat ulang papan lalu periksa kembali sebelum menyimpan; isi form task dipertahankan, sedangkan pengaturan status yang belum disimpan direset saat dimuat ulang. Perubahan dari perangkat lain diperiksa sekitar setiap 15 detik saat papan sedang tidak digunakan dan tidak ada dialog terbuka. Task memakai simpan manual; autosave dokumen tetap terpisah.

## Persyaratan

- Node.js 22 atau lebih baru dan npm (server dan lokal saat ini Node.js 24).
- PostgreSQL 14 atau lebih baru yang dapat dijangkau aplikasi.
- Hak membuat schema/tabel pada database. Hak `CREATEDB` diperlukan jika database belum dibuat.
- Hak tulis pada `docs/`, `.data/`, dan `uploads/`.
- Tailscale aktif jika host DB menggunakan alamat jaringan Tailscale.

Font Inter disertakan di `public/fonts/` dengan lisensi pada `OFL-Inter.txt`.
Editor Vditor disajikan dari dependency npm di server yang sama, tanpa CDN pihak ketiga.

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
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET=<bucket private>
R2_ACCESS_KEY_ID=<access key R2>
R2_SECRET_ACCESS_KEY='<secret key R2>'
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
npm ci
npm run build
npm start
```

Buka `http://localhost:8026`. Untuk pengembangan:

```sh
npm run dev
```

Nodemon mengabaikan `docs/`, `.data/`, dan `uploads/` agar sinkronisasi tidak memicu restart berulang. Setelah database sudah diimpor, salinan aplikasi lain cukup memakai lima credentials DB yang sama dan menjalankan aplikasi.

### Migrasi Vue / TypeScript (bertahap)

Backend composition, startup, dan HTTP Task board menggunakan TypeScript di
`src/backend/application.ts`, `startup.ts`, dan `modules/task-board/http.ts`.
Build menyalin modul JavaScript yang belum dimigrasikan serta schema SQL ke
`dist/server`. Entry `server.js` tetap sama. Konfigurasi `.env`, mirror `docs/`,
upload sementara, dan views selalu diambil dari root project, bukan `dist`.

Vite membangun `src/frontend/main.ts` ke `dist/frontend`. Task board memakai
komponen Vue di `src/frontend/features/task-board`; kontrak API ada di
`src/shared/contracts`. Primitive shadcn-vue memakai Reka UI dan kelas visual
existing. Tailwind memakai prefix `tw` tanpa preflight sehingga CSS existing
tetap menjadi acuan tampilan. Manifest berisi URL relatif agar root dan
`/mynotes/` menggunakan bundle yang sama.

Shell EJS, drawer/editor task, controller mutasi, dokumen, sticky notes, dan
halaman pengelolaan masih memakai JavaScript selama migrasi per halaman.
`allowJs` hanya untuk kompatibilitas transisi; modul JavaScript belum mendapat
pemeriksaan strict TypeScript. `dist/` tidak disimpan di git, sehingga build
wajib dilakukan setelah memasang dependencies atau mengubah source.

### Pemeriksaan lokal terisolasi

```sh
npm run build
npm test
npm run preview:fixture
```

Preview terakhir membuka fixture in-memory di `http://127.0.0.1:8030/?view=tasks`
dan `/mynotes/?view=tasks`. Data contoh dapat diubah tanpa membaca `.env`, DB
workspace, atau R2. Fixture hanya untuk lokal dan tidak didaftarkan pada server
aplikasi. Login fixture tidak membuktikan verifikasi biometrik passkey.

Untuk menjalankan seluruh pemeriksaan lama dengan database disposable lokal,
set `POSTGRES_BIN` ke direktori binary PostgreSQL (`initdb`, `pg_ctl`, `postgres`),
lalu jalankan `npm run test:legacy`. Runner membuat cluster baru yang
hanya listen di loopback, memakai workspace salinan tanpa `.env`, membatasi
koneksi test ke loopback, dan mematikan cluster setelah selesai. Jangan
menjalankan pemeriksaan DB langsung terhadap `.env` workspace bersama.

`npm run test:ui` menjalankan Chrome headless terhadap fixture lokal pada kedua
mount, termasuk drag kartu, CRUD, konflik, retry, pergantian halaman, keyboard,
tema, dan ukuran mobile. Set `CHROME_PATH` bila Chrome tidak terpasang di lokasi
default Windows. Screenshot dan profile sementara berada di `.data/`.

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
npm ci
npm run build
npm prune --omit=dev
pm2 start server.js --name md-previewer
pm2 save
```

Untuk deployment berikutnya:

```sh
npm ci
npm run build
npm prune --omit=dev
pm2 restart md-previewer
pm2 save
```

Gunakan `NODE_ENV=production` di balik HTTPS proxy. Pertahankan `SESSION_SECRET` agar session PostgreSQL tetap dapat dipakai setelah restart. Sesi login berakhir pada pergantian hari pukul **00.00 WIB (Asia/Jakarta)**; login pukul 23.50 WIB berlaku sampai 00.00 WIB. Aktivitas, refresh, dan polling tidak memperpanjang batas ini. Backend juga menolak sesi yang melewati batas hari, termasuk sesi lama berdasarkan waktu autentikasinya. Hari berikutnya user harus login kembali dengan passkey. Verifikasi perubahan passkey tetap dibatasi 5 menit sejak autentikasi. Domain/prefix berbeda memiliki cookie login masing-masing dengan aturan kedaluwarsa yang sama.

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

## Docs dan task board

- Header dokumen dibuat ringkas; buka **Properti dokumen** untuk melihat akses, path, dan tanggal. Mengganti nama tetap memerlukan **Simpan nama**.
- Pilih teks dalam editor dokumen untuk menampilkan alat **Bold, Italic, H2, Tautan, Kode**, atau **Buat task**. `Alt+Shift+F` memindahkan fokus ke toolbar pilihan. Task dari pilihan teks otomatis menyebut dokumen sumber dan masih perlu **Simpan task**.
- **Task terkait** pada dokumen Markdown/PDF menampilkan task yang menyebut dokumen dalam deskripsi atau hasil, termasuk arsip. Daftar ini hanya tersedia setelah login.
- Pencarian workspace menyediakan filter folder (termasuk subfolder), Markdown/PDF, akses, dan tanggal pembaruan. Riwayat versi menampilkan baris yang ditambah/dihapus sebelum pemulihan. Diff besar dibatasi 300.000 karakter per versi dan 5.000 baris; isi lengkap tetap tersedia.
- Task board menyediakan **Papan, Time table, Daftar, Arsip**. Tombol **Filter** membuka status, tag, prioritas, dan rentang deadline untuk semua tampilan; filter aktif tampil sebagai chip yang bisa dilepas. **Hari ini** berarti deadline hari ini; **Lewat deadline** tidak menyertakan task berstatus selesai. Tanggal relatif mengikuti tanggal browser.
- **Simpan view** menyimpan filter bersama di PostgreSQL (maksimal 20 view). Saat filter view berubah, pilih **Perbarui view ini** atau **Simpan sebagai view baru**. **Kelola view tersimpan** mengganti nama atau menghapus view setelah **Simpan pengaturan**; task tetap tersimpan. Perubahan dari dua perangkat diperiksa menggunakan token agar tidak saling menimpa.
- Detail task memakai panel isi dan properti; di HP, buka **Properti task** untuk status, prioritas, tanggal dan tag. Checklist serta lampiran bisa dilipat. Tag memakai pencarian, pilihan jamak dan chip yang bisa dilepas. Editor Deskripsi/Hasil mempertahankan isi saat berpindah tab.
- Tampilan **Daftar** menyimpan perubahan status/tanggal langsung. Detail task dan checklist tetap diterapkan melalui **Simpan task**. Checklist mendukung maksimal 100 item, masing-masing 200 karakter.
- Isi form task disimpan sebagai draft setelah berhenti mengetik sekitar 800 ms. Draft tidak mengubah task di papan. Setelah membuka ulang task atau **Tambah task**, pilih **Pulihkan draft** atau **Buang draft**. Draft dan view mengikuti workspace pribadi yang sama di lokal dan kedua domain.
- Jika papan atau draft berubah di perangkat lain, muat ulang dan periksa isi form sebelum menyimpan. Jangan menutup browser sebelum status draft tersimpan; browser yang dihentikan paksa atau jaringan terputus dapat menggagalkan penyimpanan terakhir. Lampiran tetap langsung disimpan terpisah dari draft form.

Migrasi startup menambahkan `tasks.checklist` (JSONB) dan `mdpreview.task_drafts`. View tersimpan dan token konkurensinya memakai `mdpreview.settings`. Tidak diperlukan environment variable atau dependency baru.

## Backup

Backup PostgreSQL dengan `pg_dump`, serta simpan `.env` secara privat. Backup `docs/` saja tidak mencakup akses privat, draft, sampah, riwayat, atau session. Database menyimpan semuanya, termasuk isi yang sudah dipindahkan ke sampah. Lindungi backup dengan hak akses terbatas. Jadwal dan retensi backup mengikuti pengelolaan server.

**Lampiran task memerlukan backup R2 juga**: backup PostgreSQL setelah migrasi hanya berisi metadata/object key. Simpan salinan object R2 dan database dari waktu yang sesuai. Restore DB lama dapat mereferensikan object yang sudah dihapus setelah backup; pastikan salinan object tersedia sebelum restore. Jangan menghapus registry/antrean R2 secara manual karena diperlukan untuk retry penghapusan dan pembersihan upload terputus.

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

Backend dikompilasi ke CommonJS. Entry frontend `src/frontend/main.ts` menggabungkan Vue dan modul lama melalui Vite. `public/js/main.js` menghubungkan state, modul fitur dan event delegation melalui `data-action`, tanpa fungsi aplikasi di `window` atau handler HTML inline. Bundle disajikan melalui `/static/app/` dengan nama ber-hash; aset legacy tetap tersedia melalui `/static/v/<hash>/`. Mount root dan `/mynotes/` memakai struktur aset yang sama.

`.env`, `docs/`, `uploads/` dan `.data/` tetap berada di root project. Pemindahan kode tidak mengubah nama tabel, URL API atau format data PostgreSQL.

## Kendala umum

Pemeriksaan regresi terisolasi dijalankan melalui `npm run test:legacy` setelah build dan penyiapan binary PostgreSQL lokal sesuai bagian pemeriksaan lokal. Runner membuat cluster loopback dan workspace sementara tanpa `.env`, lalu membersihkannya. Jangan menjalankan `tests/check-sharing.cjs` langsung dari workspace aktif; guard menolak eksekusi di luar fixture. Script tidak menggantikan verifikasi passkey memakai perangkat nyata. Jalankan hanya ketika ingin melakukan pemeriksaan.

`tests/check-runtime-config.cjs` memeriksa penolakan secret lemah, listener dan trust proxy. `tests/check-passkey-flow.cjs` memakai authenticator software ES256 untuk pendaftaran, signature, origin/RP ID, UV, counter, bridge, expiry/replay, step-up dan recovery. Tes flow menulis credential dummy ke DB fixture: jalankan **hanya** pada container disposable tanpa jaringan eksternal, tanpa `.env` aktual, dengan PostgreSQL loopback di namespace yang sama. Guard mengharuskan `MDPREVIEW_TEST_ISOLATED=1`, `DB_HOST=127.0.0.1`, `DB_USER=fixture`, dan `DB_NAME=postgres`; flag ini bukan pengganti isolasi OS. Jangan gunakan credentials/database bersama. Mount source, dependencies dan toolchain read-only; sediakan scratch untuk DB/temp/log, environment aman serta batas resource dan waktu. Tes software tidak memeriksa prompt biometrik, sinkronisasi password manager atau interaksi popup browser nyata.

- **Koneksi DB gagal:** cek Tailscale, host/port, credentials, serta hak role PostgreSQL.
- **Workspace belum diimpor:** jalankan import satu kali dari snapshot server yang lengkap.
- **Port sudah dipakai:** hentikan proses aplikasi sebelumnya sebelum menjalankan proses baru.
- **Konflik dokumen/draft:** salin tulisan, muat versi terbaru, lalu gabungkan perubahan.
- **Mirror tertinggal:** cek log dan izin filesystem, lalu jalankan `npm run docs:sync`.
- **Login gagal setelah pindah domain:** login pada domain yang sedang dibuka.
- **413:** sesuaikan `JSON_BODY_LIMIT` dan `client_max_body_size`; upload dokumen/gambar dibatasi 5 MB, lampiran task 100 MB per file (body nginx 101 MB khusus endpoint lampiran, request buffering dinonaktifkan). Periksa juga Maximum Upload Size zona Cloudflare; browser terbaru mengirim body file tanpa multipart.

## Sticky notes

Menu Sticky notes menyediakan canvas pribadi dengan edit otomatis, drag/resize, enam warna, pencarian, zoom, duplikat, dan hapus/urungkan. Data berada pada PostgreSQL (`mdpreview.sticky_board`) dan dibaca bersama deployment lokal/server. Konflik revisi melindungi perubahan antarperangkat. Detail dan batas fitur: [laporan Ruangku dan Sticky notes](reports/2026-11-25-ruangku-sticky-notes.md).
