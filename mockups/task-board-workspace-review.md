# Revisi UI/UX task board: seluruh alur

24 November 2026. [Buka mockup HTML](task-board-workspace-review.html).

Buka langsung di browser dari folder `mockups/`. Font Inter, favicon dan editor Vditor menggunakan aset relatif yang sudah ada di repository; jalankan `npm install` jika dependensi belum tersedia. Tidak perlu menjalankan aplikasi atau menyediakan kredensial database.

## Dasar dan arah desain

Review meninjau implementasi terbaru, termasuk fitur filter/view, daftar, checklist, dan draft yang baru ditambahkan. Sumber utama: `task-board/view.js`, `controller.js`, `drafts.js`, `mention-editor.js`, partial dialog task board, `task-tools.css`, dan preview frontend lokal. Ini evaluasi desain berbasis implementasi, bukan pengukuran usability dengan pengguna.

Identitas mengikuti keputusan pengguna: Inter, workspace pribadi bergaya Notion, Graphite dan terang, kartu Focus. Energi 1 / ritme 2 / gerak 1. Halaman membantu memilih pekerjaan berikutnya; detail membantu membaca dan menulis konteks serta hasil. Tidak menambahkan dashboard statistik, avatar, assignment, atau kolaborasi tim.

Tiga pendekatan yang dipertimbangkan:

1. **Rapikan jarak saja:** perubahan kecil, tetapi kepanjangan drawer dan ambiguitas penyimpanan tetap ada.
2. **Kelompokkan kontrol dan tata ulang detail (direkomendasikan, ditampilkan):** kartu Focus dipertahankan, filter disembunyikan saat tidak dibutuhkan, detail memakai kolom isi/properti. Cakupan fitur dan cara penyimpanan tetap sama.
3. **Detail menjadi halaman penuh:** ruang menulis paling besar, tetapi berpindah task kehilangan konteks papan dan membutuhkan navigasi tambahan. Belum diperlukan untuk task pendek saat ini.

## Temuan dan revisi

| Prioritas | Bagian | Temuan | Revisi dalam mockup |
| --- | --- | --- | --- |
| Tinggi | Toolbar/filter | Tab, pencarian, shortcut tanggal, selector view dan tombol simpan bersaing dalam beberapa baris. | Tab tetap terpisah; satu tombol Filter membuka panel. Chip aktif bisa dilepas satu per satu; jumlah hasil tetap terlihat. |
| Tinggi | Saved view | Pilihan view, filter yang diubah dan tindakan overwrite belum cukup dibedakan. | Label **Filter diubah**, aksi simpan kontekstual, pilihan **Perbarui view terpilih** atau **Simpan sebagai view baru**. Hapus/rename di pengaturan. |
| Tinggi | Detail | Properti, dua editor, checklist dan lampiran membuat drawer panjang. | Drawer maksimal 910 px, isi di kiri dan properti di kanan. Pada HP properti dilipat menjadi ringkasan status/tenggat dan bisa dibuka menjadi grid dua kolom. |
| Tinggi | Penyimpanan | Status draft, perubahan belum diterapkan, dan upload langsung tersimpan berpotensi dianggap proses yang sama. | Strip draft, footer status penerapan, tombol **Simpan task**. Lampiran mempunyai label **Langsung disimpan** dan konfirmasi tersendiri. |
| Tinggi | Mobile | Judul panjang dapat terpotong; drawer dan halaman berpotensi memiliki scroll bersamaan. | Judul menyesuaikan tinggi, body terkunci saat modal terbuka, hanya isi drawer yang bergulir. Header/footer tetap terlihat. |
| Sedang | Kartu | Menambah indikator untuk setiap fitur baru akan mengembalikan kepadatan lama. | Pertahankan Focus: judul dua baris, satu tag +n, tanggal, ID, prioritas tinggi dan sumber jika ada. Checklist tidak menambah baris di kartu. |
| Sedang | Daftar | Border pada semua input membuat tabel seperti form panjang. | Kontrol lebih tenang dengan border saat hover/fokus; judul dominan dan hint edit langsung tersimpan. Tanggal/status tetap berlabel untuk pembaca layar. |
| Sedang | Time table | Navigasi minggu, tanggal dan status mudah bertumpuk. | Satu kelompok navigasi, tujuh hari, label task sticky, bar status lembut, tanpa jadwal di disclosure. Default minggu berjalan berdasarkan tanggal lokal. |
| Sedang | Editor | Helper Markdown dan mention panjang berulang; hasil yang sudah ada kurang terlihat. | Toolbar kecil, satu hint @, penghitung karakter, label **Terisi** di tab Hasil. Buffer kedua tab tetap terpisah. |
| Sedang | Checklist | Bagian kosong mengambil ruang besar sebelum lampiran. | Disclosure dengan progres. Terbuka jika sudah ada item; tambah/hapus/centang tetap disimpan bersama task. |
| Sedang | Lampiran | Daftar format dan helper lebih menonjol daripada file. | Ringkas menjadi nama, jenis dan ukuran; format lengkap di disclosure. Maksimal 10 file/50 MB tetap jelas. |
| Sedang | Upload | Konfirmasi dan kegagalan perlu mempertahankan file pilihan. | Validasi per file, modal konfirmasi, progres, simulasi gagal dan coba lagi. File tidak diupload saat baru dipilih/drop. |
| Sedang | Arsip | Task arsip tidak boleh tampak seperti form yang masih bisa diedit. | Daftar ringkas, label arsip, properti/editor/checklist hanya baca, aksi **Pulihkan task**. |
| Sedang | Pengaturan | Hapus status/tag berpengaruh pada banyak task. | Jumlah task, konfirmasi dampak, status tujuan eksplisit, warna/urutan/penanda selesai, dan simpan pengaturan secara manual. |
| Sedang | Warna | Aksen menyebar ke semua objek menambah kebisingan. | Tag netral, status semantik, aksen pada mention/pilihan/aksi, bahaya disertai teks. Tiga tingkat permukaan Graphite. |
| Sedang | Feedback | Kosong, hasil filter kosong, loading, error dan konflik memerlukan tindakan berbeda. | Skenario khusus di strip mockup; reset, coba lagi, pulihkan draft, muat ulang dengan buffer dipertahankan. |

