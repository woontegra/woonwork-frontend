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

## Railway deploy (API)

Önemli: **Root Directory boş olmalı** (repo kökü). `apps/api` yapma.

1. Settings → Root Directory → boş / `.`
2. Builder: **Nixpacks** (varsayılan; `railway.toml` + `nixpacks.toml`)
3. Watch Paths (opsiyonel): `apps/api/**`, `packages/shared/**`
4. Env:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` (≥32)
   - `JWT_REFRESH_SECRET` (≥32)
   - `CORS_ORIGIN` = Vercel frontend URL
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (seed için)

`PORT` Railway verir. Dockerfile gerekmez; istersen `Dockerfile.api` kullanılabilir.

## Vercel deploy (yalnız frontend)

API Vercel’de derlenmez. Repo kökündeki `vercel.json` sadece web build çalıştırır.

1. Root Directory: **boş** (repo kökü)
2. Build: `npm run build:web`
3. Output: `apps/web/dist`
4. Env: `VITE_API_URL` = `https://<railway-api-url>/api`
