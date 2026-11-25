# Migrasi Vue / TypeScript — tahap 1, verifikasi lokal

Tanggal: 25 November 2026. Branch lokal: `refactor/vue-typescript`.
Baseline: `f738867`. Tidak ada commit, push, SSH, deploy, restart PM2, atau
perubahan konfigurasi server pada pekerjaan ini.

## Yang diimplementasikan

| Bagian | Hasil |
| --- | --- |
| Build | Vite + Vue 3 + TypeScript frontend; compiler TypeScript backend; schema SQL ikut disalin ke output |
| Backend | Composition Express, startup/shutdown, pembacaan manifest frontend, dan HTTP Task board menggunakan TypeScript |
| Task board | Kartu/kolom, daftar, timeline mingguan, arsip, empty state, tag, tanggal dan indikator sumber daya memakai komponen Vue |
| Komponen | Primitive shadcn-vue/REKA untuk tombol dengan kelas visual existing; Tailwind prefix `tw`, tanpa preflight |
| Kontrak | Tipe bersama board, status, task, tag, mention, checklist dan metadata lampiran |
| Lifecycle | Vue di-unmount sebelum navigasi/error; placeholder loading dibersihkan sebelum mount pertama |
| Assets | Bundle dan CSS berhash, URL relatif, Express static pada root maupun `/mynotes/` |
| Operasional | README mencakup install/build/start, migrasi bertahap, fixture dan pemeriksaan lokal |

Controller mutasi/drawer/editor existing dipertahankan melalui injection actions
dan delegated events. Validasi runtime service, revision conflict, auth/origin
middleware, penyimpanan PostgreSQL, dan penyimpanan R2 tetap memakai implementasi
existing. Tidak ada migrasi schema DB atau perubahan data workspace.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run build` | Lolos; strict typecheck pada modul TypeScript baru, build backend/frontend |
| `npm test` | 8 test pada 3 file lolos, ditambah pemeriksaan manifest/assets |
| `npm run test:legacy` | 24 dari 24 pemeriksaan lolos pada PostgreSQL disposable di loopback |
| `npm run test:ui` | Browser Chrome headless, root/light dan `/mynotes`/dark, desktop dan ukuran 390/760/1024 px |
| Perbandingan visual | Enam pasang screenshot board, drawer dan mobile pada light/dark sama pada perbandingan piksel RGB dengan baseline HEAD |
| Review kode | Reviewer independen; kontrak filename, ikon dekoratif, petunjuk build dan ketahanan fixture diperbaiki |
| `git diff --check` | Lolos |

Browser memeriksa drag kartu dengan pointer asli; create/edit/delete; checklist;
mention dokumen; konfirmasi drop lampiran; arsip/pulihkan; pencarian/empty state;
quick status edit pada daftar; navigasi minggu; konflik revisi yang mempertahankan
input; kegagalan write/read dan retry; Escape; navigasi halaman dan remount;
overflow mobile; serta tidak adanya exception browser yang tidak tertangani.
Shell login dan dokumen publik juga dibuka pada kedua mount.

Test yang mengakses DB dijalankan dalam salinan workspace tanpa `.env`, memakai
cluster PostgreSQL lokal baru dengan credentials fixture dan port acak. Koneksi
test dibatasi ke loopback. Cluster dihentikan setelah pemeriksaan. R2 diganti
stub dalam test terkait; browser memakai API in-memory. Dokumen workspace,
passkey workspace, dan bucket R2 tidak diubah.

**Penyimpangan saat verifikasi:** satu eksekusi langsung `check-sharing.cjs`
sempat membaca `.env` dan membuat database bernama acak `mdpreview_check_*`
pada host yang dikonfigurasi, sebelum ditemukan bahwa test itu belum memiliki
guard lokal. Test menulis hanya ke database sementara tersebut, bukan database
workspace; blok cleanup menghapusnya dan selesai tanpa error. Host itu tidak
dihubungi ulang untuk memeriksa katalog. Guard isolation/host/user/database serta
ketiadaan `.env` sekarang diperiksa sebelum konfigurasi DB dimuat. Rangkaian
24 pemeriksaan berikutnya dijalankan dengan cluster disposable lokal.

Pemeriksaan lama juga dijalankan terhadap arsip source baseline. Sejumlah fixture
lama belum mengikuti animasi/status penyimpanan, DOM outline, layout keamanan,
serta markup task terbaru. Fixture tersebut diperbarui; pemeriksaan keamanan,
escaping, konflik, batas upload dan auth tetap dipertahankan. Pemeriksaan
pembersihan upload menunggu asynchronous cleanup selesai, dengan batas 2 detik.

## Preview lokal

```sh
npm ci
npm run build
npm run preview:fixture
```

- `http://127.0.0.1:8030/?view=tasks`
- `http://127.0.0.1:8030/mynotes/?view=tasks`

Ini data contoh in-memory; perubahan hilang saat fixture dimulai ulang. Fixture
hanya listen pada `127.0.0.1` dan tidak menjadi route server aplikasi.

## Sisa migrasi dan batas verifikasi

Ini **tahap pertama**, bukan klaim seluruh codebase sudah Vue/TypeScript.

1. Pindahkan shell/sidebar, Hari ini, Workspace/listing, Terakhir dibuka, Sticky
   notes dan halaman pengelolaan ke Vue per halaman.
2. Pindahkan state/controller/drawer Task board dan form pengaturan ke Vue;
   hapus renderer HTML legacy setelah semua coverage pemanggil dialihkan.
3. Konversi service, repository, middleware dan modul backend JavaScript ke
   TypeScript. Saat ini `allowJs` menyertakan modul lama tanpa strict checking.
4. Migrasikan editor dokumen/Vditor, autosave, draft, gambar, slash commands dan
   navigasi dokumen terakhir agar state editor tidak hilang selama transisi.

Verifikasi biometrik passkey dengan perangkat asli, upload ke R2 asli, nginx,
Cloudflare Tunnel dan proses PM2 produksi tidak dijalankan pada pekerjaan lokal
ini. Tampilan enam screenshot terpilih identik; ini bukan bukti semua state UI
identik secara piksel. Bundle masih memuat controller JavaScript existing;
pemisahan bundle per halaman belum dikerjakan.

Install melaporkan 13 advisory dependency existing (2 low, 3 moderate, 6 high,
2 critical). Dependency test sementara yang menambah advisory telah dihapus;
upgrade dependency existing perlu ditangani terpisah dengan pemeriksaan
kompatibilitas, tanpa `audit fix --force` pada migrasi ini.

Build sekarang wajib sebelum start; `dist/` diabaikan git. Server tetap memakai
versi sebelumnya sampai deployment nantinya diizinkan secara terpisah.
