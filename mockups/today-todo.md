# Mockup Hari ini — To-do

Buka [today-todo.html](today-todo.html) langsung di browser. Ini prototype dengan data contoh dalam memori; refresh atau **Reset contoh** mengembalikan isinya. Tidak memakai API, database, atau data workspace yang sebenarnya.

## Rancangan

- Sidebar Ruangku / R., background terang `#f6f8fa`, body sebagai card, font Inter dan Graphite dark mengikuti desain yang sekarang.
- To-do menjadi area utama di kiri. Fokus hari ini dan kelompok task board berada di kanan; layar kecil menumpuk to-do lebih dahulu.
- To-do terpisah dari task board: item ringan cukup teks, status selesai, dan hapus. Tidak menambah status, tag atau modal detail pada to-do.
- Tambah lewat kolom lalu Enter atau tombol Tambah. Checkbox 22 px dengan label yang bisa diklik. Item selesai pindah ke bagian **Selesai**, yang bisa dilipat dan dibuka kembali.
- Hapus dengan ikon tempat sampah, lalu **Urungkan** selama 12 detik. Setiap penghapusan mengganti kesempatan urungkan sebelumnya.
- Jumlah selesai dan progress mengikuti daftar; tampilan kosong dan semua selesai disediakan.
- Pilihan fokus, detail task contoh, lipat kelompok task, tema terang/gelap dan sidebar juga bisa dicoba.

## Batas mockup

Tidak ada penyimpanan permanen, perpindahan hari, sinkron antarperangkat atau perubahan task board. Kebijakan menyimpan to-do lintas hari ditentukan saat implementasi. Halaman mockup lain tetap memakai rancangan masing-masing. Belum ada perubahan pada aplikasi produksi.