## Cakupan semua fitur

| Fitur | Cara mencoba |
| --- | --- |
| Papan/status | Buka kartu; seret kartu ke kolom lain; tambah task dari tombol halaman atau plus kolom. |
| Task CRUD | Tambah judul, properti dan isi; Simpan task. Hapus lewat menu lainnya dan konfirmasi. |
| Pencarian | Cari judul, isi, hasil atau nama tag; hasil nol menyediakan reset. |
| Filter | Status, tag, prioritas, rentang tenggat, Hari ini/Lewat tenggat; lepas chip atau reset. |
| Saved view | Simpan, pilih, ubah filter, perbarui atau simpan sebagai baru; rename/hapus lewat pengaturan. |
| Daftar | Ubah status/tanggal langsung; rentang tanggal tidak valid ditolak. Klik judul membuka detail. |
| Time table | Minggu berjalan, navigasi minggu, tanggal acuan, Minggu ini, task tanpa jadwal, klik bar/detail. |
| Jadwal/prioritas | Tanggal mulai/tenggat opsional; tenggat sebelum mulai ditolak. Prioritas tinggi tetap terlihat di kartu. |
| Deskripsi/hasil | Editor Vditor Markdown yang sudah dipakai aplikasi. Coba bold/italic/heading/list/link/kode; pindah tab tetap menyimpan buffer. |
| Mention MD/PDF | Ketik @ dan nama dokumen contoh, panah/Enter/Tab atau klik. Mention bisa membuka preview lokal. |
| Hyperlink | URL HTTP/HTTPS di editor; tautan bisa dibuka di tab baru. |
| Checklist | Tambah, edit, centang, hapus, progres. Diterapkan saat Simpan task. |
| Multi-tag | Cari/pilih/lepas tag. Kelola tag menyediakan tambah, rename, hapus dan jumlah task. |
| Status CRUD | Tambah, rename, ubah warna, urutkan, tandai selesai; hapus dengan pemindahan task eksplisit. |
| Arsip manual | Task selesai dapat diarsipkan dari detail setelah perubahan diterapkan. Arsip hanya baca; pulihkan kembali ke papan. |
| Draft | Ubah form, tunggu status draft tersimpan, tutup dan buka lagi. Pulihkan atau buang secara eksplisit. Skenario draft juga tersedia di strip atas. |
| Lampiran | Task tersimpan: pilih/drop beberapa file → konfirmasi → Upload file. PDF/ZIP/RAR/Excel/PPT/MD/gambar/video. Maks.10/50 MB. |
| Preview/hapus lampiran | Buka file lokal yang baru ditambahkan; PDF/gambar/video memakai viewer browser. Hapus memerlukan konfirmasi dan langsung memengaruhi task contoh. |
| Gagal/konflik | Pilih skenario di strip atas; upload gagal dapat disimulasikan pada konfirmasi. Form task dipertahankan saat konflik. |

