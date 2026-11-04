# Deploy booking-rapat (VPS + aaPanel + Docker)

Semua perintah dijalankan di VPS, di folder project.

## 1. Gambaran singkat

- Aplikasi jalan di dalam Docker.
- MySQL tetap di luar Docker (MySQL bawaan aaPanel di `127.0.0.1`).
- Migration (pembuatan tabel database) jalan lewat service `migrate` sekali jalan, sebelum aplikasi start. Restart container aplikasi tidak menjalankan migration.
- Aplikasi cuma bisa diakses dari `127.0.0.1:8282`. Publik masuk lewat nginx (domain di aaPanel).

Cek dulu MySQL kamu:

```sh
sudo ss -ltnp | grep 3306
```

Hasilnya harus ada `127.0.0.1:3306` (atau `0.0.0.0:3306`). Container memakai network host, jadi langsung terhubung ke MySQL di `127.0.0.1`.

## 2. Persiapan (sekali saja)

### Swap (memori cadangan di disk, wajib untuk VPS 1GB)

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Database + user

```sh
sudo /www/server/mysql/bin/mysql -uroot -p
```

Ganti `PASSWORD_KUAT` dengan password kamu sendiri:

```sql
CREATE DATABASE booking_rapat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'booking'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT';
CREATE USER 'booking'@'127.0.0.1' IDENTIFIED BY 'PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON booking_rapat.* TO 'booking'@'localhost';
GRANT ALL PRIVILEGES ON booking_rapat.* TO 'booking'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### File `.env`

```sh
cp .env.example .env
chmod 600 .env
nano .env
```

Isi seperti ini:

```ini
DB_PORT=3306
DB_DATABASE=booking_rapat
DB_USERNAME=booking
DB_PASSWORD=PASSWORD_KUAT
APP_URL="https://rapat.example.go.id"
NEXT_PUBLIC_APP_MAINTAINER="BIRODATIN - APJAR"
```

- `APP_URL`: alamat publik (domain di bagian 4), tanpa path. Dipakai untuk QR dan link. Kosong = QR nonaktif. Skema (`http://` atau `https://`) juga menentukan flag `Secure` pada cookie login bila reverse proxy tidak mengirim `X-Forwarded-Proto`. Dengan `https://`, aplikasi wajib diakses lewat HTTPS; dengan `http://`, cookie dikirim tanpa `Secure` (kurang aman, hanya untuk intranet).
- Batas login, cek IP kantor, header IP, dan maks peserta tidak lagi di `.env`. Semua diatur superadmin di `/dashboard/pengaturan` (disimpan di DB). Default: login 10x/username dan 50x/IP per 15 menit, cek IP kantor nonaktif, header `x-real-ip`, maks 200 peserta.
- `NEXT_PUBLIC_APP_MAINTAINER`: nama pengelola di halaman error. Nilainya tertanam saat build: setelah diubah wajib `docker compose build` ulang (restart saja tidak cukup). Kosong = `BIRODATIN - APJAR`.
- `DB_HOST` biarkan saja, Docker mengisinya `127.0.0.1`.
- `COMPOSE_FILE` dan `DOCKER_DB_HOST` tidak dipakai lagi. Kalau ada di `.env`, hapus.
- Kalau ada `DATABASE_URL` atau `DATABASE_URL_UNPOOLED`, hapus.

## 3. Deploy pertama

```sh
export APP_TAG=$(git rev-parse HEAD | cut -c1-7)
docker compose build && docker compose run --rm migrate && docker compose up -d \
  && sed -i -e '/^APP_TAG=/d' -e '$a\' .env && echo "APP_TAG=$APP_TAG" >> .env
```

Image diberi tag commit (`APP_TAG`), lalu tag itu disimpan ke `.env` hanya kalau semua langkah berhasil.

Cek hasilnya:

```sh
docker compose ps                                  # tunggu sampai (healthy), kira-kira 1 menit
docker compose run --rm migrate migrate status     # harus "Database schema is up to date!"
curl -I http://127.0.0.1:8282/                     # 403 = normal kalau cek IP kantor aktif
```

