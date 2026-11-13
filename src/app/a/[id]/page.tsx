import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPin, Trash2, Wallet } from "lucide-react";
import { requireUser } from "@/auth";
import { db, applications, events, STATUSES } from "@/db";
import { STATUS, SOURCE, avatar } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addNote, deleteApplication, setStatus, updateApplication } from "../../actions";
import Fields, { select } from "../../fields";

type Status = (typeof STATUSES)[number];
const fmt = (d: Date) => d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default async function Detail({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const userId = await requireUser();
  const [a] = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!a) notFound();
  const timeline = await db.select().from(events).where(eq(events.applicationId, id)).orderBy(desc(events.occurredAt));
  const av = avatar(a.company);

  async function changeStatus(f: FormData) {
    "use server";
    await setStatus(id, f.get("status") as Status);
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Board
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-white", av.color)}>{av.initial}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{a.position}</h1>
          <p className="text-muted-foreground">{a.company}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[a.status].chip)}>{STATUS[a.status].label}</span>
            <span>{SOURCE[a.source]}</span>
            {a.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{a.location}</span>}
            {a.salaryText && <span className="flex items-center gap-1"><Wallet className="size-3.5" />{a.salaryText}</span>}
            {a.jobUrl && (
              <a href={a.jobUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-foreground underline-offset-4 hover:underline">
                <ExternalLink className="size-3.5" />ประกาศงาน
              </a>
            )}
          </div>
        </div>
        <form action={changeStatus} className="flex gap-2">
          <select name="status" defaultValue={a.status} className={cn(select, "w-36")}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <Button variant="outline">เปลี่ยน</Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={updateApplication.bind(null, id)} className="space-y-4 rounded-xl border bg-card p-4">
          <Fields a={a} />
          <div className="flex items-center justify-between">
            <Button>บันทึก</Button>
            <Button formAction={deleteApplication.bind(null, id)} variant="ghost" className="text-destructive">
              <Trash2 />ลบใบสมัคร
            </Button>
          </div>
        </form>

        <aside className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="font-medium">Timeline</h2>
          <form action={addNote.bind(null, id)} className="space-y-2">
            <Input name="summary" placeholder="เพิ่มโน้ต / เหตุการณ์" />
            <div className="flex gap-2">
              <Input name="scheduledAt" type="datetime-local" title="นัดหมาย (ถ้ามี)" className="text-muted-foreground" />
              <Button variant="outline">เพิ่ม</Button>
            </div>
          </form>
          <ol className="relative space-y-4 border-l pl-5">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-muted-foreground" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {fmt(e.occurredAt)}
                  {e.emailId && <Mail className="size-3" aria-label="จากอีเมล" />}
                </div>
                <div className="text-sm">{e.summary}</div>
                {e.scheduledAt && <div className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">นัด {fmt(e.scheduledAt)}</div>}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
