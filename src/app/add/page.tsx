"use client";
import { useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { STATUSES, type Application } from "@/db/schema";
import { STATUS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApplication, fetchJobMeta } from "../actions";
import Fields, { Field, select } from "../fields";

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
    const { source, error, ...meta } = m;
    const found = Object.fromEntries(Object.entries(meta).filter(([, v]) => v));
    setPrefill({ ...typed, jobUrl: url, source, ...found });
    setMsg(error ? `${error} — กรอกเองได้เลย` : Object.keys(found).length ? "" : "ไม่เจอข้อมูลในหน้านี้ — กรอกเองได้เลย");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">เพิ่มใบสมัคร</h1>
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">วางลิงก์ประกาศงาน แล้วระบบจะเติมข้อมูลให้</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url && load()} placeholder="https://www.jobthai.com/th/job/..." className="pl-8" />
          </div>
          <Button type="button" onClick={load} disabled={!url || loading}>
            {loading && <Loader2 className="animate-spin" />}ดึงข้อมูล
          </Button>
        </div>
        {msg && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{msg}</p>}
      </div>
      {/* key remounts the form so defaultValues pick up the prefill */}
      <form ref={form} key={JSON.stringify(prefill)} action={createApplication} className="space-y-4 rounded-xl border bg-card p-4">
        <Fields a={prefill} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="สถานะ">
            <select name="status" defaultValue={prefill.status ?? "applied"} className={select}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </Field>
          <Field label="วันที่สมัคร">
            <Input name="appliedAt" type="date" defaultValue={(prefill as { appliedAt?: string }).appliedAt} />
          </Field>
        </div>
        <Button size="lg" className="w-full sm:w-auto">บันทึก</Button>
      </form>
    </div>
  );
}
