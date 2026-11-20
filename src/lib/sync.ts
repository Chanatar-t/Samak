import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, applications, emails, events, settings, GHOST_DAYS, OPEN_STATUSES } from "@/db";
import { envCreds, fetchJobEmails, type GmailCreds, type RawEmail } from "./gmail";
import { decrypt } from "./secret";
import { extract, type Extracted } from "./extract";
import { classify, guess } from "./rules";
import { findMatches, nextStatus } from "./match";

const FIRST_SYNC_DAYS = 60;
const AUTO_CONFIDENCE = 0.7;

export const KIND_EVENT = {
  application_confirmation: "applied",
  viewed: "viewed",
  assessment: "assessment",
  interview: "interview",
  offer: "offer",
  rejection: "rejected",
  other_update: "note",
} as const;

type Kind = keyof typeof KIND_EVENT;
export type SyncResult = { fetched: number; created: number; updated: number; review: number; ignored: number; ghosted?: number };

/** Apply one extracted email to an application: event + status bump + lastActivity. */
export async function applyToApplication(appId: string, emailId: string, x: Extracted, receivedAt: Date) {
  const [app] = await db.select().from(applications).where(eq(applications.id, appId));
  if (!app) return;
  const type = KIND_EVENT[x.kind as Kind] ?? "note";
  const incoming = (["applied", "assessment", "interview", "offer", "rejected"] as const).find((s) => s === type) ?? null;
  const aliases = x.company && x.company !== app.company && !app.companyAliases.includes(x.company) ? [...app.companyAliases, x.company] : app.companyAliases;
  await db
    .update(applications)
    .set({ status: nextStatus(app.status, incoming), lastActivityAt: receivedAt > app.lastActivityAt ? receivedAt : app.lastActivityAt, companyAliases: aliases })
    .where(eq(applications.id, appId));
  const scheduledAt = x.scheduledAt && !isNaN(Date.parse(x.scheduledAt)) ? new Date(x.scheduledAt) : null;
  await db.insert(events).values({ applicationId: appId, type, occurredAt: receivedAt, summary: x.summary, emailId, scheduledAt });
}

export async function createFromEmail(userId: string, emailId: string, x: Extracted, receivedAt: Date) {
  const [app] = await db
    .insert(applications)
    .values({ userId, company: x.company ?? "?", position: x.position ?? "ไม่ระบุตำแหน่ง", source: x.source, status: "applied", appliedAt: receivedAt, lastActivityAt: receivedAt })
    .returning();
  await db.insert(events).values({ applicationId: app.id, type: "applied", occurredAt: receivedAt, summary: x.summary, emailId });
  return app;
}

async function prepare(userId: string, e: RawEmail) {
  // insert first: the unique gmailMessageId stops two overlapping syncs from processing the same mail
  const [row] = await db
    .insert(emails)
    .values({ userId, gmailMessageId: e.gmailMessageId, from: e.from, subject: e.subject, receivedAt: e.receivedAt })
    .onConflictDoNothing()
    .returning();
  if (!row) return null;
  // free rules for job-board templates first; Claude only for the rest, and only when a key is set
  const x: Extracted | null =
    classify(e) ??
    (process.env.ANTHROPIC_API_KEY
      ? await extract(e).catch((err) => { console.error("extract failed", e.subject, err); return guess(e); })
      : guess(e));
  return { row, x, e };
}

async function apply(userId: string, p: NonNullable<Awaited<ReturnType<typeof prepare>>>, r: SyncResult) {
  const { row, x, e } = p;
  const state = async (processState: "matched" | "needs_review" | "ignored") =>
    db.update(emails).set({ processState, parsedJson: x }).where(eq(emails.id, row.id));

  if (!x) return (r.review++, state("needs_review"));
  if (x.kind === "not_job_application") return (r.ignored++, state("ignored"));

  const apps = await db.select().from(applications).where(eq(applications.userId, userId));
  const hits = findMatches(x.company, x.position, apps);
  const sure = x.confidence >= AUTO_CONFIDENCE;

  if (sure && hits.length === 1) {
    await applyToApplication(hits[0].id, row.id, x, e.receivedAt);
    return (r.updated++, state("matched"));
  }
  // "someone viewed your resume" for a job we don't track = profile view, not news
  if (x.kind === "viewed" && hits.length === 0) return (r.ignored++, state("ignored"));
  if (sure && hits.length === 0 && x.kind === "application_confirmation" && x.company) {
    await createFromEmail(userId, row.id, x, e.receivedAt);
    return (r.created++, state("matched"));
  }
  return (r.review++, state("needs_review"));
}

