"use client";
import Link from "next/link";
import { useOptimistic, startTransition, useState } from "react";
import { STATUSES, SOURCES, isSilent, type Application } from "@/db/schema";
import { setStatus } from "./actions";

// ponytail: native HTML drag & drop instead of dnd-kit; no touch drag, change status on the detail page from mobile
export default function Board({ apps }: { apps: Application[] }) {
  const [filter, setFilter] = useState("");
  const [items, move] = useOptimistic(apps, (s, { id, status }: { id: string; status: Application["status"] }) =>
    s.map((a) => (a.id === id ? { ...a, status } : a)),
  );
  const shown = filter ? items.filter((a) => a.source === filter) : items;

  return (
    <div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-3 rounded border px-2 py-1 text-sm">
        <option value="">ทุกเว็บ</option>
        {SOURCES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const col = shown.filter((a) => a.status === status);
          return (
            <section
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                startTransition(async () => {
                  move({ id, status });
                  await setStatus(id, status);
                });
              }}
              className="w-60 shrink-0 rounded-lg bg-neutral-100 p-2"
            >
              <h2 className="mb-2 px-1 text-sm font-semibold">
                {status} <span className="text-neutral-400">{col.length}</span>
              </h2>
              {col.map((a) => {
                const silent = isSilent(a);
                return (
                  <Link
                    key={a.id}
                    href={`/a/${a.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                    className="mb-2 block rounded-md border bg-white p-2 text-sm shadow-sm"
                  >
                    <div className="font-medium">{a.company}</div>
                    <div className="text-neutral-600">{a.position}</div>
                    <div className="mt-1 flex gap-1 text-xs text-neutral-400">
                      {a.source}
                      {silent && <span className="rounded bg-amber-100 px-1 text-amber-700">เงียบ</span>}
                    </div>
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
