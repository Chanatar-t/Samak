"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db, applications, events, STATUSES, SOURCES } from "@/db";
import { parseJobHtml, type JobMeta } from "@/lib/job-meta";

type Status = (typeof STATUSES)[number];
type Source = (typeof SOURCES)[number];

const str = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || null;

function fields(f: FormData) {
  const source = str(f, "source") as Source | null;
  return {
    company: str(f, "company") ?? "",
    position: str(f, "position") ?? "",
    source: source && SOURCES.includes(source) ? source : ("other" as const),
    jobUrl: str(f, "jobUrl"),
    location: str(f, "location"),
    salaryText: str(f, "salaryText"),
    jobDescription: str(f, "jobDescription"),
    notes: str(f, "notes"),
  };
}

const mine = (userId: string, id: string) => and(eq(applications.id, id), eq(applications.userId, userId));

export async function createApplication(f: FormData) {
  const userId = await requireUser();
  const data = fields(f);
  if (!data.company || !data.position) throw new Error("company and position required");
  const s = str(f, "status") as Status | null;
  const status = s && STATUSES.includes(s) ? s : "applied";
  const date = str(f, "appliedAt");
  const appliedAt = date ? new Date(date) : status === "wishlist" ? null : new Date();
  const [app] = await db.insert(applications).values({ ...data, userId, status, appliedAt }).returning();
  if (appliedAt) await db.insert(events).values({ applicationId: app.id, type: "applied", occurredAt: appliedAt, summary: "สมัครแล้ว" });
  redirect("/");
}

export async function updateApplication(id: string, f: FormData) {
  const userId = await requireUser();
  await db.update(applications).set(fields(f)).where(mine(userId, id));
  revalidatePath(`/a/${id}`);
}

export async function setStatus(id: string, status: Status) {
  const userId = await requireUser();
  if (!STATUSES.includes(status)) throw new Error("bad status");
  const [app] = await db.update(applications).set({ status, lastActivityAt: new Date() }).where(mine(userId, id)).returning();
  if (!app) return;
  const type = (["applied", "assessment", "interview", "offer", "rejected"] as const).find((t) => t === status) ?? "note";
  await db.insert(events).values({ applicationId: id, type, summary: `สถานะ → ${status}` });
  revalidatePath("/", "layout"); // list, dashboard and detail all show status
}

export async function addNote(id: string, f: FormData) {
  const userId = await requireUser();
  const summary = str(f, "summary");
  if (!summary) return;
  const [app] = await db.update(applications).set({ lastActivityAt: new Date() }).where(mine(userId, id)).returning();
  if (!app) return;
  const scheduled = str(f, "scheduledAt");
  await db.insert(events).values({ applicationId: id, type: "note", summary, scheduledAt: scheduled ? new Date(scheduled) : null });
  revalidatePath(`/a/${id}`);
}

export async function deleteApplication(id: string) {
  const userId = await requireUser();
  await db.delete(applications).where(mine(userId, id));
  redirect("/");
}

const SOURCE_HOSTS: [string, Source][] = [["jobthai", "jobthai"], ["jobsdb", "jobsdb"], ["jobbkk", "jobbkk"], ["linkedin", "linkedin"]];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// ponytail: JobsDB sits behind Cloudflare (403) — no server-side fetch works there, user fills by hand
export async function fetchJobMeta(url: string): Promise<JobMeta & { source: Source; error?: string }> {
  await requireUser();
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("http(s) only");
  const source = SOURCE_HOSTS.find(([h]) => u.hostname.includes(h))?.[1] ?? "company_site";
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { "user-agent": UA, "accept-language": "th,en;q=0.8" } });
    if (!res.ok) return { source, error: `เว็บนี้ไม่ให้ดึงข้อมูล (HTTP ${res.status})` };
    return { ...parseJobHtml(await res.text()), source };
  } catch {
    return { source, error: "โหลดหน้าไม่สำเร็จ" };
  }
}
