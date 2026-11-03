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
openssl rand -hex 32     # salin hasilnya ke ADMIN_SESSION_SECRET
nano .env
```

Isi seperti ini:

```ini
DB_PORT=3306
DB_DATABASE=booking_rapat
DB_USERNAME=booking
DB_PASSWORD=PASSWORD_KUAT
ADMIN_PASSWORD="password-admin"
ADMIN_SESSION_SECRET="hasil-openssl-tadi"
OFFICE_ALLOWED_IPS="203.0.113.10"
TRUSTED_IP_HEADER="x-real-ip"
OFFICE_IP_CHECK=true
```

- `OFFICE_ALLOWED_IPS`: IP kantor, pisahkan dengan koma. Kosong = semua orang ditolak.
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
curl -I http://127.0.0.1:8282/                     # 403 = normal kalau OFFICE_IP_CHECK=true
```

`(healthy)` dan `403` hanya berarti aplikasi sudah listen, bukan berarti DB tersambung. Koneksi DB dicek lewat `migrate status` di atas. Hasil migration ada di output terminal (container `migrate` langsung dihapus).

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
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

```sh
sudo nginx -t && sudo nginx -s reload
```

Baris `X-Real-IP` wajib ada. Aplikasi membaca IP pengunjung dari situ (`TRUSTED_IP_HEADER="x-real-ip"`) untuk cek IP kantor.

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

## 6. Kalau ada masalah

| Error | Penyebab | Solusi |
|---|---|---|
| `stat ... docker-compose.hostnet.yml: no such file` | Baris `COMPOSE_FILE` lama masih di `.env` | Hapus baris itu (lihat bagian 5) |
| `P1001` | Migration tidak bisa menghubungi MySQL | Pastikan MySQL jalan, lihat output terminal, cek ulang `docker compose run --rm migrate migrate status` |
| `Access denied for user` | Password salah atau user belum dibuat | Cek `DB_PASSWORD`, ulangi bagian Database + user |
| Build gagal / killed / out of memory | RAM kurang | Pasang swap (bagian 2) |
| Container tidak `(healthy)` | Aplikasi gagal start (`(healthy)` tidak mengecek DB) | `docker compose logs app`, cocokkan dengan baris di atas |

## 7. Perintah berguna

```sh
docker compose logs -f app       # lihat log langsung
docker compose restart app       # restart aplikasi

# cek / jalankan migration manual
docker compose run --rm migrate migrate status
docker compose run --rm migrate
```

Rollback database: jalankan `down.sql` dari migration terbaru mundur ke yang ingin dibatalkan (urutan terbalik). Contoh batalkan migration terakhir saja:

```sh
docker compose run --rm migrate db execute --file prisma/migrations/20261029000000_public_attendance/down.sql
```

Rollback penuh, urutan terbalik. **Awas: semua tabel dan data booking terhapus.**

```sh
for m in $(ls -r prisma/migrations | grep -E '^[0-9]'); do
  docker compose run --rm migrate db execute --file prisma/migrations/$m/down.sql || break
done
```

## Catatan keamanan

- Jangan commit atau bagikan `.env`.
- Pertimbangkan `limit_req` (pembatas jumlah request) di nginx untuk halaman login admin.