### Tiga jenis penyimpanan yang perlu jelas

| Tindakan | Efek dalam aplikasi yang harus dipertahankan |
| --- | --- |
| Mengetik pada detail | Simpan draft setelah debounce; belum mengubah task di papan. |
| Simpan task | Terapkan judul, properti, deskripsi/hasil, tag dan checklist sekaligus. |
| Edit cepat / drag status / upload atau hapus lampiran | Berlaku langsung, dengan feedback; lampiran meminta konfirmasi terlebih dahulu. |

## Warna, tipografi dan komponen

- Gunakan token terang/Graphite dari review sebelumnya. Surface halaman `#FCFCFB` / `#202123`, kartu `#FFFFFF` / `#2A2C2F`, sidebar `#F5F5F3` / `#191A1C`.
- Teks utama `#282C28` / `#ECECE8`, pendukung `#62685F` / `#B1B6BD`; aksen terracotta `#98472E` / sand `#DFBD94`.
- Status memakai teks + dot, bukan warna saja. Tag tidak diberi warna per kategori. Lewat tenggat diberi kata **Lewat**.
- Inter tetap mengikuti pilihan pengguna. Judul halaman27 px, judul detail25 px, judul kartu14 px; editor16 px pada HP.
- Radius4–7 px, border struktur halus dan kontrol lebih jelas. Shadow hanya pada dialog/menu, tanpa glow atau gradient dekoratif.
- Motif workspace tetap hubungan dokumen-task: mention berpunggung aksen, ID task ringkas, kolom status dan tulisan menjadi fokus. Tidak menambah panel statistik.
- Gerak hanya feedback hover/perubahan warna, mengikuti prefers-reduced-motion. Garis timeline menunjukkan hari/jadwal, bukan dekorasi halaman.

## Batas mockup dan syarat implementasi

- **Belum diterapkan ke aplikasi aktif.** Semua task, tag, view dan file awal adalah contoh. Tidak ada koneksi DB/API/R2, pembacaan `.env` atau dokumen pribadi.
- Data papan dan file baru hanya di memori halaman. Refresh mereset contoh. Draft memakai sessionStorage tab ini agar recovery bisa dicoba; aplikasi produksi tetap memakai PostgreSQL dan pemeriksaan token/revisi.
- Upload hanya simulasi lokal, tidak mengirim bytes ke server. File lokal memakai object URL; browser menentukan dukungan preview. Lampiran PDF awal hanya contoh tanpa bytes.
- Mention membuka preview contoh lokal; produksi harus tetap membuka dokumen asli di tab baru melalui endpoint berizin. Suggestion mockup membaca @ di akhir editor, belum menyamai pencarian caret produksi di tengah paragraf.
- Konflik/loading/error pada strip atas adalah skenario, bukan permintaan ke server. Produksi harus mempertahankan token CAS, validasi, auth/origin, private docs, safe links, dan buffer saat error.
- Task maksimal120 karakter judul, editor3.000 karakter/field,100 checklist x200 karakter,20 tag,20 view,50 status dan100 tag tetap mengikuti batas yang ada.
- Pengaturan demo disimpan saat Simpan pengaturan; tutup perubahan yang belum disimpan meminta konfirmasi. Produksi perlu menjaga perubahan multi-device dan membatalkan transaksi secara utuh saat validasi gagal.
- Pada desktop kecil, kanban/tabel/timeline dapat digeser di komponennya. Pada HP kanban menjadi status bertumpuk; detail menjadi layar penuh dengan properti yang bisa dilipat.
- Tidak perlu migrasi database atau perubahan kontrak backend untuk tata letak ini. Implementasi berikutnya harus mempertahankan semua fitur yang sudah aktif.

## Revisi dropdown, 24 November 2026