`(healthy)` dan `403` hanya berarti aplikasi sudah listen, bukan berarti DB tersambung. Koneksi DB dicek lewat `migrate status` di atas. Hasil migration ada di output terminal (container `migrate` langsung dihapus).

Buat akun superadmin (interaktif: username, nama, password diketik tersembunyi). Perintah yang sama dipakai untuk reset password superadmin:

```sh
docker build --target build -t booking-rapat-tools .      # pakai cache dari `docker compose build`
docker run --rm -it --network host -e DB_HOST=127.0.0.1 \
  -v "$PWD/.env:/app/.env:ro" booking-rapat-tools npm run db:seed:superadmin
```

Setelah domain + HTTPS terpasang (bagian 4), login di `https://DOMAIN/dashboard/login`, lalu atur `/dashboard/pengaturan`.

## 4. Pasang domain di aaPanel

Buka aaPanel > Website > domain kamu > Reverse proxy (atau edit config site), isi:

```nginx
location / {
    proxy_pass http://127.0.0.1:8282;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header CF-Connecting-IP "";   # hapus baris ini hanya bila memakai Cloudflare
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

```sh
sudo nginx -t && sudo nginx -s reload
```

Baris `X-Real-IP` wajib ada. Aplikasi membaca IP pengunjung dari situ (header default di `/dashboard/pengaturan`) untuk cek IP kantor dan batas login. Kalau header salah, semua percobaan login dihitung satu IP, sehingga satu orang bisa membuat semua admin terkunci.

Baris `CF-Connecting-IP ""` membuang header palsu dari klien. Header IP `cf-connecting-ip` di Pengaturan hanya boleh dipakai bila origin dikunci ke IP Cloudflare (firewall/aaPanel hanya menerima IP Cloudflare); kalau tidak, siapa pun bisa memalsukan IP.

HTTPS wajib: dashboard dan login bisa diakses dari internet, dan cookie sesi hanya dikirim lewat HTTPS. Pasang SSL di aaPanel (Website > domain > SSL > Let's Encrypt) dan aktifkan Force HTTPS.

## 5. Update aplikasi

Data di database tetap aman.

```sh
git pull
export APP_TAG=$(git rev-parse HEAD | cut -c1-7)
docker compose build && docker compose run --rm migrate && docker compose up -d \
  && sed -i -e '/^APP_TAG=/d' -e '$a\' .env && echo "APP_TAG=$APP_TAG" >> .env
docker image prune -f
```

Kalau migration gagal, perintah berhenti, aplikasi lama tetap jalan, dan `APP_TAG` di `.env` tidak berubah. `image prune -f` hanya menghapus image tanpa tag, jadi image versi sebelumnya tetap ada untuk rollback.

Pertama kali update dari setup lama (yang memakai `docker-compose.hostnet.yml`), hapus dulu baris lama di `.env`:

```sh
sed -i '/^COMPOSE_FILE=/d; /^DOCKER_DB_HOST=/d' .env
```

Rollback ke versi sebelumnya (hanya kode; skema DB tidak ikut mundur, lihat Rollback database di bagian 7):

```sh
docker images booking-rapat                        # lihat tag yang tersedia
sed -i 's/^APP_TAG=.*/APP_TAG=TAG_LAMA/' .env       # ganti TAG_LAMA
docker compose up -d --no-build --no-deps app
```

Hapus image lama yang tidak dipakai lagi: `docker rmi booking-rapat:TAG booking-rapat-migrate:TAG`.

### Upgrade ke versi multi-ruangan (sekali, dari versi `ADMIN_PASSWORD`)

Login berubah: password bersama `ADMIN_PASSWORD` diganti akun per orang, sesi disimpan di DB (berlaku 2 jam, cookie `br_session`). **Semua admin ter-logout saat deploy** dan baru bisa login setelah dibuatkan akun oleh superadmin. Data booking lama otomatis masuk ruangan "Ruang Rapat". Env lama (`ADMIN_*`, `OFFICE_*`, `TRUSTED_IP_HEADER`, `PUBLIC_ATTENDANCE_*`) tidak dibaca lagi; biarkan dulu untuk rollback.

1) Backup DB (wajib, sebelum migrate) dan `.env`:

```sh
mkdir -p ~/backup && chmod 700 ~/backup
/www/server/mysql/bin/mysqldump -u booking -p --single-transaction --routines --triggers booking_rapat \
  > ~/backup/booking_rapat-$(date +%F-%H%M).sql
