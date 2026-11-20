import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/auth";
import { db, applications, isSilent, type Application } from "@/db";
import { setStatus } from "../actions";
import { SOURCE, STATUS, ago } from "@/lib/labels";
import { cn } from "@/lib/utils";

const REPLIED = ["assessment", "interview", "offer", "rejected"];
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

export default async function Dashboard() {
  const userId = await requireUser();
  // ponytail: aggregates in JS, fine for a few hundred rows; move to SQL group by if it grows
  const apps = (await db.select().from(applications).where(eq(applications.userId, userId))).filter((a) => a.status !== "wishlist");
  const replied = apps.filter((a) => REPLIED.includes(a.status)).length;
  const interviews = apps.filter((a) => ["interview", "offer"].includes(a.status)).length;
  const offers = apps.filter((a) => a.status === "offer").length;
  const latest = (st: string) => apps.filter((a) => a.status === st).sort((x, y) => +y.lastActivityAt - +x.lastActivityAt);
  const rejected = latest("rejected");
  const ghosted = latest("ghosted");
  const silent = apps.filter(isSilent).sort((x, y) => +x.lastActivityAt - +y.lastActivityAt);
  const bySource = Object.entries(Object.groupBy(apps, (a) => a.source))
    .map(([s, l]) => ({ s: s as keyof typeof SOURCE, n: l!.length, r: l!.filter((a) => REPLIED.includes(a.status)).length }))
    .sort((x, y) => y.n - x.n);
  const max = Math.max(1, ...bySource.map((x) => x.n));
  // every application sits in exactly one bucket, so these add up to the total
  const buckets = (["applied", "assessment", "interview", "offer", "rejected", "ghosted", "withdrawn"] as const).map((st) => ({
    st,
    label: st === "applied" ? "รอตอบ" : STATUS[st].label,
    n: apps.filter((a) => a.status === st).length,
  }));
  const rates = [
    { label: "อัตราตอบกลับ", n: replied, note: "ทดสอบ / สัมภาษณ์ / offer / ไม่ผ่าน" },
    { label: "ได้สัมภาษณ์", n: interviews, note: "สัมภาษณ์ + offer" },
    { label: "ได้ offer", n: offers, note: "" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">สรุปผล</h1>

      <section className="space-y-5 rounded-xl border bg-card p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{apps.length}</span>
          <span className="text-muted-foreground">ใบที่สมัครไป <span className="text-xs">(ไม่นับ “อยากสมัคร”)</span></span>
        </div>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
          {buckets.filter((b) => b.n).map((b) => (
            <div key={b.st} title={`${b.label} ${b.n}`} className={STATUS[b.st].dot} style={{ width: `${(b.n / apps.length) * 100}%` }} />
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
          {buckets.map((b) => (
            <div key={b.st} className={cn(!b.n && "opacity-40")}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", STATUS[b.st].dot)} />
                {b.label}
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {b.n}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{pct(b.n, apps.length)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {rates.map((r) => (
          <div key={r.label} className="bg-card p-5">
            <div className="text-sm text-muted-foreground">{r.label}</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{pct(r.n, apps.length)}</div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
              {r.n} จาก {apps.length} ใบ{r.note && ` · ${r.note}`}
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">แยกตามเว็บ</h2>
          <div className="space-y-4 rounded-xl border bg-card p-5">
            {bySource.map((x) => (
              <div key={x.s} className="text-sm">
                <div className="mb-1.5 flex justify-between">
                  <span className="font-medium">{SOURCE[x.s]}</span>
                  <span className="text-muted-foreground tabular-nums">ตอบกลับ {x.r}/{x.n} · {pct(x.r, x.n)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/20" style={{ width: `${(x.n / max) * 100}%` }}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(x.r / x.n) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {!bySource.length && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            ควรตาม — เงียบเกิน 14 วัน
            {silent.length > 0 && <span className="rounded-full bg-highlight px-2 text-xs text-highlight-foreground">{silent.length}</span>}
          </h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {silent.map((a) => (
              <li key={a.id} className="flex items-center hover:bg-muted/50">
                <Link href={`/a/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
                  <span className={cn("size-2 shrink-0 rounded-full", STATUS[a.status].dot)} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{a.company}</span> <span className="text-muted-foreground">· {a.position}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(a.lastActivityAt)}</span>
                </Link>
                <form action={setStatus.bind(null, a.id, "ghosted")} className="px-2">
                  <button title="ย้ายไป เงียบหาย" className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">→ เงียบหาย</button>
                </form>
              </li>
            ))}
            {!silent.length && <li className="px-4 py-6 text-center text-muted-foreground">ไม่มี — ดีมาก</li>}
          </ul>
        </section>

        <Bucket title="ไม่ผ่าน" apps={rejected} dot="bg-rose-500" badge="bg-rose-500/15 text-rose-700 dark:text-rose-300" />
        <Bucket title="เงียบหาย" apps={ghosted} dot="bg-zinc-400" badge="bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" />
      </div>
    </div>
  );
}

const Bucket = ({ title, apps, dot, badge }: { title: string; apps: Application[]; dot: string; badge: string }) => (
  <section className="space-y-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
      {title}
      {apps.length > 0 && <span className={cn("rounded-full px-2 text-xs", badge)}>{apps.length}</span>}
    </h2>
    <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border bg-card text-sm">
      {apps.map((a) => (
        <li key={a.id}>
          <Link href={`/a/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <span className={cn("size-2 shrink-0 rounded-full", dot)} />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{a.company}</span> <span className="text-muted-foreground">· {a.position}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{ago(a.lastActivityAt)}</span>
          </Link>
        </li>
      ))}
      {!apps.length && <li className="px-4 py-6 text-center text-muted-foreground">ยังไม่มี</li>}
    </ul>
  </section>
);
