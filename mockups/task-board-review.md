# Review UI/UX Task board

Tanggal: 23 November 2026. Cakupan: Papan, Time table mingguan, Arsip, detail task, tag/status, warna, tipografi, responsive, akses keyboard, dan feedback interaksi.

**Mockup:** [task-board-review.html](task-board-review.html). Buka langsung di browser; tidak memerlukan server atau koneksi database. Gunakan tombol **Hasil review** untuk ringkasan temuan dan palet warna, serta **Graphite / Terang** untuk berganti tema.

## Dasar review

Review memakai struktur dan CSS aplikasi saat ini, serta screenshot fixture task board dan detail task. Ini evaluasi desain berbasis implementasi, bukan hasil pengujian kegunaan dengan pengguna.

Sumber implementasi yang ditinjau:

- `src/frontend/public/css/task-board.css`, `tokens.css`, dan struktur shell yang dipakai task board.
- `src/frontend/views/partials/dialogs/task-board.ejs`.
- `src/frontend/public/js/features/task-board/view.js`, `controller.js`, `timeline.js`, `tags.js`, dan `mention-editor.js`.

Identitas yang dipertahankan: Inter, workspace bergaya Notion, tema terang dan Graphite, timeline Senin–Minggu, mention dokumen, URL yang dapat dibuka, hasil task, multi-tag, penyimpanan task manual, dan arsip manual.

## Temuan dan revisi

| Prioritas | Bagian | Masalah | Revisi yang divisualisasikan |
| --- | --- | --- | --- |
| Tinggi | Header | Ikon besar, kicker, judul, deskripsi halaman dan metadata mengambil banyak tinggi sebelum pekerjaan terlihat. | Judul 28 px, satu ringkasan task, dan Tambah task di sisi kanan. Informasi workspace cukup di breadcrumb/sidebar. |
| Tinggi | Toolbar | Tab, hitungan, pencarian, dua tombol pengelolaan dan tambah task berebut perhatian. | Aksi utama di header; tab dipisahkan secara visual dari pencarian dan Pengaturan. Kelola tag/status berada dalam disclosure berlabel. |
| Tinggi | Kartu | Kolom minimum sekitar 225 px membuat judul, deskripsi dan tag cepat membungkus. Hirarki metadata kurang jelas. | Kolom minimum 262 px, padding 16–18 px, gap kartu 12 px. Judul 14–15 px, cuplikan dua baris, ID/prioritas di atas, tanggal dan referensi di bawah. |
| Tinggi | Detail | Drawer sekitar 490 px memuat banyak properti dan dua editor tinggi secara berurutan. Tombol berbahaya dekat dengan Simpan. | Drawer 620 px, properti dua kolom, Deskripsi/Hasil bertab dengan buffer terpisah, header/footer tetap. Hapus/Arsip di menu aksi tambahan. |
| Tinggi | Warna Graphite | Kartu dan halaman terlalu mirip; pembatas/input turut menyita perhatian. | Sidebar lebih gelap, halaman sedang, kartu sedikit lebih terang. Border struktur lembut; kontrol yang membutuhkan batas memiliki border lebih jelas. |
| Sedang | Tag | Banyak tag memakan tinggi kartu; semua pilihan tag di detail menambah keramaian. | Dua tag lalu +n pada kartu. Detail menampilkan pilihan aktif; daftar berisi pencarian baru muncul saat diminta. |
| Sedang | Time table | Tanggal lengkap/status dalam label baris membuat area kiri padat. Kontrol minggu mudah membungkus. | Judul rentang minggu, kontrol tanggal satu kelompok, label task dan tanggal singkat, tujuh kolom hari, bar berwarna lembut. Scroll horizontal hanya di tabel dan label task tetap terlihat. |
| Sedang | Arsip | Pengulangan bentuk kartu lebar kurang efisien untuk item yang tidak lagi aktif. | Daftar ringkas berisi judul, tag, status, tanggal arsip dan Pulihkan. Mobile menjadi dua tingkat. |
| Sedang | Warna informasi | Aksen pada terlalu banyak objek membuat prioritas visual kurang tegas. | Tag netral, aksen pada aksi/mention/fokus, status memakai dot dan teks. Lewat tenggat diberi label eksplisit. |
| Sedang | Mobile | Toolbar membungkus tanpa pola; kolom kanban sempit; kontrol kecil. | Tab dan utilitas dalam dua baris, satu kolom status per bagian, drawer penuh, input 16 px dan target utama 44 px. Timeline tetap dapat digeser di dalam komponennya. |
| Sedang | Feedback | Pengguna perlu tahu perubahan yang belum disimpan dan hasil yang sudah terisi. | Indikator perubahan pada footer, titik berlabel aksesibel pada tab Hasil, konfirmasi sebelum membuang perubahan, serta toast setelah tindakan. |

