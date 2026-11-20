<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Samak: guide for AI agents

Single-user, self-hosted job application tracker. Next.js 16 App Router + Drizzle/Postgres (Docker) + Auth.js v5.
Reads job-board emails from Gmail over IMAP and updates application statuses. UI text is Thai.

## Setting it up for a user

Do these in order and check each result before moving on.

1. Prerequisites: `node -v` (20+) and `docker info` must both succeed. If `docker info` fails, ask the user to start
   Docker Desktop. Don't try to install Docker yourself.
2. `npm install`
3. `APP_PASSWORD=<password> npm run setup`. Ask the user what password they want, or leave the variable out and the script
   generates one and prints it. The script is idempotent and never overwrites a value already in `.env.local`. It:
   creates `.env.local` from `.env.example`, fills `AUTH_SECRET` and `APP_PASSWORD`, runs `docker compose up -d`,
   waits for Postgres, runs `drizzle-kit push`.
4. `npm run dev`, then confirm `curl -s -o /dev/null -w "%{http_code}" localhost:3000/login` prints `200`.
5. Gmail must be connected by the user in the browser (Settings → เชื่อม Gmail). Tell them to:
   enable 2-Step Verification at https://myaccount.google.com/signinoptions/twosv, create an App Password at
   https://myaccount.google.com/apppasswords, then paste it into Settings and press "ทดสอบและเชื่อมต่อ".
   **Never ask the user to paste their Gmail App Password or login password into the chat.** If they insist on
   a headless setup, they can put `GMAIL_USER` / `GMAIL_APP_PASSWORD` in `.env.local` themselves.

## Verifying

- `npm test` (node:test, no framework), `npx tsc --noEmit`, `npx eslint src`
- `npm run gmail:peek -- --days 7` lists what the Gmail query would fetch, read-only. It needs `GMAIL_*` in env.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Failed query: select ... from "applications"` | Postgres isn't running. Start Docker Desktop, run `npm run db:up` |
| `column ... does not exist` | Schema changed. Run `npm run db:push` (no `--force` on a DB with data) |
| Login page says no password is set | `APP_PASSWORD` is missing from `.env.local`. Run `npm run setup`, restart `npm run dev` |
| Gmail "ไม่ยอมรับอีเมลหรือรหัสนี้" | Not an App Password, or 2-Step is off. Workspace/Advanced Protection accounts may not allow App Passwords |
| "ถอดรหัส App Password ไม่ได้" | `AUTH_SECRET` changed. Reconnect Gmail in Settings |
| Old data invisible after switching login | Rows are owned by `ALLOWED_EMAIL` (the old Google login email). Set it back in `.env.local` |

## Code map

- `src/auth.ts`: password login (+ optional Google). `requireUser()` returns `OWNER`, which owns every row.
- `src/lib/gmail.ts`: IMAP fetch and `testGmail`. `src/lib/sync.ts`: sync pipeline, auto-sync throttle, 30-day auto-ghost.
- `src/lib/rules.ts`: free rule-based parsers per job board. Add a template here, with a case in `rules.test.ts`.
- `src/lib/extract.ts`: optional Claude fallback when `ANTHROPIC_API_KEY` is set. `src/lib/secret.ts`: AES-GCM for the stored app password.
- `src/db/schema.ts`: tables. Change it, then run `npm run db:push`.

## Rules

- Never commit `.env*` (except `.env.example`) or `client_secret*.json`. Both are gitignored.
- Don't log or print email bodies, app passwords or `.env.local` values.
- Keep it single-user. Don't add multi-tenant code unless asked.
