<div align="center">

<img src="icons/icon128.png" alt="Logo" width="96" height="96">

# AdBlocker by Irvando.d.a — YouTube & Web

**Ekstensi Chrome (Manifest V3) untuk memblokir iklan YouTube, pop-up, click-hijack, tracker, dan script berbahaya — dengan perlindungan privasi ala Brave Shields.**

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome](https://img.shields.io/badge/Chrome-111%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

</div>

> 🇬🇧 **English summary:** A dependency-free Chrome (MV3) extension that blocks YouTube ads, pop-ups/pop-unders, click-hijacking overlays, trackers and cryptominers, adds anti-fingerprinting, strips tracking parameters, helps you enable Secure DNS (Cloudflare / Google), and can wipe site footprints. Load it unpacked via `chrome://extensions`.

---

## Daftar Isi
- [Fitur](#fitur)
- [Instalasi](#instalasi)
- [Cara Penggunaan](#cara-penggunaan)
- [Cara Kerja](#cara-kerja)
- [Struktur Proyek](#struktur-proyek)
- [Izin (Permissions)](#izin-permissions)
- [Keterbatasan](#keterbatasan)
- [Pemecahan Masalah](#pemecahan-masalah)
- [Pengembangan](#pengembangan)
- [Privasi](#privasi)
- [Credits](#credits)
- [Lisensi](#lisensi)

---

## Fitur

### 🎬 YouTube (prioritas utama)
- Memangkas payload iklan (`adPlacements`, `playerAds`, `adSlots`) dari `ytInitialPlayerResponse`, `ytInitialData`, `JSON.parse`, dan respons `fetch` InnerTube (`/player`, `/next`, `/browse`, `/search`).
- Auto-skip iklan yang lolos: mute, percepat, lompat ke akhir, klik tombol *Skip*, lalu mengembalikan suara/kecepatan normal.
- Menutup overlay/banner iklan di atas video.
- Menghapus dialog *"ad blockers violate YouTube's terms"* dan melanjutkan video.
- Menyembunyikan iklan di beranda, hasil pencarian, dan panel samping.

### 🌐 Web umum
- **Anti pop-up / pop-under**: memblokir `window.open` tanpa gestur pengguna, ke domain iklan, lebih dari satu per klik, atau dari klik pada area non-interaktif ke situs asing.
- **Anti click-hijack**: mendeteksi dan menghapus overlay transparan layar penuh yang menangkap klik.
- Memblokir klik programatik pada `<a target="_blank">` yang tidak terpasang di halaman.
- Menyembunyikan kontainer iklan umum (AdSense, GPT, Taboola, Outbrain, dll.).
- Memblokir request ke jaringan iklan dan jaringan pop-up lewat `declarativeNetRequest`.

### 🛡️ Shields (seperti Brave)
| Perlindungan | Detail |
|---|---|
| **Script berbahaya** | Blokir domain & file cryptominer (CoinHive, CryptoLoot, CoinImp, dll.), koneksi WebSocket ke mining pool, global miner dinetralkan, auto-download tanpa klik diblokir |
| **Tracker** | Google Analytics, Hotjar, Clarity, Mixpanel, Facebook Pixel, dan lainnya |
| **Parameter pelacak** | Menghapus `utm_*`, `fbclid`, `gclid`, `msclkid`, `igshid`, dll. dari URL secara otomatis |
| **Anti-fingerprint** | Noise canvas & audio per-halaman, WebGL vendor/renderer generik, `hardwareConcurrency`/`deviceMemory` dinormalkan, Battery API ditolak |
| **Sinyal privasi** | Header `DNT: 1` dan `Sec-GPC: 1`, `navigator.globalPrivacyControl` |
| **Privasi browser** | Cegah kebocoran IP lokal via WebRTC, matikan hyperlink auditing, opsi blokir cookie pihak ketiga |

### 🧹 Bersihkan jejak
- **Situs ini**: hapus cookie, cache, localStorage, IndexedDB, service worker.
- **1 jam terakhir (semua situs)**: termasuk riwayat dan data formulir (dengan konfirmasi).

### 🔐 Secure DNS (Cloudflare & Google)
- Pintasan satu klik ke `chrome://settings/security` dengan template DoH yang sudah disalin ke clipboard.
- Tes domain situs aktif melalui **Cloudflare (1.1.1.1)** dan **Google (8.8.8.8)** sekaligus, untuk mengetahui apakah pemblokiran berasal dari DNS ISP.

### ⚙️ Kontrol
- Toggle global dan **whitelist per situs**
- Counter jumlah iklan/jebakan yang diblokir per tab (badge ikon)
- Setiap modul Shields dapat dimatikan terpisah

---

## Instalasi

Ekstensi ini belum ada di Chrome Web Store; pasang lewat *Developer mode*:

1. Unduh atau clone repositori ini:
   ```bash
   git clone https://github.com/irvandoo/adblocker-by-irvando-da.git
   ```
2. Buka `chrome://extensions` di Chrome / Edge / Brave / browser Chromium lain.
3. Aktifkan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked** dan pilih folder hasil clone.
5. *(Opsional)* Pin ikon ekstensi ke toolbar.

**Persyaratan:** Chrome/Chromium **111+** (dibutuhkan untuk content script `world: "MAIN"`).

---

## Cara Penggunaan

Klik ikon ekstensi untuk membuka popup:

| Kontrol | Fungsi |
|---|---|
| Aktifkan blokir (semua situs) | Saklar utama seluruh fitur |
| Aktif di *situs* | Matikan/hidupkan hanya untuk situs yang sedang dibuka (whitelist) |
| Shields | Atur modul: script berbahaya, tracker, anti-fingerprint, proteksi IP, cookie pihak ketiga |
| Bersihkan jejak | Hapus data situs ini atau semua situs 1 jam terakhir |
| Secure DNS | Pilih Cloudflare/Google, buka pengaturan Chrome, atau tes domain |

> Setelah mengubah whitelist atau pengaturan, **muat ulang halaman** yang sedang dibuka.

### Mencoba cepat
- Buka `https://example.com/?utm_source=test&fbclid=abc` → URL otomatis menjadi `https://example.com/`.
- Buka halaman uji seperti `https://d3ward.github.io/toolz/adblock.html` untuk melihat hasil pemblokiran.

---

## Cara Kerja

```
                ┌──────────────────────────────────────────────┐
  Request  ───► │ declarativeNetRequest (3 ruleset statis)     │ ─► block / redirect / header
                │  ads · security · privacy  (+ whitelist)     │
                └──────────────────────────────────────────────┘
                ┌──────────────────────────────────────────────┐
  Halaman  ───► │ Content script  (document_start, all frames) │
                │  MAIN world   : shields_main, generic_main,  │
                │                 youtube_main (patch API)     │
                │  ISOLATED     : generic, youtube (DOM + UI)  │
                └──────────────────────────────────────────────┘
                ┌──────────────────────────────────────────────┐
  Pengaturan ─► │ Service worker (background.js)               │
                │  ruleset on/off · whitelist · chrome.privacy │
                │  counter & badge                             │
                └──────────────────────────────────────────────┘
```

- **Lapisan jaringan** memblokir yang sudah diketahui (domain, endpoint) sebelum diunduh.
- **Lapisan MAIN world** memodifikasi API halaman sebelum script situs berjalan: pemangkasan payload YouTube, `window.open`, canvas/audio/WebGL, `WebSocket`.
- **Lapisan ISOLATED** membaca pengaturan dari `chrome.storage`, menandai halaman lewat atribut `data-irv-*`, dan melaporkan hitungan ke service worker. Script di MAIN world membaca atribut itu saat dipanggil, sehingga toggle berlaku langsung.

---

## Struktur Proyek

```
.
├── manifest.json            # Manifest V3
├── background.js            # Service worker: ruleset, whitelist, privacy, counter
├── rules/
│   ├── ads_rules.json       # Jaringan iklan + endpoint iklan YouTube
│   ├── security_rules.json  # Cryptominer & domain berbahaya
│   └── privacy_rules.json   # Tracker, hapus parameter pelacak, header DNT/GPC
├── content/
│   ├── youtube_main.js      # (MAIN) pangkas payload iklan YouTube
│   ├── youtube.js           # Auto-skip, hapus anti-adblock wall
│   ├── youtube.css          # Sembunyikan elemen iklan YouTube
│   ├── generic_main.js      # (MAIN) anti pop-up / click-hijack
│   ├── generic.js           # Kosmetik, status, counter
│   └── shields_main.js      # (MAIN) anti-fingerprint & deteksi miner
├── popup/                   # UI: toggle, Shields, bersihkan jejak, Secure DNS, credits
├── icons/                   # Ikon 16/48/128
├── LICENSE
└── README.md
```

---

## Izin (Permissions)

| Izin | Alasan |
|---|---|
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Memblokir/redirect request & menghitung blokir (counter jaringan aktif pada ekstensi unpacked) |
| `storage` | Menyimpan pengaturan dan whitelist |
| `tabs` | Membaca URL tab aktif untuk whitelist & counter |
| `privacy` | Mengatur kebijakan WebRTC, hyperlink auditing, cookie pihak ketiga |
| `browsingData` | Fitur *Bersihkan jejak* |
| `host_permissions: <all_urls>` | Menjalankan content script & aturan jaringan di semua situs |

---

## Keterbatasan

Transparansi penting agar ekspektasi tepat:

- **Cat-and-mouse dengan YouTube.** YouTube sering mengubah struktur data dan elemen UI; selector/hook mungkin perlu diperbarui berkala.
- **Ekstensi tidak dapat mengubah DNS.** Chrome tidak menyediakan API untuk itu; fitur DNS hanya pintasan + alat tes.
- **Bukan antivirus.** Deteksi script berbahaya berbasis daftar dan pola (miner, mining pool, auto-download). Tidak ada daftar phishing/malware seperti Safe Browsing — tetap aktifkan Safe Browsing Chrome.
- **Heuristik bisa salah.** Pemblokiran pop-up/overlay dan noise canvas dapat sesekali mengganggu situs tertentu (mis. editor gambar web). Gunakan whitelist per situs.
- **Manifest V3** membatasi jumlah dan jenis aturan dibanding MV2; daftar filter dibundel statis tanpa auto-update EasyList.
- Ekstensi lain yang mengontrol `chrome.privacy` dapat bertabrakan; pengaturan tersebut akan dilewati bila dikunci.

---

## Pemecahan Masalah

| Masalah | Solusi |
|---|---|
| Situs rusak / fitur tidak jalan | Matikan **Aktif di situs ini** lalu muat ulang |
| Login SSO / pembayaran gagal | Matikan *Blokir cookie pihak ketiga* |
| Iklan YouTube muncul lagi | Muat ulang ekstensi (`chrome://extensions` → Reload) dan halaman; jika masih, buat *issue* dengan URL contoh |
| Peringatan aturan di halaman ekstensi | Reload ekstensi; laporkan teks error lewat *issue* |
| Counter tidak naik di jaringan | Counter jaringan hanya aktif pada ekstensi *unpacked*; counter dari content script tetap jalan |

---

## Pengembangan

Tanpa build step dan tanpa dependensi — cukup edit file lalu **Reload** ekstensi.

```bash
# cek sintaks cepat (Node.js)
for f in background.js content/*.js popup/popup.js; do node --check "$f"; done
```

Menambah domain pemblokiran: edit `requestDomains` pada file di `rules/`. Perhatikan batas MV3: *regexFilter* maksimal ±2 KB per aturan — gunakan beberapa aturan `urlFilter` bila perlu.

Kontribusi, laporan bug, dan saran filter sangat diterima lewat **Issues** / **Pull Request**.

---

## Privasi

Ekstensi ini **tidak mengumpulkan, menyimpan, atau mengirim data pribadi** ke server mana pun. Semua pemrosesan terjadi lokal di browser. Satu-satunya request jaringan buatan ekstensi adalah fitur *Tes DNS* yang Anda picu sendiri ke `cloudflare-dns.com` dan `dns.google`.

---

## Credits

| | |
|---|---|
| **Nama** | Irvando Demas Arifiandani |
| **Nickname** | irvando.d.a |
| **Email** | [irvando.d.a@gmail.com](mailto:irvando.d.a@gmail.com) |
| **Web** | [irvandoda.web.id](https://irvandoda.web.id) |

---

## Lisensi

Dirilis di bawah [Lisensi MIT](LICENSE) © 2026 Irvando Demas Arifiandani.