Pada screenshot desktop 1440 px, kartu pertama aplikasi lama berada sekitar y=435 px. Dalam mockup, kartu pertama berada sekitar y=285 px jika strip khusus mockup dikeluarkan. Angka ini hanya membandingkan fixture tersebut; jumlah task, teks, zoom, dan lebar layar dapat mengubah hasil.

## Peran warna setiap objek

Warna sengaja dibatasi. Status mempunyai makna; tag hanya mengelompokkan. Prioritas tinggi dan tenggat lewat selalu disertai teks atau ikon sehingga informasi tidak bergantung pada warna.

| Objek / peran | Terang | Graphite | Penggunaan |
| --- | --- | --- | --- |
| Halaman | `#FCFCFB` | `#202123` | Permukaan utama, cukup tenang untuk banyak kartu. |
| Sidebar / strip konteks | `#F5F5F3` | `#191A1C` | Konteks navigasi, lebih rendah daripada konten aktif. |
| Kartu / dialog / input | `#FFFFFF` | `#2A2C2F` | Satu tingkat terangkat dari halaman. |
| Tag / header tabel / konteks sekunder | `#F1F3EF` | `#242629` | Pengelompokan netral, tanpa membuat semua tag menonjol. |
| Teks utama | `#282C28` | `#ECECE8` | Judul, isi utama dan label pilihan aktif. |
| Teks pendukung / ikon | `#62685F` | `#B1B6BD` | Cuplikan, tanggal, ID, label properti dan helper. |
| Border struktur | `#E0E3DC` | `#3C4045` | Pemisah kartu, kolom/tabel, header/footer. Tidak menjadi satu-satunya petunjuk interaksi. |
| Border kontrol | `#8D9588` | `#79808A` | Pencarian, input, select, editor dan tombol sekunder. |
| Hover netral | `#E9EDE5` | `#34383C` | Tombol sekunder dan pilihan menu; kartu memakai border yang lebih jelas. |
| Navigasi terpilih | `#E4E9DF` | `#373C40` | Item sidebar aktif, disertai teks lebih tegas. |
| Aksi utama | `#353D32` | `#DFBD94` | Tambah task dan Simpan. Teks putih pada terang, `#23201B` pada Graphite. |
| Aksen / fokus | `#98472E` | `#DFBD94` | Focus ring, mention, URL, hari ini dan prioritas tinggi. URL juga bergaris bawah. |
| Latar mention / hari ini | `#F6ECE6` | `#3B332B` | Penanda konteks, bukan satu bidang warna dominan. |
| Ide: teks / latar | `#596353` / `#EAF0E6` | `#C0C9B8` / `#353C31` | Status netral. |
| Siap: teks / latar | `#37657E` / `#ECF3F8` | `#B1D0E4` / `#293A45` | Siap dikerjakan. |
| Dikerjakan: teks / latar | `#78521B` / `#F7F0E1` | `#E1C18B` / `#413727` | Sedang berlangsung. |
| Selesai: teks / latar | `#356747` / `#EAF3EC` | `#B2D3B5` / `#2A3C31` | Status selesai, tidak otomatis diarsipkan. |
| Bahaya: teks / latar | `#983C35` / `#F9ECE9` | `#F0B1A9` / `#442E2C` | Hapus, validasi gagal dan label lewat tenggat. |
| Backdrop | `#15181277` | `#08090ACC` | Memisahkan dialog tanpa menghilangkan konteks papan. |
| Toast | Teks/latar utama dibalik | Teks/latar utama dibalik | Feedback singkat dengan `role=status`; tidak mengandalkan warna sukses. |

