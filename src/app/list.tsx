"use client";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, startTransition } from "react";
import { ChevronDown, Clock, Search, X } from "lucide-react";
import { STATUSES, SOURCES, isSilent, type Application } from "@/db/schema";
import { STATUS, SOURCE, avatar, ago } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { setStatus } from "./actions";

type Status = Application["status"];
type A = Application;

const VIEWS = {
  active: { label: "กำลังไป", test: (a: A) => ["applied", "assessment", "interview", "offer"].includes(a.status) },
  followup: { label: "ต้องตาม", test: isSilent },
  interview: { label: "ทดสอบ / สัมภาษณ์", test: (a: A) => ["assessment", "interview"].includes(a.status) },
  offer: { label: "Offer", test: (a: A) => a.status === "offer" },
  wishlist: { label: "อยากสมัคร", test: (a: A) => a.status === "wishlist" },
  closed: { label: "ปิดแล้ว", test: (a: A) => ["rejected", "ghosted", "withdrawn"].includes(a.status) },
  all: { label: "ทั้งหมด", test: () => true },
};
type View = keyof typeof VIEWS;

const SORTS = {
  recent: { label: "อัปเดตล่าสุด", fn: (x: A, y: A) => +new Date(y.lastActivityAt) - +new Date(x.lastActivityAt) },
  applied: { label: "วันที่สมัคร", fn: (x: A, y: A) => +new Date(y.appliedAt ?? 0) - +new Date(x.appliedAt ?? 0) },
  company: { label: "บริษัท ก–ฮ", fn: (x: A, y: A) => x.company.localeCompare(y.company, "th") },
};
type Sort = keyof typeof SORTS;

const PIPELINE: Status[] = ["applied", "assessment", "interview", "offer", "rejected", "ghosted"];
const date = (d: Date | null) => (d ? new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "–");
const pick = <T extends string>(v: string | undefined, keys: Record<T, unknown>, d: T) => (v && v in keys ? (v as T) : d);

export type ListParams = { view?: string; q?: string; src?: string; sort?: string };

