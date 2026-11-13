import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/auth";
import { db, applications, isSilent } from "@/db";
import { SOURCE, STATUS, ago } from "@/lib/labels";
import { cn } from "@/lib/utils";

const REPLIED = ["assessment", "interview", "offer", "rejected"];

export default async function Dashboard() {
  const userId = await requireUser();
  // ponytail: aggregates in JS, fine for a few hundred rows; move to SQL group by if it grows
  const apps = (await db.select().from(applications).where(eq(applications.userId, userId))).filter((a) => a.status !== "wishlist");
  const replied = apps.filter((a) => REPLIED.includes(a.status)).length;
  const interviews = apps.filter((a) => ["interview", "offer"].includes(a.status)).length;
  const silent = apps.filter(isSilent);
  const bySource = Object.entries(Object.groupBy(apps, (a) => a.source))
    .map(([s, l]) => ({ s: s as keyof typeof SOURCE, n: l!.length, r: l!.filter((a) => REPLIED.includes(a.status)).length }))
    .sort((x, y) => y.n - x.n);
  const max = Math.max(1, ...bySource.map((x) => x.n));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="สมัครแล้ว" value={apps.length} />
        <Stat label="อัตราตอบกลับ" value={apps.length ? `${Math.round((replied / apps.length) * 100)}%` : "–"} />
        <Stat label="ได้สัมภาษณ์" value={interviews} />
        <Stat label="เงียบเกิน 14 วัน" value={silent.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 font-medium">แยกตามเว็บ</h2>
          <div className="space-y-3">
            {bySource.map((x) => (
              <div key={x.s} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span>{SOURCE[x.s]}</span>
                  <span className="text-muted-foreground">ตอบกลับ {x.r}/{x.n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/25" style={{ width: `${(x.n / max) * 100}%` }}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(x.r / x.n) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {!bySource.length && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 font-medium">เงียบเกิน 14 วัน</h2>
          <ul className="divide-y text-sm">
            {silent.map((a) => (
              <li key={a.id}>
                <Link href={`/a/${a.id}`} className="flex items-center gap-2 py-2 hover:text-foreground">
                  <span className={cn("size-2 rounded-full", STATUS[a.status].dot)} />
                  <span className="truncate">{a.company} — {a.position}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ago(a.lastActivityAt)}</span>
                </Link>
              </li>
            ))}
            {!silent.length && <li className="text-muted-foreground">ไม่มี</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
  </div>
);
