# TAPAK AKSARA - Paket Audio (musik + suara)

## 1. Musik
Semua musik dipotong dari 8 lagu referensi yang kamu kirim, dipotong tepat di ketukan, volumenya diseragamkan,
dan dibuat loop mulus. Setiap adegan cerita punya musik sendiri; labirin dan game 20 huruf MEWARISI musik
adegan sebelumnya (tidak ganti lagu), sesuai naskah.

Kode cue | Judul | Dipakai di | Sumber (menit)
---|---|---|---
UI-M01| Pendapa Menyambut| Beranda| Donkgedank - GANDRUNG (Royalty Free) 0:41.8–1:20.4
UI-M02| Ruang Pengaturan| Settings| Donkgedank - SASMITA PERTIWI 0:21.0–0:40.2
UI-M03| Pilih Petualangan| Pilih jalur (+ kembali dari gapura)| Donkgedank - GANDRUNG (Royalty Free) 0:06.2–0:40.0
UI-M04| Sampai Jumpa| Quit (sekali putar)| Donkgedank - GANDRUNG (Royalty Free) 5:21.9–5:50.0
BH-01| Tangan Menulis| B01 ajakan & tracing| Donkgedank - GANDRUNG (Royalty Free) 4:30.0–5:03.8
BH-02| Kenali Aksara| B02 kenali aksara| Donkgedank - GEMASHANTI (videoplayback) 0:18.4–0:40.0
BH-03| Gelembung Bunyi| B03 gelembung| Donkgedank - GANDRUNG (Royalty Free) 2:29.9–3:03.7
BH-04| Satu Huruf Berhasil| B04 berhasil (sekali)| Donkgedank - GANDRUNG (Royalty Free) 3:24.2–3:33.0
BH-05| Pulang ke Pendapa| B05 gapura kembali| Donkgedank - GANDRUNG (Royalty Free) 1:48.2–2:22.0
ST01| Lembar Legenda| Adegan 1 (sekali putar)| Epic Orchestra Java 0:01.8–0:31.0
ST02| Sapaan Sang Pemuda| 2| Gamelan Symphony 0:32.4–0:53.9
ST03| Sahabat Setia| 3| Donkgedank - GEMASHANTI (videoplayback) 1:00.2–1:29.8
ST04| Malam Majeti| 4| Donkgedank - LUKITASARI 0:08.1–0:30.7
ST05| Amanat Pusaka| 5| Donkgedank - WADITRA 0:24.0–0:56.3
ST06| Janji Penjaga| 6| Donkgedank - LUKITASARI 0:42.0–1:12.0
ST07| Pikiran Sang Raja| 7| Donkgedank - SASMITA PERTIWI 0:48.2–1:07.5
ST08| Langkah Pertama| 8| Donkgedank - SASMITA PERTIWI 1:12.3–1:29.3
ST09| Jejak Perjalanan Dora (+Labirin)| 9 + labirin Dora (10)| Donkgedank - SAMAPTA 0:48.3–1:12.5
ST11| Di Balik Pepohonan| 11| Gamelan Symphony 1:16.1–1:35.0
ST12| Dua Janji| 12| Donkgedank - SASMITA PERTIWI 1:36.3–1:53.4
ST13| Janji yang Bertabrakan| 13 perselisihan| Donkgedank - SAMAPTA 1:42.7–2:08.7
ST14| Penanti di Pendapa| 14| Donkgedank - WADITRA 1:54.2–2:23.8
ST15| Mencari Dua Sahabat (+Labirin)| 15 + labirin Aji Saka (16)| Donkgedank - SAMAPTA 1:20.3–1:44.5
ST17| Hutan yang Sunyi| 17| Epic Orchestra Java 2:49.7–3:09.2
ST18| Hormat pada Janji| 18| Donkgedank - LUKITASARI 1:30.8–1:50.9
ST19| Pusaka Kenangan| 19| Donkgedank - GEMASHANTI (videoplayback) 0:35.9–0:57.5
ST20| Ukiran Harapan (+Game 20 huruf)| 20 + game 20 huruf (21)| Gamelan Symphony 1:39.7–2:12.1
ST22A| Empat Ingatan A - utusan| 22 makna baris 1| Epic Orchestra Java 0:19.9–0:42.2
ST22B| Empat Ingatan B - berselisih| 22 makna baris 2| Donkgedank - WADITRA 3:19.7–3:41.3
ST22C| Empat Ingatan C - sama kuat| 22 makna baris 3| Donkgedank - SAMAPTA 4:49.9–5:12.1
ST22D| Empat Ingatan D - gugur| 22 makna baris 4| Donkgedank - WADITRA 5:31.7–5:58.6
ST23| Kisah Menjadi Ilmu| 23| Donkgedank - SASMITA PERTIWI 2:23.8–2:49.5
ST24| Pelajaran Kesetiaan| 24| Donkgedank - GEMASHANTI (videoplayback) 1:43.9–2:13.6
ST25| Sampai Jumpa, Sahabat| 25 penutup + AR| Donkgedank - GANDRUNG (Royalty Free) 3:36.3–4:10.0
END| Penutup (stinger)| stinger akhir (opsional)| Gamelan Symphony 2:59.2–3:09.3

