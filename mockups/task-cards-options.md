# Opsi desain card task

Tanggal: 24 November 2026.

Buka [task-cards-options.html](task-cards-options.html) langsung di browser. Font Inter dan favicon memakai file lokal dalam repository. Tidak perlu menjalankan aplikasi atau tersambung ke database.

## Pilihan

| Opsi | Yang terlihat | Pertimbangan |
| --- | --- | --- |
| **A · Fokus, disarankan** | Judul, satu tag + jumlah lainnya, tenggat, ID, prioritas tinggi, jumlah dokumen/lampiran bila ada | Mengurangi baris tanpa menghilangkan konteks penting untuk pekerjaan harian. Deskripsi ada di detail. |
| **B · Konteks** | ID, prioritas tinggi, judul, cuplikan satu baris, dua tag + jumlah lainnya, rentang tanggal, resource | Membantu membedakan task yang serupa; card paling tinggi dari ketiga opsi. |
| **C · Ringkas** | Judul, ID, prioritas tinggi, tenggat; tag dan resource melalui chevron | Banyak task dapat dipindai sekaligus. Metadata membutuhkan satu interaksi tambahan. |

Tab **Bandingkan** menggunakan task yang sama pada ketiga desain. Seluruh isi merupakan contoh, termasuk tanggal acuan 24 November 2026. Task tanpa tag/tanggal/resource tidak menampilkan placeholder berulang di card; detail tetap menjelaskan properti yang belum diisi.

## Dasar rancangan

- Susunan card aplikasi sekarang memuat ID/prioritas, judul, cuplikan dua baris, tag, tanggal, dan referensi dalam beberapa kelompok terpisah. Perbaikan diarahkan pada jumlah baris dan prioritas informasi.
- Inter dan palet terang/Graphite mengikuti workspace. Tag netral; warna digunakan untuk status, prioritas tinggi, dan lewat tenggat dengan teks pendamping. Status tidak diulang pada tiap card karena sudah ada di kolom.
- Judul menjadi fokus dengan ukuran 14–15 px; metadata 10–12 px. Ruang dalam card, antar-card, dan antar-kolom berbeda agar pengelompokan terbaca.
- Opsi A/B memakai border halus untuk batas task. Opsi C memakai pemisah baris untuk mengurangi jumlah kotak. Shadow hanya untuk dialog. Ikon menjelaskan tanggal, dokumen, lampiran, atau prioritas.
- Arah visual: workspace pribadi yang tenang, ENERGY 1 / RHYTHM 1 / MOTION 1. Kolom konsisten untuk pemindaian berulang; motion hanya hover/focus.

## Interaksi mockup

Pemilihan opsi, mode Bandingkan, tema terang/Graphite, pencarian, hapus pencarian, judul pembuka detail baca-saja, tutup/Escape, expand metadata C, dan disclosure alasan desain berfungsi. Tab opsi mendukung panah kiri/kanan, Home, dan End; fokus terlihat. Sidebar hanya konteks visual dan tidak berupa navigasi aktif. Tidak ada CRUD, drag/drop, penyimpanan, atau request API.

## Delivery gate

- **Hard Gate PASS:** file dirender di Chrome desktop 1440 px dan 390 px, keempat mode pada kedua tema; seluruh 16 tampilan tidak menghasilkan overflow horizontal. Dialog, Escape, tombol tutup, expand/collapse, pencarian dengan hasil/kosong, reset, keyboard tab, dan disclosure dicatat melalui Chrome. Tidak ada exception JavaScript. Konten contoh diberi label; tidak ada klaim, statistik pemasaran, tautan palsu, atau kontrol kosong. View sinkron lokal tidak memiliki fase loading/network error.
- **Purpose Gate PASS:** alasan warna, tipografi, jarak, border, ikon dan penggunaan shadow tercantum di atas serta disclosure HTML. Tidak ada glow, gradient, ilustrasi, avatar, atau animasi dekoratif.
- **Liveliness PASS:** dials dan arah visual dinyatakan; judul task menjadi fokus, aksen mengikuti workspace, serta spasi membedakan kelompok informasi dan kolom. Varian card berbeda karena kebutuhan kepadatan, tanpa mengubah identitas produk.
- **Craftsmanship PASS:** font Inter lokal dimuat; tema dan kontrol tercatat bekerja; screenshot perbandingan Graphite, papan terang, dan mobile Ringkas diperiksa visual. Perhitungan kontras teks pada permukaan yang digunakan minimal 4.83:1 terang dan 5.79:1 Graphite; indikator/kontrol minimal 3.01:1 dan 3.51:1. Konten panjang dipotong pada card dan tersedia lengkap di detail.

## Batas cakupan

Ini file mockup untuk memilih rancangan. Tidak ada perubahan kode aplikasi, deployment, database, atau dokumen pengguna. PM2 tidak direstart karena aplikasi berjalan tidak berubah. Browser fisik mobile, Safari, Firefox, dan usability dengan pengguna belum diperiksa. Tidak ada suite test aplikasi yang ditambahkan atau dijalankan untuk tugas mockup ini.

## Implementasi opsi terpilih

Opsi A disetujui dan diterapkan pada 24 November 2026. Card aktif memakai judul dua baris, satu tag + jumlah lainnya, tanggal jika diatur, ID, prioritas tinggi, jumlah dokumen/lampiran dan indikator hasil terisi. Jika hanya tanggal mulai yang diatur, card menampilkan “Mulai”. Deskripsi tetap tersedia di detail dan pencarian. Arsip tetap menampilkan maksimal dua tag; timeline mengikuti tampilan sebelumnya.

- **Hard Gate PASS:** frontend asli dirender lewat fixture in-memory pada lebar 390/760/1000/1440 px, tema terang di root dan Graphite di /mynotes. Delapan tampilan tanpa overflow halaman/card dan tanpa exception JavaScript. Judul panjang terpotong dua baris, tag panjang menjadi ellipsis dan nama lengkap tersedia pada tooltip/detail. Detail tetap memuat deskripsi dan dua lampiran; pencarian menemukan isi deskripsi tersembunyi; dragstart/dragend dan timeline tetap berfungsi. Tidak ada suite test aplikasi yang dijalankan.
- **Purpose Gate PASS:** implementasi mengikuti alasan tipografi, spasi, warna, permukaan dan hierarki opsi A; menggunakan token Inter/Graphite yang sama. Ikon paperclip ditambahkan pada sprite bersama untuk jumlah lampiran. Tidak ada dependensi baru atau dekorasi tambahan.
- **Liveliness PASS:** judul tetap fokus utama; metadata berada dalam dua kelompok, satu tag netral dan footer ringkas. Aksen dibatasi untuk prioritas tinggi, status dan perhatian tenggat.
- **Craftsmanship PASS:** review kode independen terhadap empat file baseline tidak menemukan isu Critical/Important. Deploy membandingkan hash baseline server, membuat backup empat file, restart/save PM2, lalu memastikan kedua HTTPS root200 dan hash tiga asset publik sesuai versi e9a15bd194de.

Implementasi sudah deploy di kedua domain. Backup kode: /home/azmirf/backups/md-previewer/task-cards-focus-code-20261124T074054Z. Tidak ada perubahan skema/database atau data task produksi. Pengujian pada perangkat mobile fisik, Safari/Firefox, dan klik login produksi belum dilakukan.
