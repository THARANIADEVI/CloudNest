# CloudNest

Cloud-based file storage and sharing app (Google Drive–style core features), built as a single Next.js full-stack app: React UI + Next.js API routes + Prisma/PostgreSQL, no separate backend service.

## Features

**Core**
- Email + password auth (bcrypt + JWT in an HttpOnly cookie)
- Folder management (nested, CRUD)
- File upload/download, drag & drop
- Sharing with Viewer/Editor roles, per-user
- Public share links with optional expiry & password
- Search & filters, starred files
- Trash with restore / permanent delete

**Phase 2**
- File version history
- Image/PDF previews
- Activity log per file
- Tags & labels
- Per-user storage quota

**Security**
- JWT stored in HttpOnly, `SameSite=Lax` cookies
- Server-side role checks on every file/folder route (`src/lib/permissions.ts`)
- Rate limiting on login, signup, and public share-link downloads (`src/lib/rateLimit.ts`)
- Zod input validation on API routes
- Object storage abstraction supports S3-compatible signed URLs (falls back to local disk in dev)

## Tech stack

- Next.js (App Router) + React
- Prisma ORM, PostgreSQL (SQLite works for local dev via `DATABASE_URL`)
- Tailwind CSS
- Vitest for unit tests

## Getting started

```bash
npm install
npx prisma migrate dev   # applies migrations to your local DB
npm run dev
```

Open http://localhost:3000.

## Environment variables

Create `.env` (see `.env` in repo for local defaults):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres (or SQLite for local dev) connection string |
| `JWT_SECRET` | yes | Signing key for session JWTs |
| `UPLOAD_DIR` | no | Local disk path for uploads when S3 is not configured (defaults to `./uploads`) |
| `S3_BUCKET` | no | Enables S3-compatible object storage when set together with the vars below |
| `S3_REGION` | no | S3 region (default `auto`, works with R2/Supabase) |
| `S3_ENDPOINT` | no | Custom endpoint for S3-compatible providers (Supabase Storage, R2, MinIO) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | no | Credentials for the bucket above |

Without `S3_*` vars, files are stored on local disk — fine for local dev, **not durable on ephemeral hosts** (e.g. Render's free tier wipes the filesystem on redeploy). Set the S3 vars in production.

## Scripts

- `npm run dev` – start dev server
- `npm run build` / `npm start` – production build & serve
- `npm run lint` – ESLint
- `npm test` – run unit tests (Vitest)

## Deployment

- **Backend/DB**: `render.yaml` provisions a Postgres DB + Node web service on Render (`npx prisma migrate deploy` runs on deploy). Configure `S3_*` env vars in the Render dashboard for durable file storage.
- **Frontend**: project is linked to Vercel (`.vercel/project.json`); `vercel --prod` or a connected Git push deploys it. If deploying frontend and backend separately, point the frontend's API calls at the Render URL.
