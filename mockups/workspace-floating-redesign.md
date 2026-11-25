# MD Previewer: floating workspace redesign

## Buka mockup

Buka [workspace-floating-redesign.html](workspace-floating-redesign.html) langsung di browser dari folder project. Font Inter, favicon, dan Vditor memakai aset lokal project. `node_modules` perlu tersedia, seperti pada instalasi project sekarang. Pertahankan file HTML di folder `mockups/` bersama `task-board-workspace-review.html`.

Seluruh konten adalah data contoh. Tidak ada request ke API aplikasi, PostgreSQL, R2, atau WebAuthn. Docs hanya disimpan dalam memori tab; refresh mengembalikan contoh awal. Task board menggunakan prototype yang sudah disetujui sebelumnya, termasuk draft browsernya.

### Membandingkan palet light mode

Pilih **Palet terang** pada bar Preview di atas konten. Keempat opsi memakai halaman dan data yang sama sehingga warna dapat dibandingkan langsung. Pilihan berlaku pada sidebar, area luar card, container, border, hover, dan task board embedded. Memilih palet mengaktifkan mode terang; beralih ke Graphite lalu kembali mempertahankan pilihan palet selama tab masih terbuka. Refresh kembali ke Neutral Gray. Kontrol ini khusus mockup.

| Palet | Sidebar / area luar | Container | Border |
| --- | --- | --- | --- |
| Neutral Gray (awal) | `#F6F8FA` | `#FFFFFF` | `#D8DDDA` |
| Warm Stone | `#ECE8E1` | `#FFFEFC` | `#DCD5CB` |
| Cool Slate | `#E7ECF2` | `#FFFFFF` | `#D3DBE5` |
| Muted Sage | `#E7ECE5` | `#FFFFFF` | `#D2DACE` |

Token bersama ada di `workspace-light-palettes.css`; pertahankan file tersebut di folder yang sama dengan kedua HTML. Inter dan aksen terracotta dipertahankan. Menu sidebar aktif memakai tint terracotta untuk menunjukkan lokasi; hover mengikuti keluarga palet. Shadow tidak diperkuat. Graphite dan prototype task board standalone tetap memakai tema sebelumnya.

## Design Read

Workspace pribadi untuk membaca, menulis dokumentasi, dan mengelola task. Bahasa visual mengikuti shell Garagist yang dikonfirmasi user pada 25 November 2026: sidebar pada latar bersama dan satu card utama yang memiliki scroll sendiri. ENERGY 1 / RHYTHM 2 / MOTION 1.

- **Sidebar:** 230 px, navigasi kompak, grup Workspace dan Pengelolaan, brand dan kontrol tampilan tetap terlihat. Area daftar dapat discroll. Folder menggunakan indent yang konsisten dan tidak mengulang nama parent di dalamnya.
- **Container:** inset 12 px desktop, radius 12 px, border tipis, shadow ringan. Header berada di luar area scroll konten. Hanya shell, dialog, dan popover mendapat elevasi.
- **Tipografi:** Inter lokal mengikuti identitas Notes. H1 28 px desktop dan 25 px mobile; ukuran isi dokumen mengikuti editor untuk keterbacaan.
- **Warna:** netral terang dan Graphite. Terracotta pada mode terang dan sand pada Graphite untuk aksi atau navigasi yang perlu penekanan. Warna status task tetap bermakna, dengan label teks.
- **Bentuk:** radius 4 sampai 8 px untuk kontrol dan item; 12 px untuk container utama. Tidak semua objek diberi card atau bayangan.
- **Ikon:** favicon dan simbol yang sudah digunakan project. Ikon folder/dokumen menunjukkan jenis konten, bintang hanya untuk favorit, panah hanya untuk expand/navigasi.
- **Mobile:** inset 7 px, sidebar menjadi sheet dengan scrim, daftar dokumen menjadi baris ringkas, properti task mengikuti prototype terakhir. Tabel task dan timeline mempertahankan scroll lokal agar tanggal tetap presisi.
- **Motion:** hover, expand, navigasi daftar isi; menghormati reduced motion. Tidak ada animasi dekoratif.

## Cakupan halaman