### Kontras yang dihitung

Pemeriksaan memakai rumus luminansi sRGB untuk pasangan token yang benar-benar dipakai: teks utama/pendukung pada halaman, sidebar, kartu, konteks sekunder, hover dan terpilih; status pada latarnya; teks tombol utama; aksen pada mention dan kartu; error pada kartu; serta border/fokus pada halaman/kartu.

| Tema | Minimum pasangan teks yang diperiksa | Minimum border/fokus yang diperiksa |
| --- | --- | --- |
| Terang | 4,64:1 | 3,01:1 |
| Graphite | 5,47:1 | 3,51:1 |

Ini pemeriksaan pasangan warna, bukan sertifikasi aksesibilitas seluruh halaman. Border struktur sengaja lebih halus dan tidak dipakai sebagai satu-satunya batas kontrol. Jangan menambahkan opacity pada teks pendukung atau border kontrol karena akan menurunkan kontras. Disabled memiliki label/state native dan tidak menjadi patokan rasio teks aktif.

## Tipografi, spacing, dan bentuk

- Tetap Inter. Judul halaman 28 px, judul task 14–15 px, cuplikan kartu 13 px, editor 14 px desktop / 16 px mobile.
- Metadata utama 11–12 px. Teks kecil khusus ID/hint perlu tetap singkat; informasi penting harus bisa dibaca melalui detail.
- Baris isi sekitar 1,55–1,8, tidak dipadatkan untuk memuat lebih banyak kartu.
- Padding kartu 16–18 px, gap kartu 12 px, jarak kolom 20 px, halaman 24–32 px.
- Radius kecil 4–6 px. Tanpa gradient, bayangan kartu besar, atau warna berbeda untuk setiap tag.
- Tombol utama solid, tombol sekunder berborder, tombol konteks tenang. Hapus tetap bertuliskan Hapus pada konfirmasi.

## Perilaku yang bisa dicoba

1. Pindah Papan, Time table, dan Arsip; cari judul, deskripsi, hasil atau nama tag.
2. Klik kartu/bar timeline untuk detail; ubah judul, status, prioritas, tanggal dan tag, lalu Simpan.
3. Pindah Deskripsi/Hasil tanpa kehilangan buffer. Hasil yang terisi diberi indikator. Ketik `@` untuk suggestion dokumen contoh; mention membuka preview lokal, URL yang sudah dirender membuka tab baru.
4. Coba tanggal akhir sebelum tanggal mulai; form menolak. Menutup task yang berubah meminta konfirmasi membuang perubahan.
5. Buka Pengaturan untuk menambah/mengubah/menghapus nama tag atau status. Perubahan manager diterapkan saat Simpan; hapus meminta konfirmasi.
6. Seret kartu ke status lain, arsipkan task berstatus selesai, lalu pulihkan melalui Arsip. Arsip hanya baca.
7. Navigasi minggu sebelumnya/berikutnya, pilih tanggal, atau kembali ke Minggu ini. Task tanpa tanggal berada di bagian tersendiri.
8. Ganti tema Terang/Graphite dan kecilkan browser ke ukuran HP.

Semua perubahan hanya di memori halaman. Refresh mengembalikan data contoh. Sidebar hanya konteks visual. Mockup tidak mengakses `.env`, dokumen asli, akun/passkey, database, atau API aplikasi.

