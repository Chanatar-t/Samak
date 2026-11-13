import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/auth";
import { db, applications, isSilent } from "@/db";

const REPLIED = ["assessment", "interview", "offer", "rejected"];

export default async function Dashboard() {
  const userId = await requireUser();
  // ponytail: aggregates in JS, fine for a few hundred rows; move to SQL group by if it grows
  const apps = (await db.select().from(applications).where(eq(applications.userId, userId))).filter((a) => a.status !== "wishlist");
  const replied = apps.filter((a) => REPLIED.includes(a.status)).length;
  const silent = apps.filter(isSilent);
  const bySource = Object.entries(Object.groupBy(apps, (a) => a.source))
    .map(([s, l]) => ({ s, n: l!.length, r: l!.filter((a) => REPLIED.includes(a.status)).length }))
    .sort((x, y) => y.n - x.n);

  return (
    <div className="max-w-2xl space-y-6 text-sm">
      <div className="flex gap-6">
        <Stat label="สมัครแล้ว" value={apps.length} />
        <Stat label="อัตราตอบกลับ" value={apps.length ? `${Math.round((replied / apps.length) * 100)}%` : "–"} />
        <Stat label="เงียบเกิน 14 วัน" value={silent.length} />
      </div>
      <table className="w-full">
        <thead><tr className="text-left text-neutral-500"><th>เว็บ</th><th className="text-right">สมัคร</th><th className="text-right">ตอบกลับ</th></tr></thead>
        <tbody>{bySource.map((x) => <tr key={x.s} className="border-t"><td>{x.s}</td><td className="text-right">{x.n}</td><td className="text-right">{x.r}</td></tr>)}</tbody>
      </table>
      {silent.length > 0 && (
        <ul className="list-disc pl-5">{silent.map((a) => <li key={a.id}><Link href={`/a/${a.id}`} className="underline">{a.company} — {a.position}</Link></li>)}</ul>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div><div className="text-2xl font-semibold">{value}</div><div className="text-neutral-500">{label}</div></div>
);