- ST09, ST15, ST20 punya versi `_game` (kendang dan bass lebih tipis, sejajar sampel). Saat anak bermain,
  pemutar menggeser ke versi ini tanpa mengulang lagu.
- Pindah lagu: pemutar menunggu ketukan berikutnya, lagu baru masuk dari bagian pengantarnya,
  hitungan pertamanya jatuh pas saat lagu lama habis memudar (1,5 detik).
- Saat ada suara bicara, musik turun 16 dB (naskah minta 14–20 dB) dan baru naik lagi 0,5 detik sesudah kalimat selesai.

### Memasang (tapak_musik.js)
1. Taruh folder `musik/` di samping halaman game, sertakan `tapak_musik.js`.
2. Setelah klik/ketuk pertama: `TapakMusik.init(); TapakMusik.preload();`
3. Menu: `TapakMusik.play('UI-M01')`, By Huruf: `TapakMusik.play('BH-01')` dst.
4. Cerita: di awal tiap adegan `TapakMusik.scene(nomorAdegan)`. Adegan 22: `play('ST22A')`..`play('ST22D')` per makna.
5. Labirin/tracing mulai: `TapakMusik.gameMode(true)`; selesai: `gameMode(false)`.
6. Saat suara bicara mulai: `TapakMusik.duck(true)`; 0,5 detik setelah selesai: `duck(false)`.
7. Huruf berhasil (By Huruf): `TapakMusik.stinger('BH-04')`.

### Hak cipta
Lagu Donkgedank dan lainnya adalah karya orang lain. GANDRUNG berlabel "Royalty Free", tapi tetap baca syarat
lisensinya. Untuk lomba/publikasi, cantumkan kredit dan pastikan izinnya. Naskah juga menyebut musik final
sebaiknya komposisi orisinal; potongan ini cocok sebagai versi prototipe.

## 2. Suara tokoh (suara/naskah, suara/by_huruf)
Dibuat dengan model TTS Indonesia multi-penutur (Wikidepia Indonesian TTS) yang dilatih dari rekaman penutur asli Jawa,
jadi logatnya Jawa alami, bukan suara robot espeak.

Tokoh | Penutur model | Ciri
---|---|---
Narator | JV-01519 (perempuan Jawa) | hangat, jelas, ±127 kata/menit
Aji Saka | JV-04588 (laki-laki Jawa) | nada tengah, ramah, ±117 kata/menit
Dora | JV-06383 (laki-laki Jawa) | lebih tinggi dan ekspresif
Sembada | JV-04285 (laki-laki Jawa) | paling rendah, tenang, pelan

- 78 dialog naskah + 3 dialog By Huruf x 20 aksara + 4 kalimat makna baris = 138 file.
- Dialog By Huruf "Bunyi aksaranya ..." memakai file bunyi gelembung yang sama, sesuai naskah
  (bunyi contoh harus sama di Story dan By Huruf).
- Keterbatasan: model ini belum bisa membedakan Da/Dha dan Ta/Tha di dalam kalimat (dibaca Da/Ta).
  Kalimat yang terkena: adegan 21 dan 22 (baris 3 dan 4), serta By Huruf untuk Dha dan Tha.