export default function List({ apps, params }: { apps: A[]; params: ListParams }) {
  const [view, setView] = useState<View>(pick(params.view, VIEWS, "active"));
  const [q, setQ] = useState(params.q ?? "");
  const [src, setSrc] = useState(params.src ?? "");
  const [sort, setSort] = useState<Sort>(pick(params.sort, SORTS, "recent"));
  const search = useRef<HTMLInputElement>(null);
  const [items, move] = useOptimistic(apps, (s, { id, status }: { id: string; status: Status }) =>
    s.map((a) => (a.id === id ? { ...a, status, lastActivityAt: new Date() } : a)),
  );

  // filters live in the URL so back from a detail page lands on the same list
  useEffect(() => {
    const p = new URLSearchParams(Object.entries({ view, q, src, sort }).filter(([k, v]) => v && !(k === "view" && v === "active") && !(k === "sort" && v === "recent")));
    const url = p.size ? `/?${p}` : "/";
    window.history.replaceState(null, "", url);
    try { sessionStorage.setItem("list-url", url); } catch {}
  }, [view, q, src, sort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!apps.length)
    return (
      <div className="mx-auto mt-24 max-w-sm text-center">
        <p className="text-2xl font-semibold tracking-tight">ยังไม่มีใบสมัคร</p>
        <p className="mt-2 text-sm text-muted-foreground">เพิ่มใบแรกเอง หรือ sync อีเมลในหน้า Inbox</p>
        <Link href="/add" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          เพิ่มใบสมัคร
        </Link>
      </div>
    );

  const needle = q.trim().toLowerCase();
  const base = items.filter(
    (a) =>
      (!src || a.source === src) &&
      (!needle || [a.company, a.position, a.location, ...a.companyAliases].some((s) => s?.toLowerCase().includes(needle))),
  );
  const shown = base.filter(VIEWS[view].test).sort(SORTS[sort].fn);
  const sent = items.filter((a) => a.status !== "wishlist");

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-end gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">ใบสมัคร</h1>
          <span className="pb-1 text-sm text-muted-foreground tabular-nums">ส่งไปแล้ว {sent.length} ที่</span>
        </div>
        {/* pipeline: one glance instead of eight kanban columns */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-6">
          {PIPELINE.map((s) => {
            const n = items.filter((a) => a.status === s).length;
            return (
              <div key={s} className="bg-card px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", STATUS[s].dot)} />
                  {STATUS[s].label}
                </div>
                <div className={cn("mt-0.5 text-2xl font-semibold tabular-nums", !n && "text-muted-foreground/40")}>{n}</div>
              </div>
            );
          })}
        </div>
      </header>

      <div className="sticky top-14 z-10 -mx-4 space-y-3 bg-background/90 px-4 py-3 backdrop-blur lg:top-0">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-48 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={search}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาบริษัท ตำแหน่ง สถานที่"
              aria-label="ค้นหา"
              className="h-9 w-full rounded-full border border-input bg-card pr-10 pl-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 text-[10px] text-muted-foreground sm:block">/</kbd>
          </label>
          <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="เว็บที่มา" className="h-9 rounded-full border border-input bg-card px-3 text-sm">
            <option value="">ทุกเว็บ</option>
            {SOURCES.map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="เรียงตาม" className="h-9 rounded-full border border-input bg-card px-3 text-sm">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4">
          {(Object.keys(VIEWS) as View[]).map((v) => {
            const n = base.filter(VIEWS[v].test).length;
            const on = v === view;
            return (
              <button
                key={v}
                role="tab"
                aria-selected={on}
                onClick={() => setView(v)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {VIEWS[v].label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    v === "followup" && n ? "bg-highlight text-highlight-foreground" : on ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_6rem_5rem_8rem] gap-4 border-b px-4 py-2 text-xs text-muted-foreground md:grid">
            <span>ตำแหน่ง / บริษัท</span>
            <span>สถานะ</span>
            <span>เว็บ</span>
            <span>สมัคร</span>
            <span className="text-right">ล่าสุด</span>
          </div>
          <ul className="divide-y">
            {shown.map((a) => {
              const av = avatar(a.company);
              const silent = isSilent(a);
              return (
                <li
                  key={a.id}
                  className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_9.5rem_6rem_5rem_8rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white", av.color)}>{av.initial}</span>
                    <div className="min-w-0">
                      <Link href={`/a/${a.id}`} className="block truncate font-medium after:absolute after:inset-0">
                        {a.position}
                      </Link>
                      <div className="truncate text-sm text-muted-foreground">
                        {a.company}
                        {a.location && <span className="hidden lg:inline"> · {a.location}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="relative z-[1] w-full max-w-[9.5rem]">
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 opacity-70" />
                  <select
                    value={a.status}
                    title="กดเพื่อเปลี่ยนสถานะ"
                    aria-label={`เปลี่ยนสถานะ ${a.company}`}
                    onChange={(e) => {
                      const status = e.target.value as Status;
                      startTransition(async () => {
                        move({ id: a.id, status });
                        await setStatus(a.id, status);
                      });
                    }}
                    className={cn("h-7 w-full cursor-pointer appearance-none rounded-full border-0 pr-7 pl-3 text-xs font-medium ring-current/20 transition-shadow hover:ring-2", STATUS[a.status].chip)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                  </select>
                  </span>
                  <span className="hidden text-sm text-muted-foreground md:block">{SOURCE[a.source]}</span>
                  <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{date(a.appliedAt)}</span>
                  <span className="col-start-1 flex items-center gap-1.5 pl-12 text-xs whitespace-nowrap text-muted-foreground md:col-start-auto md:justify-end md:pl-0 md:text-sm">
                    <span className="md:hidden">{SOURCE[a.source]} ·</span>
                    {silent ? (
                      <span title="เงียบเกิน 14 วัน ควรตาม" className="inline-flex items-center gap-1 rounded-full bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
                        <Clock className="size-3" />
                        {ago(a.lastActivityAt)}
                      </span>
                    ) : (
                      ago(a.lastActivityAt)
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          ไม่มีใบสมัครในมุมมองนี้
          {(q || src) && (
            <button onClick={() => { setQ(""); setSrc(""); }} className="mx-auto mt-3 flex items-center gap-1 rounded-full border px-3 py-1 text-foreground hover:bg-muted">
              <X className="size-3.5" /> ล้างตัวกรอง
            </button>
          )}
        </div>
      )}
    </div>
  );
}