## Batasan dan keputusan yang perlu dibawa ke implementasi

- Kolom yang lebih lebar meningkatkan keterbacaan, tetapi papan desktop kecil membutuhkan scroll horizontal. Pada HP, kolom ditumpuk sehingga melihat semua status memerlukan scroll vertikal.
- Pengaturan membutuhkan satu klik tambahan. Ini sesuai frekuensi CRUD status/tag yang lebih rendah daripada membuka atau menambah task.
- Tab Deskripsi/Hasil mengurangi scroll, tetapi keduanya tidak terlihat bersamaan. Indikator hasil terisi dan penyimpanan satu form membantu memperjelas konteks.
- Manager status di mockup menunjukkan nama, penanda selesai dan penghapusan. Urutan serta warna status belum dapat diedit di demo; implementasi aplikasi harus tetap mempertahankan fitur warna/urutan yang sudah ada.
- Penghapusan status demo memindahkan task ke status pertama yang tersisa. Aplikasi harus tetap meminta tujuan pemindahan secara eksplisit seperti sekarang.
- Suggestion mention demo memakai daftar kecil, mengikuti teks `@` di akhir editor, dan penyisipannya disederhanakan. Editor aplikasi harus mempertahankan perilaku caret/keyboard/tautan dan referensi dokumen sebenarnya.
- URL yang baru diketik menjadi hyperlink setelah editor dirender ulang, misalnya pindah tab atau buka ulang detail. Demo tidak mereplikasi seluruh logika rich editor produksi.
- Batas tanggal picker demo 1900–9998. Aplikasi tetap mengikuti validasi dan rentang tanggal yang sudah didukung modul timeline.
- Validasi panjang/kosong, konflik antarperangkat, error API, izin dokumen, ID stabil, referensi rename/delete dan keamanan tautan tetap mengikuti backend yang sudah ada. Desain tidak mengubah kontrak tersebut.
- Saat implementasi, loading harus mempertahankan struktur halaman; error menyediakan Coba lagi tanpa membuang input; konflik menyimpan buffer hingga pengguna meninjau data terbaru. Empty state pencarian berbeda dari papan/arsip kosong.

## Pemeriksaan mockup

- JavaScript dapat diparse dan interaksi inti diperiksa melalui Chrome: data contoh, pencarian/empty state, buffer kedua editor, manual save, validasi tanggal, konfirmasi tutup, tag CRUD contoh, timeline mingguan, arsip/pulihkan, mention/URL, dan escaping judul.
- Tema terang/Graphite diperiksa pada lebar 390, 760, 1024 dan 1440 px; tidak ada overflow horizontal halaman, timeline berada dalam area scroll sendiri, drawer mobile tidak meluber.
- Screenshot papan desktop, timeline, detail dan mobile ditinjau secara visual.
- Navigasi tab dengan tombol panah/Home, membuka kartu dengan Enter, dan menutup detail dengan Escape diperiksa memakai event keyboard native Chrome. File HTML proyek serta salinan inline chat melewati pemeriksaan interaksi yang sama.
- Pemeriksaan hanya menyentuh file mockup. Source aplikasi, schema/database, dokumen, sesi pengguna dan deployment tidak diubah.
- Belum diperiksa pada HP fisik, Safari/Firefox atau pembaca layar. Perilaku keyboard, fokus, zoom dan editor perlu ditinjau lagi saat diterapkan ke komponen aplikasi.

## Urutan penerapan yang disarankan

1. Header, toolbar, lebar kartu, tipografi dan token warna: dampak terbesar dengan perubahan perilaku paling kecil.
2. Detail bertab, picker tag, footer aksi dan proteksi buffer; pertahankan seluruh kontrak manual save dan konflik.
3. Tata letak timeline/arsip/mobile, lalu pemeriksaan regresi pada kedua mount aplikasi dan kedua tema.

Belum diterapkan ke aplikasi aktif; file ini menjadi bahan review sebelum eksekusi desain.