### Versi lebih natural (disarankan): `alat/suara_edge_tts.py`
Microsoft punya suara neural berbahasa Jawa: jv-ID-DimasNeural (laki-laki) dan jv-ID-SitiNeural (perempuan).
Server tempatku bekerja tidak bisa mengaksesnya, jadi skripnya kusiapkan untuk dijalankan di komputermu
(gratis, lewat edge-tts). Suara Jawa ini membaca "dha/tha" sebagai retrofleks sesuai ejaan Jawa.
Langkah: pasang Python, `pip install edge-tts`, lalu `python suara_edge_tts.py` di folder `alat/`.
Opsi lain: ElevenLabs (paling ekspresif, berbayar), atau rekam suara asli lalu aku bersihkan (cara terbaik untuk Dha/Tha).

## 3. Bunyi gelembung Hanacaraka (suara/gelembung)
4 versi: laki/perempuan x gaya baca:
- `jejeg_a` : ha, na, ca, ... (vokal [a]).
- `miring_o`: ho, no, co, ... (vokal [ɔ], gaya Solo-Jogja). Dalam dialek standar Surakarta, /a/ di suku kata
  terbuka akhir dibaca [ɔ]. Naskah meminta jangan langsung memakai "ho" sebelum disepakati guru, jadi keduanya disediakan.

Aksara | Baca | Cara mengucap
---|---|---
ꦲ ha | [ha]/[hɔ] | h lembut
ꦤ na | [na] |
ꦕ ca | [ca] | c Jawa: tengah lidah menempel langit-langit, lebih lembut dari "c" Indonesia
ꦫ ra | [ra] | r bergetar
ꦏ ka | [ka] |
ꦢ da | [d̪a] | DENTAL: ujung lidah di belakang gigi atas; suara "berat"
ꦠ ta | [t̪a] | DENTAL: ujung lidah di belakang gigi atas
ꦱ sa | [sa] |
ꦮ wa | [wa] |
ꦭ la | [la] |
ꦥ pa | [pa] |
ꦝ dha | [ɖa] | RETROFLEKS: ujung lidah ditekuk ke langit-langit; suara "berat"
ꦗ ja | [ɟa] | suara "berat"
ꦪ ya | [ja] |
ꦚ nya | [ɲa] |
ꦩ ma | [ma] |
ꦒ ga | [ɡa] | suara "berat"
ꦧ ba | [ba] | suara "berat"
ꦛ tha | [ʈa] | RETROFLEKS: ujung lidah ditekuk ke langit-langit
ꦔ nga | [ŋa] |

Huruf "berat" (b, d, dh, j, g) di Jawa diucapkan sedikit mendesah dengan nada lebih rendah; di file gelembung
nadanya sudah diturunkan sedikit. Bunyi gelembung dibuat dengan suara berbahasa Hindi karena Hindi, seperti Jawa,
membedakan t/d dental dan retrofleks. Tetap minta guru Bahasa Jawa memeriksa, terutama Dha dan Tha.

## Revisi 14 Nov 2026 — musik sesi main dibedakan dari beranda
Beranda (UI-M01..M04) tetap GANDRUNG. Sesi main By Huruf memakai gamelan dolanan sintetis (komposisi orisinal, slendro, lancaran):
- BH-01 Tangan Menulis -> byhuruf/dolanan_tulis (tenang, ketukan 0,66 dtk)
- BH-03 Gelembung & Kuis -> byhuruf/dolanan_main (riang, ketukan 0,5 dtk, kentongan)
- BH-04 Satu Huruf Berhasil -> byhuruf/dolanan_berhasil (bonang naik + gong, sekali)
- BH-05 Pulang ke Pendapa / layar foto -> byhuruf/dolanan_pulang
- BH-02 Kenali Aksara tetap GEMASHANTI (bh_02).
File lama bh_01/03/04/05 masih disimpan (tidak dipakai).
Efek bunyi (disintesis di game): bintang = nada saron naik, selesai menulis = bonang berlari + gong,
kuis benar = peking/bonang + kenong, kuis salah = "te-tot", foto = klik rana + ting, hitung mundur = bonang.
