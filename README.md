# Sigap Discord Bot - Slash Command dengan Groq API (Cloudflare Workers)

Bot Discord bertenaga AI lewat slash command `/tanya`, jalan di Cloudflare Workers, 100% gratis tanpa kartu kredit. Memakai model **HTTP Interactions** Discord (bukan koneksi 24 jam), supaya cocok dengan serverless. Pakai **Groq API** (super cepat) sebagai otaknya, supaya delay-nya minimal.

## Kenapa pakai Slash Command, bukan chat bebas?

Bot yang "dengar" semua chat butuh koneksi yang nyala terus-terusan (disebut *gateway*) -- ini butuh server asli, susah digratiskan selamanya. Discord punya cara lain: **Interactions Endpoint URL**, di mana Discord cuma mengirim request ke Worker kamu pas ada orang pakai slash command. Ini cocok banget sama Cloudflare Workers yang sifatnya serverless (bangun cuma pas dibutuhkan).

## Kenapa Groq, bukan Gemini?

Groq dibangun di atas chip khusus (LPU) yang didesain spesifik buat inferensi AI super cepat. Dampaknya langsung kerasa di Discord: pesan "Sigap sedang berpikir..." yang sempat lumayan lama kalau pakai Gemini, sekarang nyaris langsung diganti jawaban asli.

## Setup dari Nol

### 1. Buat Discord Application

1. Buka [discord.com/developers/applications](https://discord.com/developers/applications), login pakai akun Discord kamu
2. Klik **"New Application"**, beri nama (misal `Sigap`)
3. Di halaman **"General Information"**, salin dan simpan:
   - **Application ID**
   - **Public Key**
4. Buka tab **"Bot"** di sidebar, klik **"Reset Token"** (atau "View Token"), salin **Bot Token** -- simpan baik-baik, cuma muncul sekali

### 2. Undang bot ke server Discord kamu

1. Buka tab **"OAuth2" → "URL Generator"**
2. Di **Scopes**, centang: `bot` dan `applications.commands`
3. Di **Bot Permissions** yang muncul, centang `Send Messages`
4. Scroll bawah, copy URL yang di-generate, buka di browser
5. Pilih server Discord kamu (atau bikin server baru buat testing), klik **Authorize**

### 3. Dapatkan API Key Groq (gratis)

Kalau sudah punya dari proyek Tutur/Cabang, key yang sama bisa dipakai lagi. Kalau belum, daftar gratis di [console.groq.com](https://console.groq.com).

### 4. Upload proyek ini ke GitHub

Upload semua file di sini: `src/index.js`, `package.json`, `wrangler.jsonc`, `.gitignore`, `register-command.ps1`.

**Jangan upload** `.dev.vars` (kalau kamu bikin dari `.dev.vars.example`).

### 5. Hubungkan ke Cloudflare Workers

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Import a Git Repository**
2. Pilih repo `sigap-discord-bot`, beri izin akses
3. Cloudflare otomatis jalankan `npm install` (buat ambil package `discord-interactions`) lalu deploy
4. Setelah selesai, kamu dapat URL seperti `https://sigap-discord-bot.<username-kamu>.workers.dev`

### 6. Isi Secrets di Cloudflare

Di halaman Worker kamu → **Settings → Variables and Secrets**, tambahkan 3 secret:
- `DISCORD_PUBLIC_KEY`
- `DISCORD_APPLICATION_ID`
- `GROQ_API_KEY`

### 7. Daftarkan Interactions Endpoint URL ke Discord

1. Balik ke halaman Discord Developer Portal → aplikasi kamu → **"General Information"**
2. Di kolom **"Interactions Endpoint URL"**, paste URL Worker kamu (dari langkah 5)
3. Klik **Save Changes** -- Discord akan langsung mengirim test PING ke Worker kamu. Kalau Worker-mu sudah benar, ini otomatis tervalidasi (muncul centang hijau)

### 8. Daftarkan slash command `/tanya` (sekali saja)

1. Buka file `register-command.ps1`, ganti `$ApplicationId` dan `$BotToken` dengan nilai kamu
2. Jalankan di PowerShell:
   ```powershell
   .\register-command.ps1
   ```
3. Kalau berhasil, muncul detail command yang baru terdaftar

### 9. Coba di Discord!

Buka server Discord kamu, ketik `/tanya` di kolom chat manapun, Discord akan munculkan kolom isian "pertanyaan", isi, kirim. Bot akan balas "Sigap sedang berpikir..." sebentar, lalu (biasanya dalam sepersekian detik karena Groq) jawaban aslinya muncul.

## Catatan teknis

- **Deferred response tetap dipakai sebagai jaring pengaman**: meski Groq biasanya jauh lebih cepat dari batas 3 detik wajib Discord, Worker tetap membalas "lagi mikir..." dulu sebelum kirim jawaban asli lewat *follow-up message* (`ctx.waitUntil`) -- supaya nggak gagal kalau sesekali ada kelambatan jaringan
- **Verifikasi tanda tangan (Ed25519)**: setiap request WAJIB diverifikasi memakai `DISCORD_PUBLIC_KEY`, supaya nggak ada orang luar yang bisa mengaku-aku jadi Discord dan ngirim request palsu
- **Satu dependency npm**: `discord-interactions`, dipakai khusus buat verifikasi tanda tangan itu -- semua panggilan ke Groq API tetap pakai `fetch()` murni, tanpa SDK, format kompatibel OpenAI Chat Completions
- **Tanpa memori**: setiap `/tanya` diproses berdiri sendiri, nggak ingat pertanyaan sebelumnya

## Ide pengembangan lanjutan

- Tambah command baru, misal `/cuaca` atau `/hitung` (mirip tools di proyek Sigap versi Streamlit)
- Simpan riwayat per-user pakai Cloudflare KV biar ada memori ringan
- Tambahkan respons yang lebih rapi pakai Discord Embeds