- Semua select pada mockup menggunakan tampilan terinspirasi shadcn: trigger beradius 6 px, chevron, panel beradius 8 px, padding opsi yang lebih lega, hover, fokus dan centang pilihan aktif. Shadow hanya menandai panel yang berada di atas konten.
- Status tetap membawa warna semantik yang sama dengan kolom papan. Prioritas, filter, view tersimpan, skenario dan pengaturan memakai pola panel yang konsisten. Panel menggunakan warna terang/Graphite yang sudah ada, tanpa dependency baru atau perubahan framework.
- Panel popover berada di atas dialog agar tidak terpotong oleh drawer, membuka ke atas jika ruang bawah sempit, dan dibatasi viewport. Opsi pada layar kecil mempunyai tinggi minimum 44 px.
- Select asal tetap menyimpan nilai dan memicu event input/change yang sudah dipakai mockup. Dropdown dinamis pada daftar task dan pengaturan status mengikuti tampilan yang sama. Navigasi mendukung panah, Home/End, Enter/Space, Escape, Tab dan pencarian dengan mengetik awalan nama.
- Preview lokal Chrome pada 1440 dan 390 px, tema terang/Graphite: pilihan filter memperbarui papan, pilihan properti tetap tersimpan dalam draft, edit cepat daftar memperbarui status, dan pilihan warna pengaturan memperbarui form. Escape menutup dropdown tanpa menutup detail; fokus kembali ke trigger setelah memilih. Tidak ada exception browser atau overflow halaman/panel pada ukuran tersebut.
- Ini komponen mockup HTML, bukan pemasangan paket shadcn. Belum diperiksa di Safari/Firefox atau pembaca layar dan belum diterapkan ke aplikasi aktif.

## Revisi pilihan tag, 24 November 2026

- Pilihan tag menjadi panel multi-select dengan pencarian di atas, nama tag rata kiri dan checkbox 18 px rata kanan. Lebar checkbox dibatasi secara eksplisit agar tidak mengikuti aturan input teks selebar kolom.
- Tag terpilih berupa chip ringkas dengan tombol lepas. Saat belum dipilih, hanya tampil trigger "Pilih tag", tanpa baris kosong tambahan. Panel menampilkan jumlah tag terpilih, batas 20 tag dan tombol Selesai.
- Panel memakai permukaan, border dan fokus yang sama dengan dropdown sebelumnya; daftar bisa digulir tanpa memanjangkan properti task. Nama panjang boleh membungkus. Checkbox tetap native dan mempunyai label; nama dan checkbox bisa diklik sebagai satu baris.
- Pencarian, pilihan lebih dari satu tag, pelepasan chip, hasil kosong, Escape dan navigasi panah/Space diperiksa pada preview Chrome. Fokus checkbox dipertahankan saat daftar diperbarui. Tema terang/Graphite pada 1440 dan 390 px ditinjau, checkbox tetap 18 px, panel berada dalam viewport dan tidak ada exception browser. Perubahan pilihan tetap mengikuti draft dan Simpan task yang sudah ada.
- Perubahan hanya pada mockup. Belum diuji di perangkat fisik, Safari/Firefox atau pembaca layar.

## Revisi tanggal view Daftar, 24 November 2026

- Wording UI diseragamkan menjadi "Deadline", termasuk detail, header daftar, filter, ringkasan, tooltip, label aksesibel dan pesan validasi. Istilah pada catatan review sebelumnya adalah dokumentasi revisi terdahulu.
- Kolom Mulai dan Tenggat mempunyai lebar tetap 164 px, padding yang selaras dengan header, kontrol seragam dan ikon kalender di posisi kanan yang sama. Angka menggunakan tabular numerals agar rata antarbaris. Kolom status diberi ruang 200 px; tabel tetap bisa digeser pada layar sempit.
- Tanggal dibaca sebagai "23 Nov 2026", tanpa potongan angka dan separator input native. Nilai kosong tampil "Belum diatur" dengan border putus-putus; tenggat lewat memakai border/latar semantik dan label aksesibel "Lewat tenggat".
- Klik atau aktivasi keyboard membuka pemilih tanggal bawaan browser. Kontrak edit cepat tetap berlaku: perubahan langsung diterapkan ke data contoh, tanggal bisa dikosongkan, dan akhir tidak boleh sebelum mulai. Input menyertakan batas min/max; validasi perubahan yang sudah ada tetap dijalankan. Fokus kembali ke tombol tanggal setelah perubahan.
- Preview Chrome terang/Graphite pada 1440 dan 390 px: format, nilai kosong, overdue, pembukaan kalender lewat klik, edit/clear, penolakan rentang tidak valid dan scroll tabel diperiksa. Tidak ada exception browser atau overflow horizontal halaman. Kontrol tanggal mobile setinggi minimum 44 px.
- Ini perubahan mockup. Kalender masih mengikuti UI browser/OS; belum ditinjau di Safari/Firefox, perangkat fisik atau pembaca layar.

## Pemeriksaan dan delivery gate

