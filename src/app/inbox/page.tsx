import { and, desc, eq, ne } from "drizzle-orm";
import { requireUser } from "@/auth";
import { db, emails, applications } from "@/db";
import type { Extracted } from "@/lib/extract";
import { cn } from "@/lib/utils";
import { findMatches } from "@/lib/match";
import { Button } from "@/components/ui/button";
import { attachEmail, createFromInbox, ignoreEmail } from "./actions";
import Link from "next/link";
import { gmailCreds } from "@/lib/sync";
import SyncButton from "./sync-button";
import Attach from "./attach";

const KIND: Record<Extracted["kind"], string> = {
  application_confirmation: "ยืนยันการสมัคร",
  viewed: "บริษัทเปิดดูใบสมัคร",
  assessment: "แบบทดสอบ",
  interview: "นัดสัมภาษณ์",
  offer: "Offer",
  rejection: "ไม่ผ่าน",
  other_update: "อัปเดตอื่นๆ",
  not_job_application: "ไม่เกี่ยวกับใบสมัคร",
};

const fmt = (d: Date) => d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default async function InboxPage() {
  const userId = await requireUser();
  const review = await db.select().from(emails).where(and(eq(emails.userId, userId), eq(emails.processState, "needs_review"))).orderBy(desc(emails.receivedAt));
  const recent = await db.select().from(emails).where(and(eq(emails.userId, userId), ne(emails.processState, "needs_review"))).orderBy(desc(emails.receivedAt)).limit(30);
  const connected = await gmailCreds(userId).then(Boolean, () => false);
  const apps = await db.select().from(applications).where(eq(applications.userId, userId)).orderBy(applications.company);
  // datalist matches on the visible text, so labels must be unique: same company + position twice gets its date
  const base = (a: (typeof apps)[number]) => `${a.company} — ${a.position}`;
  const dup = new Set(apps.map(base).filter((l, i, all) => all.indexOf(l) !== i));
  const opts = apps.map((a) => ({ id: a.id, label: dup.has(base(a)) ? `${base(a)} (${(a.appliedAt ?? a.lastActivityAt).toLocaleDateString("th-TH")})` : base(a) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">อีเมลเกี่ยวกับการสมัครงานจาก Gmail · อันที่ระบบไม่แน่ใจจะรอให้ตรวจที่นี่</p>
      </div>
      {connected ? (
        <SyncButton />
      ) : (
        <div className="rounded-xl bg-highlight/60 p-4 text-sm text-highlight-foreground">
          ยังไม่ได้เชื่อม Gmail —{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-4">ไปเชื่อมที่หน้าตั้งค่า</Link> ใช้เวลาราว 2 นาที
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">รอตรวจ <span className="text-muted-foreground">{review.length}</span></h2>
        {!review.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">ไม่มีอีเมลค้างตรวจ</p>}
        {review.map((e) => {
          const x = e.parsedJson as Extracted | null;
          const hits = x ? findMatches(x.company, x.position, apps) : [];
          return (
            <article key={e.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                <span>{fmt(e.receivedAt)}</span>
                <span className="truncate">{e.from}</span>
              </div>
              <div className="font-medium">{e.subject}</div>
              {x ? (
                <div className="text-sm">
                  <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs">{KIND[x.kind]}</span>
                  {[x.company, x.position].filter(Boolean).join(" — ") || "ไม่รู้บริษัท"}
                  <p className="mt-1 text-muted-foreground">{x.summary}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">อ่านอีเมลนี้ไม่สำเร็จ — เลือกเองได้</p>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Attach apps={opts} hits={hits.map((h) => opts.find((o) => o.id === h.id)!)} action={attachEmail.bind(null, e.id)} />
                <form action={createFromInbox.bind(null, e.id)}><Button variant="outline">สร้างใบใหม่</Button></form>
                <form action={ignoreEmail.bind(null, e.id)}><Button variant="ghost">ไม่เกี่ยว</Button></form>
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">จัดการแล้วล่าสุด</h2>
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {recent.map((e) => {
            const x = e.parsedJson as Extracted | null;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", e.processState === "matched" ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{x ? KIND[x.kind] : ""}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{e.receivedAt.toLocaleDateString("th-TH")}</span>
              </li>
            );
          })}
          {!recent.length && <li className="px-4 py-6 text-center text-muted-foreground">ยังไม่เคย sync</li>}
        </ul>
      </section>
    </div>
  );
}
