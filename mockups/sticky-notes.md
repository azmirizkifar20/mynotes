# Sticky notes: mockup interaktif

Tanggal: 25 November 2026

File: [sticky-notes.html](sticky-notes.html)

## Arah desain

Canvas catatan pribadi di dalam shell workspace Garagist yang sudah disetujui: sidebar Neutral Gray `#F6F8FA`, container putih mengambang, Inter, dan tema Graphite. Menu **Sticky notes** tepat di bawah **Task board**, sebelum **Terakhir dibuka**.

ENERGY 1 / RHYTHM 2 / MOTION 2: toolbar tenang, kartu bebas disusun dengan ruang antarkelompok, transisi pendek untuk catatan baru dan menu mobile. Reduced Motion mematikan animasi.

## Yang bisa dicoba

- **Catatan baru:** tambah kartu, langsung ketik judul dan isi.
- **Drag:** geser lewat pegangan di bagian atas kartu. Isi tetap bisa dipilih dan ditulis tanpa memindahkan kartu.
- **Resize:** tarik sudut kanan bawah.
- **Warna:** klik **Warna** atau menu **•••**, lalu pilih Kuning, Sage, Rose, Biru, Lilac, atau Stone. Warna yang dipilih ditandai centang dan nama; masing-masing punya pasangan warna Graphite.
- **Edit langsung:** judul dan isi memakai input teks biasa, dengan autosave browser. Judul maksimal 120 karakter; isi maksimal 10.000 karakter pada prototype.
- **Duplikat / hapus:** melalui menu kartu. Hapus bisa diurungkan lewat toast selama 10 detik.
- **Cari:** mencari judul dan isi, menyembunyikan kartu lain, dan menggeser viewport menuju hasil pertama. `Ctrl/Cmd K` memfokuskan pencarian.
- **Geser canvas:** pilih ikon tangan, lalu drag ruang kosong. Scroll tetap bisa dipakai.
- **Zoom:** tombol minus/plus, klik persentase untuk kembali ke 100%, dan **Tampilkan semua** untuk melihat kumpulan catatan.
- **Rapikan:** menyusun kartu dalam baris. Posisi sebelumnya bisa dikembalikan lewat **Urungkan**.
- **Tema:** Terang / Graphite melalui footer sidebar.
- **Reset contoh:** konfirmasi sebelum mengganti isi dengan lima kartu awal.
- **Panduan:** ikon tanda tanya menjelaskan interaksi dan keyboard.

Isi, posisi, ukuran, dan warna disimpan dengan key `mdpreview-sticky-notes-mockup-v1` di localStorage. Hanya data contoh browser yang berubah. Tidak menghubungi API, PostgreSQL, R2, atau file dokumen pengguna.

## Keputusan UI

| Bagian | Alasan |
| --- | --- |
| Canvas bertitik halus | Membantu orientasi ketika berpindah atau zoom pada area luas. |
| Sticky note berwarna | Warna dipilih pengguna untuk mengelompokkan ide; bukan status task. |
| Enam warna tetap | Cukup untuk mengelompokkan catatan, dengan pasangan teks dan Graphite yang terkontrol. |
| Bentuk hampir persegi dengan sudut kecil | Membedakan kertas catatan dari card shell dan kontrol aplikasi. |
| Shadow tipis pada note | Menunjukkan objek bisa dipindahkan dan ditumpuk. |
| Pegangan drag terpisah dari teks | Menghindari pergeseran ketika pengguna sedang menulis atau memilih teks. |
| Kontrol warna selalu terlihat | Bisa ditemukan tanpa hover, termasuk pada layar sentuh. |
| Toolbar ringkas | Aksi utama tetap Catatan baru; navigasi canvas berada dekat area yang dikendalikan. |
| Inter dan token workspace | Konsisten dengan Docs dan task board yang sudah disetujui. |
| Overlay zoom tetap di kanan bawah | Bisa digunakan meskipun canvas sedang berada jauh dari posisi awal. |

## Keyboard dan kondisi UI

- Tab mengikuti kontrol biasa; Enter/Space mengaktifkan tombol.
- Fokus pada pegangan drag, lalu tombol panah untuk menggeser 10 px. Shift + panah menggeser 30 px.
- Fokus pada pegangan resize, lalu tombol panah untuk mengubah ukuran.
- Menu warna mendukung panah, Home/End, Tab/Shift+Tab, dan Escape; fokus kembali ke pemicu setelah ditutup.
- Menu mobile mengunci fokus di navigasi. Escape menutupnya dan mengembalikan fokus ke Menu.
- Canvas kosong menyediakan **Catatan baru**; pencarian kosong menyediakan **Hapus pencarian**.
- Startup mempunyai status memuat. Data localStorage tidak valid menampilkan pemulihan **Gunakan data contoh**.
- Jika browser menolak penyimpanan, feedback menjelaskan perubahan hanya bertahan selama halaman terbuka.

## Delivery gate

