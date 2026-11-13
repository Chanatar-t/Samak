# Job Tracker

Personal job application tracker. Phase 0: manual CRUD, kanban board, URL prefill, dashboard.

## Setup

1. Copy `.env.example` → `.env.local` and fill it in:
   - `AUTH_SECRET`: `npx auth secret`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: Google Cloud Console → OAuth client (Web), redirect URI `http://localhost:3000/api/auth/callback/google`
   - `ALLOWED_EMAIL`: the only Google account allowed in
2. `npm run db:up` (Postgres in Docker), then `npm run db:push`
3. `npm run dev`