ls -lh ~/backup/                                   # pastikan file tidak 0 byte
cp .env ~/backup/env-sebelum-multiruangan && chmod 600 ~/backup/env-sebelum-multiruangan
```

2) Tambah `APP_URL` di `.env`:

```sh
nano .env
grep '^APP_URL=' .env
```

3) Build, migrate, start:

```sh
git pull
export APP_TAG=$(git rev-parse HEAD | cut -c1-7)
docker compose build && docker compose run --rm migrate && docker compose up -d \
  && sed -i -e '/^APP_TAG=/d' -e '$a\' .env && echo "APP_TAG=$APP_TAG" >> .env
docker compose run --rm migrate migrate status     # harus "Database schema is up to date!"
```

4) Buat superadmin:

```sh
docker build --target build -t booking-rapat-tools .      # pakai cache dari `docker compose build`
docker run --rm -it --network host -e DB_HOST=127.0.0.1 \
  -v "$PWD/.env:/app/.env:ro" booking-rapat-tools npm run db:seed:superadmin
```

5) Login di `https://DOMAIN/dashboard/login` sebagai superadmin, lalu:
- Pengaturan (`/dashboard/pengaturan`): aktifkan cek IP kantor dan isi daftar IP kantor bila perlu (dulu `OFFICE_IP_CHECK` / `OFFICE_ALLOWED_IPS`), pastikan header IP `x-real-ip`.
- Akun > Akun baru: buat akun role Admin untuk tiap admin lama.
- Ruangan > "Ruang Rapat": pilih admin penanggung jawab, simpan.
- Bagikan username + password awal ke tiap admin; minta mereka ganti password di menu Password.

Kalau sudah stabil, hapus env lama dan salinan `.env`:

```sh
sed -i -E '/^(ADMIN_PASSWORD|ADMIN_SESSION_SECRET|OFFICE_IP_CHECK|OFFICE_ALLOWED_IPS|TRUSTED_IP_HEADER|PUBLIC_ATTENDANCE_[A-Z_]+)=/d' .env
rm ~/backup/env-sebelum-multiruangan
```

Rollback upgrade ini (urut, jangan kembalikan `.env` sebelum `down.sql` jalan karena file-nya ada di image migrate versi baru). Akun, ruangan, sesi, pengaturan, dan kolom jenis kelamin hilang; booking dan daftar hadir tetap ada:

```sh
docker compose stop app
docker compose run --rm migrate db execute --file prisma/migrations/20261103000000_multi_room/down.sql
cp ~/backup/env-sebelum-multiruangan .env           # berisi APP_TAG lama + ADMIN_PASSWORD
docker compose up -d --no-build --no-deps app
```

Kalau `down.sql` gagal, pulihkan dari backup (booking yang dibuat setelah upgrade ikut hilang):

```sh
docker compose stop app
/www/server/mysql/bin/mysql -u booking -p booking_rapat < ~/backup/booking_rapat-TANGGAL.sql
cp ~/backup/env-sebelum-multiruangan .env
docker compose up -d --no-build --no-deps app
```

### Upgrade proteksi publik (migration `20261104000000_public_protection`)

Menambah tabel `attendance_device_locks`, batas request publik, dan reCAPTCHA v3 (diatur di Pengaturan, bukan `.env`).

