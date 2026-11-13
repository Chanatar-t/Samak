import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth";
import { db, applications, events, STATUSES } from "@/db";
import { addNote, deleteApplication, setStatus, updateApplication } from "../../actions";
import Fields from "../../fields";

type Status = (typeof STATUSES)[number];

export default async function Detail({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const userId = await requireUser();
  const [a] = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!a) notFound();
  const timeline = await db.select().from(events).where(eq(events.applicationId, id)).orderBy(desc(events.occurredAt));

  async function changeStatus(f: FormData) {
    "use server";
    await setStatus(id, f.get("status") as Status);
  }

  return (
    <div className="grid max-w-4xl gap-8 text-sm md:grid-cols-2">
      <div className="space-y-3">
        <h1 className="text-lg font-semibold">{a.company} — {a.position}</h1>
        {a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">เปิดประกาศ</a>}
        <form action={changeStatus} className="flex gap-2">
          <select name="status" defaultValue={a.status} className="rounded border px-2 py-1">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="rounded border px-3">เปลี่ยนสถานะ</button>
        </form>
        <form action={updateApplication.bind(null, id)} className="space-y-3">
          <Fields a={a} />
          <button className="rounded bg-neutral-900 px-4 py-2 text-white">บันทึก</button>
        </form>
        <form action={deleteApplication.bind(null, id)}>
          <button className="text-red-600">ลบใบสมัคร</button>
        </form>
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold">Timeline</h2>
        <form action={addNote.bind(null, id)} className="space-y-2">
          <input name="summary" placeholder="เพิ่มโน้ต / เหตุการณ์" className="w-full rounded border px-2 py-1" />
          <label className="block text-neutral-500">นัดหมาย (ถ้ามี)<input name="scheduledAt" type="datetime-local" className="w-full rounded border px-2 py-1" /></label>
          <button className="rounded border px-3 py-1">เพิ่ม</button>
        </form>
        <ol className="space-y-2 border-l pl-4">
          {timeline.map((e) => (
            <li key={e.id}>
              <div className="text-xs text-neutral-400">{e.occurredAt.toLocaleString("th-TH")} · {e.type}</div>
              <div>{e.summary}</div>
              {e.scheduledAt && <div className="text-xs text-amber-700">นัด: {e.scheduledAt.toLocaleString("th-TH")}</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
