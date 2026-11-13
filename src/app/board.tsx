"use client";
import Link from "next/link";
import { useOptimistic, startTransition, useState } from "react";
import { Clock } from "lucide-react";
import { STATUSES, SOURCES, isSilent, type Application } from "@/db/schema";
import { STATUS, SOURCE, avatar, ago } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { setStatus } from "./actions";

type Status = Application["status"];

// ponytail: native HTML drag & drop instead of dnd-kit; no touch drag, change status on the detail page from mobile
export default function Board({ apps }: { apps: Application[] }) {
  const [filter, setFilter] = useState("");
  const [over, setOver] = useState<Status | null>(null);
  const [items, move] = useOptimistic(apps, (s, { id, status }: { id: string; status: Status }) =>
    s.map((a) => (a.id === id ? { ...a, status } : a)),
  );
  const shown = filter ? items.filter((a) => a.source === filter) : items;

  if (!apps.length)
    return (
      <div className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-lg font-medium">ยังไม่มีใบสมัคร</p>
        <p className="mt-1 text-sm text-muted-foreground">เพิ่มใบแรกเอง หรือกด sync อีเมลในหน้า Inbox</p>
        <Link href="/add" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          เพิ่มใบสมัคร
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {["", ...SOURCES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === s ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {s ? SOURCE[s as keyof typeof SOURCE] : "ทั้งหมด"}
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
        {STATUSES.map((status) => {
          const col = shown.filter((a) => a.status === status);
          return (
            <section
              key={status}
              onDragOver={(e) => { e.preventDefault(); setOver(status); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                startTransition(async () => {
                  move({ id, status });
                  await setStatus(id, status);
                });
              }}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl bg-muted/60 p-2 transition-colors",
                over === status && "bg-muted ring-2 ring-primary/20",
              )}
            >
              <h2 className="mb-2 flex items-center gap-2 px-1.5 pt-1 text-sm font-medium">
                <span className={cn("size-2 rounded-full", STATUS[status].dot)} />
                {STATUS[status].label}
                <span className="ml-auto text-xs text-muted-foreground">{col.length}</span>
              </h2>
              <div className="flex min-h-16 flex-col gap-2">
                {col.map((a) => {
                  const av = avatar(a.company);
                  return (
                    <Link
                      key={a.id}
                      href={`/a/${a.id}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                      className="group rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white", av.color)}>
                          {av.initial}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{a.position}</div>
                          <div className="truncate text-xs text-muted-foreground">{a.company}</div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">{SOURCE[a.source]}</span>
                        {isSilent(a) && (
                          <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                            <Clock className="size-3" /> เงียบ
                          </span>
                        )}
                        <span className="ml-auto">{ago(a.lastActivityAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