| Area | Cara mencoba | Revisi utama |
| --- | --- | --- |
| Ruang kerja | Sidebar atau `#home` | Lanjutkan dokumen, daftar root, aksi buat/upload |
| Folder | Tree, tabel, breadcrumb | Path berjenjang yang bisa diklik, filter tipe, folder kosong |
| Terakhir dibuka | `#recent` | Daftar dokumen dengan akses dan aksi yang konsisten |
| Markdown | Klik Meeting notes atau `#meeting` | Judul ringkas yang dapat di-rename, edit langsung pada Dokumen, tab Markdown, status autosave |
| Daftar isi | Kanan dokumen | Mengikuti klik dan scroll di dalam container |
| PDF | `#prd` | PDF contoh valid, viewer browser, fallback buka tab baru |
| Guest publik | Preview → Lihat guest atau `#guest` | Hanya dokumen terpilih dan daftar isi, tanpa indeks workspace |
| Dokumen privat | Bagikan → Privat → Preview guest | Halaman permintaan login, tidak menampilkan isi |
| Task board | `#tasks` | Papan, Daftar, Time table mingguan, Arsip |
| Detail task | Klik card task | Markdown deskripsi/hasil, properti, multi-tag, checklist 18 px, mention, lampiran |
| Pengelola task | Menu task board | Status, tag, saved views, filter dan draft recovery dari prototype terakhir |
| Sampah | `#trash` | Pulihkan dan konfirmasi hapus permanen |
| Template | `#templates` | Buat/edit/hapus dan buat dokumen dari template |
| Aktivitas | `#activity` | Riwayat dikelompokkan menurut hari, dengan waktu dan konteks |
| Keamanan | `#security` | Status verifikasi, daftar perangkat, penambahan passkey, bantuan terpisah |
| Login | Keluar atau `#login` | Login passkey terpusat, pembagian informasi dan aksi yang jelas |
| Pendaftaran | Login → Lihat pendaftaran awal | Nama perangkat dan simulasi pendaftaran |
| Handoff | Login → Masuk dengan passkey | Preview kembali ke domain workspace awal |

## Interaksi dan kontrak yang dipertahankan

1. **Dokumen:** isi autosave setelah berhenti mengetik. Mockup menyimpan contoh di memori, bukan ke server. Dokumen dapat diedit langsung di tab Dokumen atau melalui sumber Markdown.
2. **Rename:** klik judul. Batal tidak mengubah nama; hanya Simpan nama mengubah path contoh.
3. **Sharing:** pilihan Publik/Privat dan tautan path asli, salin tautan dengan fallback seleksi manual, preview guest. Tidak membuat URL share yang dimasking.
4. **Penghapusan:** konfirmasi dengan informasi referensi task, lalu pindah ke Sampah. Aksi ini hanya simulasi terhadap contoh dokumen.
5. **Upload Docs:** pilih/drop Markdown atau PDF, periksa nama dan preview, lalu Upload. Lokasi mengikuti folder yang sedang dibuka atau parent dokumen.
6. **Gambar:** drop/paste/pilih gambar pada dokumen Markdown, konfirmasi preview dan coba ukuran lewat slider atau sudut gambar. Resize hanya visual dalam mockup, tidak diserialisasikan ke dokumen atau disimpan sebagai file.
7. **Task:** perubahan isi/properti tetap diterapkan dengan Simpan task. Attachment menggunakan konfirmasi upload terpisah. Batas 10 lampiran / 50 MB per file tetap terlihat pada prototype task.
8. **Keamanan:** verifikasi diperlukan sebelum mengubah passkey. Passkey terakhir tidak dapat dicabut. Semua ini simulasi; tidak ada credential perangkat yang dibuat atau dicabut.
9. **Sesi:** copy UI menjelaskan sesi sampai 00.00 WIB, mengikuti aturan aplikasi sekarang. Tidak mengubah implementasi auth.
10. **Navigasi:** sidebar collapse desktop, sheet mobile, breadcrumb berjenjang, favorit dan unfavorite, pencarian `Ctrl/Cmd K`, highlight kotak, Enter pada hasil, Escape untuk menutup dialog.
11. **Preview kondisi:** kontrol Normal/Kosong/Memuat/Gagal memuat berada di bar khusus mockup. Bar ini tidak termasuk usulan UI produksi.

