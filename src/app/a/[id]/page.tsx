import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, Mail, MapPin, Trash2, Wallet } from "lucide-react";
import { requireUser } from "@/auth";
import { db, applications, events, isSilent } from "@/db";
import { STATUS, SOURCE, avatar, ago } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addNote, deleteApplication, updateApplication } from "../../actions";
import Fields from "../../fields";
import { Back, StatusSelect } from "./client";

const BOARD_SITE: Record<string, string> = { jobsdb: "th.jobsdb.com", jobthai: "jobthai.com", jobbkk: "jobbkk.com", linkedin: "linkedin.com/jobs" };
const postSearch = (a: { company: string; position: string; source: string }) => {
  const site = BOARD_SITE[a.source];
  return `https://www.google.com/search?q=${encodeURIComponent(`"${a.position}" ${a.company}${site ? ` site:${site}` : ""}`)}`;
};

const fmt = (d: Date) => d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
const STEPS = ["applied", "assessment", "interview", "offer"] as const;

export default async function Detail({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const userId = await requireUser();
  const [a] = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!a) notFound();
  const timeline = await db.select().from(events).where(eq(events.applicationId, id)).orderBy(desc(events.occurredAt));
  const av = avatar(a.company);
  const step = STEPS.indexOf(a.status as (typeof STEPS)[number]);
  const closed = ["rejected", "ghosted", "withdrawn"].includes(a.status);
  const upcoming = timeline.filter((e) => e.scheduledAt && e.scheduledAt > new Date()).sort((x, y) => +x.scheduledAt! - +y.scheduledAt!)[0];

  return (
    <div className="space-y-8">
      <Back />

      <header className="space-y-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-xl text-xl font-semibold text-white", av.color)}>{av.initial}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{a.position}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{a.company}</p>
          </div>
          <StatusSelect id={id} status={a.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Meta>{SOURCE[a.source]}</Meta>
          {a.location && <Meta><MapPin className="size-3.5" />{a.location}</Meta>}
          {a.salaryText && <Meta><Wallet className="size-3.5" />{a.salaryText}</Meta>}
          {a.appliedAt && <Meta>สมัคร {a.appliedAt.toLocaleDateString("th-TH", { dateStyle: "medium" })}</Meta>}
          {isSilent(a) && <Meta className="bg-highlight text-highlight-foreground">เงียบ {ago(a.lastActivityAt)} · ควรตาม</Meta>}
          {/* board emails only carry tracked footer links, never the post, so cards made from mail have no jobUrl: fall back to a search */}
          <a href={a.jobUrl ?? postSearch(a)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium underline-offset-4 hover:underline">
            <ExternalLink className="size-3.5" />{a.jobUrl ? "ดูประกาศงาน" : "ค้นหาประกาศงาน"}
          </a>
        </div>

        {!closed && a.status !== "wishlist" && (
          <ol className="grid grid-cols-4 gap-1.5" aria-label="ความคืบหน้า">
            {STEPS.map((s, i) => (
              <li key={s} className="space-y-1.5">
                <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                <div className={cn("text-xs", i === step ? "font-medium" : "text-muted-foreground")}>{STATUS[s].label}</div>
              </li>
            ))}
          </ol>
        )}

        {upcoming && (
          <div className="flex items-center gap-3 rounded-xl bg-highlight/60 px-4 py-3 text-highlight-foreground">
            <CalendarClock className="size-5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">{fmt(upcoming.scheduledAt!)}</div>
              <div>{upcoming.summary}</div>
            </div>
          </div>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Timeline</h2>
          <form action={addNote.bind(null, id)} className="space-y-2 rounded-xl border bg-card p-3">
            <Input name="summary" placeholder="เพิ่มโน้ต เช่น โทรตาม HR แล้ว" className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
            <div className="flex items-center gap-2 border-t pt-2">
              <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-4" />
                <input name="scheduledAt" type="datetime-local" aria-label="นัดหมาย (ถ้ามี)" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
              </label>
              <Button size="sm">เพิ่ม</Button>
            </div>
          </form>
          <ol className="relative space-y-5 border-l pl-5">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-foreground/60" />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {fmt(e.occurredAt)}
                  {e.emailId && <Mail className="size-3" aria-label="จากอีเมล" />}
                </div>
                <div className="mt-0.5 text-sm">{e.summary}</div>
                {e.scheduledAt && <div className="mt-1 inline-block rounded-full bg-highlight px-2 text-xs font-medium text-highlight-foreground">นัด {fmt(e.scheduledAt)}</div>}
              </li>
            ))}
            {!timeline.length && <li className="text-sm text-muted-foreground">ยังไม่มีเหตุการณ์</li>}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">ข้อมูลใบสมัคร</h2>
          <form action={updateApplication.bind(null, id)} className="space-y-4 rounded-xl border bg-card p-4">
            <Fields a={a} />
            <div className="flex items-center justify-between border-t pt-4">
              <Button>บันทึก</Button>
              <Button formAction={deleteApplication.bind(null, id)} variant="ghost" className="text-destructive">
                <Trash2 />ลบใบสมัคร
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

const Meta = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground", className)}>{children}</span>
);
