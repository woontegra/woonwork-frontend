# WoonWork

Tamamen Türkçe, çok kiracılı (multi-tenant) şirket çalışma platformu.

## Teknoloji

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + TypeScript
- **Veritabanı:** PostgreSQL + Prisma
- **Auth:** JWT + refresh token

## Kurulum

```bash
npm install

# Ortam dosyaları
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# PostgreSQL çalışıyor olmalı (varsayılan: 127.0.0.1:5433)
npm run db:generate
npm run db:push
npm run db:seed

# Geliştirme (iki terminal)
npm run dev:api
npm run dev:web
```

- API: http://localhost:4000
- Web: http://localhost:5173

Seed giriş bilgileri `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` değerlerinden alınır.

## Monorepo

```
apps/web        — React arayüz
apps/api        — Express API
packages/shared — Ortak tipler ve Zod şemaları
```

## Railway deploy

`@woonwork/shared` private monorepo paketidir. Railway’de **Root Directory’yi `apps/api` veya `apps/web` yapma** — npm registry’de bulunamaz (`E404`).

Her iki servis için:

1. **Root Directory:** boş bırak (repo kökü)
2. **Builder:** Dockerfile
3. API Dockerfile: `Dockerfile.api` (`railway.api.toml`)
4. Web Dockerfile: `Dockerfile.web` (`railway.web.toml`)

### API ortam değişkenleri

- `DATABASE_URL` (Railway Postgres)
- `JWT_ACCESS_SECRET` (min 32 karakter)
- `JWT_REFRESH_SECRET` (min 32 karakter)
- `CORS_ORIGIN` = frontend URL (örn. `https://web-xxx.up.railway.app`)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (ilk seed için, opsiyonel)

`PORT` Railway tarafından otomatik verilir.

### Web build arg

- `VITE_API_URL` = `https://api-xxx.up.railway.app/api`

İlk deploy sonrası API’de seed:

```bash
railway run -s <api-service> npm run db:seed -w @woonwork/api
```

## Vercel deploy (yalnız frontend)

API Vercel’de derlenmez. Repo kökündeki `vercel.json` sadece web build çalıştırır.

1. Root Directory: **boş** (repo kökü)
2. Build: `npm run build:web`
3. Output: `apps/web/dist`
4. Env: `VITE_API_URL` = `https://<railway-api-url>/api`
