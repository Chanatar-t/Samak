"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db, applications, events, STATUSES, SOURCES } from "@/db";

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
  revalidatePath("/");
  revalidatePath(`/a/${id}`);
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

// ponytail: og/title meta only; job boards that render client-side return little, fill by hand then
export async function fetchJobMeta(url: string) {
  await requireUser();
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("http(s) only");
  const source = SOURCE_HOSTS.find(([h]) => u.hostname.includes(h))?.[1] ?? "company_site";
  try {
    const html = await (await fetch(u, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0" } })).text();
    const meta = (p: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, "i"))?.[1];
    const title = meta("og:title") ?? html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? "";
    return { title, siteName: meta("og:site_name") ?? "", source };
  } catch {
    return { title: "", siteName: "", source };
  }
}