- Preview lokal Chrome memakai file HTML langsung, dengan editor Vditor yang terpasang. JavaScript berhasil diparse; tidak ada exception browser pada alur yang diperiksa.
- Diperiksa pada1440,1024,760 dan390 px, tema terang/Graphite: Papan, Daftar, Time table, Arsip dan detail task. Tidak ada overflow horizontal halaman/drawer. Scroll horizontal daftar/timeline berada di komponennya. Screenshot papan terang, daftar terang, timeline Graphite, detail desktop dan detail mobile Graphite ditinjau secara visual.
- Alur yang dicoba: filter/chip/reset, view baru/ubah/salin/rename/hapus, task tambah/edit/hapus, buffer editor bertab, mention, checklist tambah/edit/centang/hapus, multi-tag, draft tutup/pulihkan/refresh, penolakan tanggal, edit cepat, upload gagal/coba lagi, drop konfirmasi, tipe/ukuran/jumlah lampiran, preview contoh/hapus lampiran, arsip/pulihkan, status tujuan/warna/urutan/selesai, tag CRUD dan konfirmasi batal pengaturan.
- Keyboard native Chrome: panah/Home pada tab, Enter membuka task, Escape menutup detail. Kontrol memakai elemen native, label dan fokus terlihat; modal memakai dialog native. Toolbar Markdown menggunakan kontrol Vditor yang sudah ada, bukan implementasi parser baru.
- Pasangan warna yang dihitung:19 pasangan teks per tema, minimum terang4,64:1 dan Graphite5,47:1. Border kontrol pada halaman/kartu minimum3,01:1 dan3,51:1. Border struktur lebih halus dan tidak menjadi satu-satunya petunjuk interaksi. Ini pemeriksaan token, bukan sertifikasi aksesibilitas menyeluruh.
- Gate desain: arah/dials tertulis, mockup/data contoh berlabel, tidak ada statistik/identitas palsu atau link navigasi kosong, tidak menambah aset branding; pilihan menu mempunyai perilaku, state kosong/loading/error/konflik tersedia, tema dan layout responsif diperiksa. Body tidak bergulir di belakang dialog; judul panjang menyesuaikan tinggi. Tanpa gradient/glow/animasi berulang.
- Pemeriksaan hanya pada artefak mockup dan data browser terisolasi. Tidak menjalankan suite aplikasi, menulis DB bersama, deploy, commit atau push.
- Belum diperiksa di perangkat fisik, Safari/Firefox, pembaca layar atau dengan pengguna. Mention caret tengah, konflik lintas perangkat nyata, validasi jaringan/backend dan penyimpanan R2 perlu ditinjau saat desain diimplementasikan ke aplikasi.

## Implementasi aplikasi — 24 November 2026

Desain disetujui dan diterapkan pada aplikasi: toolbar/filter/chip, view tersimpan, drawer 910 px dengan properti mobile yang dapat dilipat, toolbar Markdown, checklist 18 px, lampiran ringkas, dropdown custom, tag multi-select, tanggal Daftar dan wording Deadline. Inter, tema terang dan Graphite mengikuti token mockup. Kalender tanggal tetap memakai pemilih bawaan browser/OS.

Kontrak penyimpanan tetap berlaku: draft otomatis belum menerapkan task; **Simpan task** menerapkan isi/checklist/properti, sedangkan lampiran dan edit cepat Daftar langsung disimpan. Pengaturan view memakai token konkurensi dan pilihan perbarui/buat baru. Task arsip tetap hanya baca. Tidak ada migrasi skema atau perubahan data contoh pada DB bersama.

Preview memakai EJS/modul/editor aplikasi dengan API dalam memori, pada 1440/1024/760/390 px. Diperiksa tema terang/Graphite, keyboard dropdown/tag, simpan/pulihkan draft, view CRUD, edit tanggal, batas 20 tag, arsip hanya baca serta drop lampiran dengan konfirmasi Upload. Tidak ada exception browser atau overflow horizontal halaman/drawer pada alur yang diperiksa. Kedua domain telah dideploy dan PM2 direstart; aset publik dan respons tanpa autentikasi diperiksa.

Autentikasi juga diubah sesuai permintaan: sesi berakhir pada **00.00 WIB berikutnya**, ditegakkan server dan cookie; verifikasi ulang untuk perubahan keamanan tetap berlaku 5 menit. Pemeriksaan terisolasi mencakup batas pergantian hari, sesi lama, timestamp tidak valid, serta cookie setelah response touch/reload. Belum diperiksa: passkey fisik lintas perangkat, Safari/Firefox, pembaca layar dan penulisan task/dokumen pada produksi.
