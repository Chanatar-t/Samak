import { SOURCES, type Application } from "@/db/schema";
import { SOURCE } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const select =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function Fields({ a }: { a?: Partial<Application> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="ตำแหน่ง *"><Input name="position" required defaultValue={a?.position} /></Field>
      <Field label="บริษัท *"><Input name="company" required defaultValue={a?.company} /></Field>
      <Field label="เว็บที่มา">
        <select name="source" defaultValue={a?.source ?? "other"} className={select}>
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}
        </select>
      </Field>
      <Field label="ลิงก์ประกาศ"><Input name="jobUrl" type="url" defaultValue={a?.jobUrl ?? ""} /></Field>
      <Field label="สถานที่"><Input name="location" defaultValue={a?.location ?? ""} /></Field>
      <Field label="เงินเดือน"><Input name="salaryText" defaultValue={a?.salaryText ?? ""} /></Field>
      <Field label="รายละเอียดงาน (JD)" className="sm:col-span-2">
        <Textarea name="jobDescription" rows={8} defaultValue={a?.jobDescription ?? ""} />
      </Field>
      <Field label="โน้ต" className="sm:col-span-2">
        <Textarea name="notes" rows={3} defaultValue={a?.notes ?? ""} />
      </Field>
    </div>
  );
}
