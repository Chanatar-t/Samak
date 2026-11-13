"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { db, emails, applications } from "@/db";
import type { Extracted } from "@/lib/extract";
import { applyToApplication, createFromEmail, syncEmails, type SyncResult } from "@/lib/sync";

export async function syncNow(): Promise<SyncResult | { error: string }> {
  const userId = await requireUser();
  try {
    const r = await syncEmails(userId);
    revalidatePath("/inbox");
    revalidatePath("/");
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function myEmail(userId: string, id: string) {
  const [e] = await db.select().from(emails).where(and(eq(emails.id, id), eq(emails.userId, userId)));
  if (!e) throw new Error("email not found");
  return e;
}

// fallback when the LLM failed: still lets the user file the mail by hand
const parsed = (e: { parsedJson: unknown; subject: string }): Extracted =>
  (e.parsedJson as Extracted | null) ?? { kind: "other_update", company: null, position: null, source: "other", scheduledAt: null, summary: e.subject, confidence: 0 };

export async function attachEmail(emailId: string, f: FormData) {
  const userId = await requireUser();
  const e = await myEmail(userId, emailId);
  const appId = f.get("applicationId") as string;
  const [app] = await db.select().from(applications).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
  if (!app) return;
  await applyToApplication(app.id, e.id, parsed(e), e.receivedAt);
  await db.update(emails).set({ processState: "matched" }).where(eq(emails.id, e.id));
  revalidatePath("/inbox");
}

export async function createFromInbox(emailId: string) {
  const userId = await requireUser();
  const e = await myEmail(userId, emailId);
  await createFromEmail(userId, e.id, parsed(e), e.receivedAt);
  await db.update(emails).set({ processState: "matched" }).where(eq(emails.id, e.id));
  revalidatePath("/inbox");
}

export async function ignoreEmail(emailId: string) {
  const userId = await requireUser();
  const e = await myEmail(userId, emailId);
  await db.update(emails).set({ processState: "ignored" }).where(eq(emails.id, e.id));
  revalidatePath("/inbox");
}
