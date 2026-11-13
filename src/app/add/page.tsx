"use client";
import { useRef, useState } from "react";
import { STATUSES, type Application } from "@/db/schema";
import { createApplication, fetchJobMeta } from "../actions";
import Fields from "../fields";

export default function Add() {
  const form = useRef<HTMLFormElement>(null);
  const [url, setUrl] = useState("");
  const [prefill, setPrefill] = useState<Partial<Application>>({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMsg("");
    const m = await fetchJobMeta(url).catch(() => null);
    setLoading(false);
    if (!m) return setMsg("ลิงก์ไม่ถูกต้อง");
    // keep what's already typed; only fill fields that came back non-empty
    const typed = Object.fromEntries([...new FormData(form.current!)].filter(([, v]) => v !== "")) as Partial<Application>;
    const found = Object.fromEntries(Object.entries({ position: m.position, company: m.company, location: m.location }).filter(([, v]) => v));
    setPrefill({ ...typed, jobUrl: url, source: m.source, ...found });
    setMsg(m.error ? `${m.error} — กรอกเองได้เลย` : Object.keys(found).length ? "" : "ไม่เจอข้อมูลในหน้านี้ — กรอกเองได้เลย");
  }

  return (
    <div className="max-w-lg space-y-4 text-sm">
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="วางลิงก์ประกาศงาน" className="flex-1 rounded border px-2 py-1" />
        <button type="button" onClick={load} disabled={!url || loading} className="rounded bg-neutral-900 px-3 text-white disabled:opacity-50">
          {loading ? "..." : "ดึงข้อมูล"}
        </button>
      </div>
      {msg && <p className="text-amber-700">{msg}</p>}
      {/* key remounts the form so defaultValues pick up the prefill */}
      <form ref={form} key={JSON.stringify(prefill)} action={createApplication} className="space-y-3">
        <Fields a={prefill} />
        <label className="block">สถานะ
          <select name="status" defaultValue={prefill.status ?? "applied"} className="w-full rounded border px-2 py-1">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">วันที่สมัคร<input name="appliedAt" type="date" defaultValue={(prefill as { appliedAt?: string }).appliedAt} className="w-full rounded border px-2 py-1" /></label>
        <button className="rounded bg-neutral-900 px-4 py-2 text-white">บันทึก</button>
      </form>
    </div>
  );
}