// ponytail: LLM calls 5 in parallel, DB decisions one by one; a queue only if volume ever needs it
/** Gmail login: the one saved in Settings wins, else GMAIL_USER / GMAIL_APP_PASSWORD from env. */
export async function gmailCreds(userId: string): Promise<GmailCreds | null> {
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId));
  if (s?.gmailUser && s.gmailAppPassword) {
    try {
      return { user: s.gmailUser, pass: decrypt(s.gmailAppPassword) };
    } catch {
      throw new Error("ถอดรหัส App Password ไม่ได้ (AUTH_SECRET เปลี่ยน?) — เชื่อม Gmail ใหม่ในหน้า ตั้งค่า");
    }
  }
  return envCreds();
}

const noteSync = (userId: string, lastSyncError: string | null) =>
  db.insert(settings).values({ userId, lastSyncAt: new Date(), lastSyncError }).onConflictDoUpdate({ target: settings.userId, set: { lastSyncAt: new Date(), lastSyncError } });

// `from` re-reads an older window (e.g. after a rules fix); already-stored mails are still skipped
export async function syncEmails(userId: string, from?: Date): Promise<SyncResult> {
  try {
    const r = await runSync(userId, from);
    await noteSync(userId, null);
    return r;
  } catch (e) {
    await noteSync(userId, e instanceof Error ? e.message : String(e)).catch(() => {});
    throw e;
  }
}

async function runSync(userId: string, from?: Date): Promise<SyncResult> {
  const creds = await gmailCreds(userId);
  if (!creds) throw new Error("ยังไม่ได้เชื่อม Gmail — ไปที่หน้า ตั้งค่า");
  const [last] = await db.select({ at: emails.receivedAt }).from(emails).where(eq(emails.userId, userId)).orderBy(desc(emails.receivedAt)).limit(1);
  // IMAP SINCE is day-granular; step back a day, duplicates are skipped by gmailMessageId
  const since = from ?? (last ? new Date(last.at.getTime() - 864e5) : new Date(Date.now() - FIRST_SYNC_DAYS * 864e5));
  const known = new Set((await db.select({ id: emails.gmailMessageId }).from(emails).where(eq(emails.userId, userId))).map((x) => x.id));

  const fresh = (await fetchJobEmails(since, creds)).filter((e) => !known.has(e.gmailMessageId)).sort((a, b) => +a.receivedAt - +b.receivedAt);
  const r: SyncResult = { fetched: fresh.length, created: 0, updated: 0, review: 0, ignored: 0 };
  // oldest first so "applied" lands before "interview" for the same job
  for (let i = 0; i < fresh.length; i += 5) {
    const batch = await Promise.all(fresh.slice(i, i + 5).map((e) => prepare(userId, e)));
    for (const p of batch) if (p) await apply(userId, p, r);
  }
  // after the mail pass, so a fresh reply saves an application from being ghosted
  r.ghosted = await ghostStale(userId);
  return r;
}

/** Open applications with no news for GHOST_DAYS → "ghosted". lastActivityAt stays as the real last news. */
export async function ghostStale(userId: string) {
  const stale = await db
    .update(applications)
    .set({ status: "ghosted" })
    .where(and(eq(applications.userId, userId), inArray(applications.status, [...OPEN_STATUSES]), lt(applications.lastActivityAt, new Date(Date.now() - GHOST_DAYS * 864e5))))
    .returning({ id: applications.id });
  if (stale.length) await db.insert(events).values(stale.map((a) => ({ applicationId: a.id, type: "note" as const, summary: `เงียบเกิน ${GHOST_DAYS} วัน → เงียบหาย (อัตโนมัติ)` })));
  return stale.length;
}

// ponytail: in-memory throttle, one process only; on serverless the Vercel cron covers it
const AUTO_EVERY = 10 * 60e3;
let lastAuto = 0;
let running = false;
/** Background sync when the app is opened locally, at most every 10 min, never two at once. */
export async function autoSync(userId: string) {
  if (running || Date.now() - lastAuto < AUTO_EVERY) return;
  running = true;
  lastAuto = Date.now();
  try {
    await syncEmails(userId);
  } catch (e) {
    console.error("auto sync failed", e);
  } finally {
    running = false;
  }
}
