"use client";
import { useState } from "react";
import { STATUSES, type Application } from "@/db/schema";
import { createApplication, fetchJobMeta } from "../actions";
import Fields from "../fields";

export default function Add() {
  const [url, setUrl] = useState("");
  const [prefill, setPrefill] = useState<Partial<Application>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const m = await fetchJobMeta(url).catch(() => null);
    setLoading(false);
    if (m) setPrefill({ jobUrl: url, position: m.title, company: m.siteName, source: m.source });
  }

  return (
    <div className="max-w-lg space-y-4 text-sm">
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="วางลิงก์ประกาศงาน" className="flex-1 rounded border px-2 py-1" />
        <button type="button" onClick={load} disabled={!url || loading} className="rounded bg-neutral-900 px-3 text-white disabled:opacity-50">
          {loading ? "..." : "ดึงข้อมูล"}
        </button>
      </div>
      {/* key remounts the form so defaultValues pick up the prefill */}
      <form key={JSON.stringify(prefill)} action={createApplication} className="space-y-3">
        <Fields a={prefill} />
        <label className="block">สถานะ
          <select name="status" defaultValue="applied" className="w-full rounded border px-2 py-1">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">วันที่สมัคร<input name="appliedAt" type="date" className="w-full rounded border px-2 py-1" /></label>
        <button className="rounded bg-neutral-900 px-4 py-2 text-white">บันทึก</button>
      </form>
    </div>
  );
}