- **Hard gate PASS:** preview Chrome lokal pada 1440, 1024, 760, dan 390 px, dalam Terang serta Graphite. Tidak ada overflow horizontal pada root/body; scroll horizontal hanya pada canvas yang memang luas. Tidak ada exception JavaScript. Konten jelas berlabel contoh. Kontras 32 pasangan teks diperiksa dengan formula checker antislop-human; minimum 5,14:1.
- **Purpose gate PASS:** alasan canvas bertitik, kartu, warna, shadow, ikon, tipografi, spacing, dan motion ditulis di atas. Ikon memakai bentuk kontrol workspace yang sama; tidak ada ilustrasi, gradient, statistik, atau klaim produk buatan.
- **Liveliness PASS:** canvas menjadi fokus halaman; posisi bebas menampilkan hubungan spasial antarkartu. Warna milik catatan pengguna; accent aplikasi hanya untuk navigasi/aksi. Transisi pendek membantu melacak objek baru dan menu.
- **Craft PASS:** warna mengikuti tema, focus state terlihat, kontrol sentuh tersedia, menu dan panduan punya Escape, serta kondisi kosong/memuat/gagal tersedia. Mockup berdiri sendiri tanpa dependency baru atau build frontend.

### Bukti interaksi

Preview lokal menggunakan profil Chrome terpisah dan HTTP server statis terbatas pada mockup/font. Tidak memakai browser atau data akun pengguna.

| Interaksi | Hasil preview |
| --- | --- |
| Warna → Biru → refresh | Warna tetap Biru. |
| Edit isi → refresh | Tulisan tetap tersedia. |
| Drag dan resize → refresh | Posisi dan ukuran disimpan. |
| Tambah → duplikat → hapus → urungkan | Jumlah kartu berubah sesuai aksi dan kembali setelah undo. |
| Pencarian tidak cocok → Hapus pencarian | Pesan kosong muncul, lalu kartu kembali. |
| Minus / plus / 100% / Tampilkan semua | Skala dan viewport berubah. |
| Mode tangan → drag canvas | Scroll kiri berpindah 120 px pada preview. |
| Rapikan → urungkan | Posisi awal dapat dipulihkan. |
| Panduan → Escape | Dialog ditutup. |
| Reset → batal / konfirmasi | Batal mempertahankan isi; konfirmasi mengembalikan lima kartu. |
| Pegangan drag/resize → panah kanan | Posisi/lebar bertambah 10 px. |
| Sidebar desktop / Menu mobile → Escape | Collapse desktop bekerja; menu mobile membuka/menutup dan melepas inert main. |
| Hapus seluruh kartu | Kondisi canvas kosong muncul dan bisa menambah catatan lagi. |
| Data preview tidak valid → pemulihan | Pesan gagal muncul, lalu contoh dapat dimuat ulang. |

Navigasi sidebar selain Sticky notes mengarah ke halaman mockup workspace sebelumnya; Hari ini menuju alamat aplikasi yang sudah ada di tab baru. Target diperiksa dari struktur file/routing, tanpa menjalankan mutasi aplikasi. Pencarian hasil pertama dan shortcut baru juga diperiksa lewat pembacaan kode.

Bukti lokal ignored: `.data/sticky-preview-observations.json`, `.data/sticky-contrast.json`, serta screenshot `.data/sticky-*.png`.

## Batas prototype

- Ini usulan UI, belum menu aplikasi yang terhubung ke backend. Tidak mengubah runtime, schema, nginx, deployment, atau PM2.
- Canvas contoh berukuran 2300 × 1550, bukan infinite canvas. Urutan tumpukan saat memilih kartu bersifat sementara; posisi/ukuran/warna tersimpan.
- Penyimpanan hanya di browser, belum sinkron antarperangkat, dan bisa hilang bila data browser dibersihkan. Tidak ada autentikasi atau penanganan konflik antartab pada prototype.
- Isi berupa teks biasa; belum Markdown, attachment, mention dokumen, atau konversi ke task.
- Belum diperiksa pada ponsel fisik, Safari/Firefox, atau screen reader. Tidak menjalankan suite pengujian aplikasi.
- Belum commit/push pada pekerjaan mockup ini.

## Revisi sidebar

Section akun di footer dihapus. Keluar berada tepat di bawah Keamanan dalam area sidebar yang bisa di-scroll; pada mockup menuju halaman login contoh. Pilihan tema tetap di footer.

Identitas project dan pencarian dikelompokkan dalam header tetap. Menu Ruang kerja diubah menjadi Workspace. Nama project menunggu pilihan user.

## Identitas Ruangku

Nama dan ikon di mockup mengikuti Ruangku / R. Urutan menu: Hari ini, Workspace, Task board, Sticky notes, Terakhir dibuka. Implementasi aplikasi dan penyimpanan PostgreSQL dijelaskan pada [laporan fitur](../reports/2026-11-25-ruangku-sticky-notes.md); HTML ini tetap prototype dengan data browser terpisah.