Task board sengaja memakai HTML prototype yang sudah ada melalui iframe embedded. Tambahan pada file tersebut hanya mode embed, sinkronisasi tema, dan kondisi preview; tampilan standalone sebelumnya tetap tersedia. Semua halaman lain memakai shell baru yang sama.

## Batas dan hal yang belum dilakukan

- Belum mengubah EJS, CSS/JS runtime, backend, schema, data, nginx, deployment, atau PM2. Belum commit/push pada task ini.
- Daftar aktivitas, metadata waktu, jumlah referensi, isi riwayat versi, dan perangkat adalah contoh berlabel. Bukan pembacaan data akun.
- Hasil upload Docs dan resize gambar hanya untuk sesi preview; pindah tampilan menghilangkan preview resize. Riwayat versi dan passkey hanya menunjukkan alur serta feedback simulasi.
- Viewer PDF dan date picker mengikuti browser/OS. Editor membutuhkan dependency Vditor yang sudah terpasang.
- Belum diuji pada ponsel fisik, Safari, Firefox, screen reader, atau autentikator passkey nyata. Tidak ada pemeriksaan performa atau audit keamanan baru.

## Delivery gate

Pemeriksaan menggunakan Chrome lokal dengan profil terpisah, fixture di browser, dan helper operasional ignored `.data/preview-floating-redesign.cjs`. Tidak menjalankan suite aplikasi atau koneksi database.

- **Hard gate PASS:** 15 jenis halaman diperiksa pada 390/760/1024/1440 px dalam terang dan Graphite; tidak ada horizontal overflow pada root atau scroll body. Header tetap pada y=13 px saat isi dokumen discroll. Collapse juga diperiksa pada 1920 px. Tidak ada inline HTML event handler atau em dash dalam UI HTML utama.
- **Interaksi PASS:** klik navigasi, breadcrumb, pencarian/highlight, rename simpan/batal, Markdown source/live editor, autosave, private/public/guest, preview upload MD/PDF/gambar, resize, batas ukuran/format, folder/dokumen baru, move, properties, history, favorit, template CRUD/pemakaian, Sampah restore/purge, dan simulasi passkey memberi perubahan atau feedback yang sesuai label.
- **Task embed PASS:** Papan/Daftar/Time table/Arsip/detail dapat dibuka; sidebar/header prototype lama disembunyikan hanya ketika embedded. Tema dan kondisi preview diteruskan dari shell. Detail task, draft, checklist, tag, dan lampiran tetap berasal dari prototype yang telah disetujui.
- **Warna PASS:** baseline awal mencakup 22 pasangan token terang/Graphite. Setelah penambahan empat palet, 28 pasangan tambahan meliputi teks utama pada card, teks sekunder pada ground/well/hover, accent pada tint, dan batas kontrol pada card/ground. Minimum teks pada pasangan tambahan 4.61:1; batas kontrol minimum 3.03:1. Editor diberi override eksplisit agar teks Graphite tidak mewarisi warna konten terang Vditor.
- **Keyboard PASS:** native link/button/form dan dialog, Enter/Escape pada pencarian, navigasi tab dengan panah/Home/End, fokus terlihat, dan tombol Menu dengan expanded state. Tidak mengklaim telah diuji dengan screen reader.
- **Kondisi PASS:** halaman kosong, memuat, dan gagal dapat dipilih di bar preview. Gagal memuat menyediakan Coba lagi. Task board memakai skenario prototype yang sama.
- **Purpose gate PASS:** hanya satu card shell yang melayang sesuai referensi user. Shadow lain untuk dialog/popover. Tidak ada gradient, glow, stock illustration, avatar foto, atau statistik produk buatan. Avatar huruf dan seluruh data diberi konteks contoh.
- **Liveliness PASS:** ENERGY 1 / RHYTHM 2 / MOTION 1; judul/aksi utama menjadi fokus, dokumen menggunakan kolom baca dan outline, task memakai papan/tabel/timeline, aktivitas memakai urutan waktu. Logo m., Inter, dan accent Notes dipertahankan.
- **Craft PASS:** jarak dan border memakai token bersama; desktop/mobile memiliki komposisi berbeda; tipe/tag/status diberi label, kontrol penting memiliki focus/hover/disabled state. Tidak menambahkan dependency atau frontend build.

