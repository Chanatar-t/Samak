import { SOURCES, type Application } from "@/db/schema";

const input = "w-full rounded border px-2 py-1";

export default function Fields({ a }: { a?: Partial<Application> }) {
  return (
    <>
      <label className="block">บริษัท *<input name="company" required defaultValue={a?.company} className={input} /></label>
      <label className="block">ตำแหน่ง *<input name="position" required defaultValue={a?.position} className={input} /></label>
      <label className="block">เว็บที่มา
        <select name="source" defaultValue={a?.source ?? "other"} className={input}>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="block">ลิงก์ประกาศ<input name="jobUrl" type="url" defaultValue={a?.jobUrl ?? ""} className={input} /></label>
      <label className="block">สถานที่<input name="location" defaultValue={a?.location ?? ""} className={input} /></label>
      <label className="block">เงินเดือน<input name="salaryText" defaultValue={a?.salaryText ?? ""} className={input} /></label>
      <label className="block">โน้ต<textarea name="notes" rows={3} defaultValue={a?.notes ?? ""} className={input} /></label>
    </>
  );
}
