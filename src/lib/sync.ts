import { desc, eq } from "drizzle-orm";
import { db, applications, emails, events } from "@/db";
import { fetchJobEmails, type RawEmail } from "./gmail";
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
export type SyncResult = { fetched: number; created: number; updated: number; review: number; ignored: number };

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
export async function syncEmails(userId: string): Promise<SyncResult> {
  const [last] = await db.select({ at: emails.receivedAt }).from(emails).where(eq(emails.userId, userId)).orderBy(desc(emails.receivedAt)).limit(1);
  // IMAP SINCE is day-granular; step back a day, duplicates are skipped by gmailMessageId
  const since = last ? new Date(last.at.getTime() - 864e5) : new Date(Date.now() - FIRST_SYNC_DAYS * 864e5);
  const known = new Set((await db.select({ id: emails.gmailMessageId }).from(emails).where(eq(emails.userId, userId))).map((x) => x.id));

  const fresh = (await fetchJobEmails(since)).filter((e) => !known.has(e.gmailMessageId)).sort((a, b) => +a.receivedAt - +b.receivedAt);
  const r: SyncResult = { fetched: fresh.length, created: 0, updated: 0, review: 0, ignored: 0 };
  // oldest first so "applied" lands before "interview" for the same job
  for (let i = 0; i < fresh.length; i += 5) {
    const batch = await Promise.all(fresh.slice(i, i + 5).map((e) => prepare(userId, e)));
    for (const p of batch) if (p) await apply(userId, p, r);
  }
  return r;
}