Screenshot lokal: `.data/floating-gallery-<halaman>-<tema>-<lebar>.png` untuk 30 tampilan fresh, ditambah screenshot alur pada `.data/floating-*.png`. Screenshot ditinjau untuk shell, dokumen, guest, PDF, login, keamanan, task board, drawer, pencarian, dan upload. File bukti lokal ignored dan tidak menjadi dependency mockup.

### Iterasi empat palet — 25 November 2026

Preview lokal terpisah memeriksa empat palet pada Home, Markdown, Keamanan, dan task board di 1440/760/390 px. Token ground/card dan warna body iframe sesuai pilihan, tidak ada overflow root, pergantian Graphite tidak menimpa pilihan palet. Screenshot desktop untuk empat palet dan task board ditinjau; kontrol mobile dipindahkan ke baris sendiri setelah ditemukan overlap pada versi awal. Bukti `.data/floating-palette-*.png`; tidak ada request/write ke aplikasi atau database. Pemeriksaan ini hanya untuk perubahan mockup, bukan suite aplikasi. Batas browser/perangkat pada bagian sebelumnya tetap berlaku.

## Implementasi runtime — 25 November 2026

User menyetujui Neutral Gray `#F6F8FA` dan seluruh desain Garagist. Runtime sekarang memakai shell mengambang, sidebar tetap, header tetap, serta scroll di dalam card. Docs/folder/recent, Markdown/PDF, guest, login, Sampah, Template, Aktivitas, Keamanan dan task board memakai komposisi dan token bersama. Graphite tetap tersedia. Properti dokumen dan perubahan nama passkey memakai dialog yang sudah ada; editor template juga memakai dialog tersebut. Pilihan berbagi Privat/Publik menjadi dua pilihan yang jelas, tetap langsung menerapkan perubahan akses.

Heading tracking dan toolbar seleksi mengikuti scroll container. Status simpan dokumen terlihat di toolbar, rename file tetap manual, task tetap diterapkan lewat Simpan task, serta upload/attachment memakai alur konfirmasi yang sudah ada. API/backend/schema, durasi sesi, storage dan aturan akses tidak diubah.

Review visual memakai EJS/JS/CSS runtime dengan fixture Express di memori, tanpa PostgreSQL atau R2. Helper ignored `.data/preview-floating-app.cjs` mencakup 13 jenis halaman × 4 ukuran (390/760/1024/1440) × 2 tema, tanpa root overflow, scroll body, overflow container atau exception JavaScript. Klik outline workspace/guest mempertahankan header di y=13 px; collapse, menu mobile/fokus/inert, Properti, pilihan berbagi, mode source, dialog template/passkey dan task Papan/Daftar/Time table/detail ditinjau. PDF memakai sampel valid. Bukti `.data/floating-app-*.png` dan laporan `.data/floating-app-observations*.json`. Tidak menjalankan suite aplikasi.

Deployment 23 file frontend ke homeserver dengan backup kode privat `/home/azmirf/backups/md-previewer/floating-workspace-code-20261125T024333Z`. PM2 `md-previewer` direstart dan disimpan, PID 781487. Kedua domain merespons 200 dengan asset version `d8661282ef39`; masing-masing 18 aset cocok byte/hash dengan lokal. API workspace/task/passkeys tanpa login tetap 401. Snapshot digest sebelum/sesudah menunjukkan 144 entries dan 5 task tidak berubah. Tidak ada commit/push pada task ini.

Batas review runtime: belum memakai passkey sungguhan, menjalankan mutasi DB/R2, memakai ponsel fisik, Safari/Firefox atau screen reader. PDF/date picker tetap mengikuti browser/OS. Bagian delivery gate di atas menjelaskan tahap prototype sebelumnya, bukan hasil pengujian runtime tambahan.