```sh
grep -q '^NEXT_PUBLIC_APP_MAINTAINER=' .env || { sed -i '$a\' .env && echo 'NEXT_PUBLIC_APP_MAINTAINER="BIRODATIN - APJAR"' >> .env; }
git pull
export APP_TAG=$(git rev-parse HEAD | cut -c1-7)
docker compose build && docker compose run --rm migrate && docker compose up -d \
  && sed -i -e '/^APP_TAG=/d' -e '$a\' .env && echo "APP_TAG=$APP_TAG" >> .env
docker compose run --rm migrate migrate status     # harus "Database schema is up to date!"
```

Setelah deploy, login superadmin > `/dashboard/pengaturan?tab=proteksi`:
- Tab `ip-kantor`: pastikan daftar IP kantor benar. IP di daftar itu tidak kena batas request per IP (kunci per perangkat tetap berlaku).
- reCAPTCHA: buat key v3 di https://www.google.com/recaptcha/admin (domain = domain publik), isi Site key + Secret key, lalu aktifkan. Secret hanya bisa diganti/dihapus, tidak ditampilkan lagi.
- Tab `daftar-hadir`: atur jeda per perangkat (default 30 menit).

Rollback migration ini saja:

```sh
docker compose stop app
docker compose run --rm migrate db execute --file prisma/migrations/20261104000000_public_protection/down.sql
sed -i 's/^APP_TAG=.*/APP_TAG=TAG_LAMA/' .env       # ganti TAG_LAMA
docker compose up -d --no-build --no-deps app
```

## 6. Kalau ada masalah

| Error | Penyebab | Solusi |
|---|---|---|
| `stat ... docker-compose.hostnet.yml: no such file` | Baris `COMPOSE_FILE` lama masih di `.env` | Hapus baris itu (lihat bagian 5) |
| `P1001` | Migration tidak bisa menghubungi MySQL | Pastikan MySQL jalan, lihat output terminal, cek ulang `docker compose run --rm migrate migrate status` |
| `Access denied for user` | Password salah atau user belum dibuat | Cek `DB_PASSWORD`, ulangi bagian Database + user |
| Build gagal / killed / out of memory | RAM kurang | Pasang swap (bagian 2) |
| Login: `Tidak dapat memverifikasi alamat jaringan.` | Aplikasi production diakses tanpa reverse proxy yang mengirim header IP terpercaya | Akses lewat domain nginx (bagian 4), cek `X-Real-IP` dan header IP di Pengaturan |
| Container tidak `(healthy)` | Aplikasi gagal start (`(healthy)` tidak mengecek DB) | `docker compose logs app`, cocokkan dengan baris di atas |

## 7. Perintah berguna

```sh
docker compose logs -f app       # lihat log langsung
docker compose restart app       # restart aplikasi

# cek / jalankan migration manual
docker compose run --rm migrate migrate status
docker compose run --rm migrate
```

Break-glass: matikan reCAPTCHA lewat DB bila tidak bisa login (key salah, Google tidak terjangkau):

```sh
/www/server/mysql/bin/mysql -u booking -p booking_rapat \
  -e "UPDATE app_settings SET value = 'false' WHERE \`key\` = 'recaptcha_enabled';"
docker compose restart app      # atau tunggu ±30 detik (cache pengaturan)
```

Rollback database: jalankan `down.sql` dari migration terbaru mundur ke yang ingin dibatalkan (urutan terbalik). Contoh batalkan migration terakhir saja:

```sh
docker compose run --rm migrate db execute --file prisma/migrations/20261104000000_public_protection/down.sql
```

Rollback penuh, urutan terbalik. **Awas: semua tabel dan data booking terhapus.**

```sh
for m in $(ls -r prisma/migrations | grep -E '^[0-9]'); do
  docker compose run --rm migrate db execute --file prisma/migrations/$m/down.sql || break
done
```

## Catatan keamanan

- Jangan commit atau bagikan `.env`.
- Pertimbangkan `limit_req` (pembatas jumlah request) di nginx untuk `/dashboard/login`.