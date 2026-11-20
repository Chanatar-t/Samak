"use client";
import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type Opt = { id: string; label: string };

// ponytail: native <datalist> for type-to-search; swap for a real combobox only if Safari/mobile filtering bites
export default function Attach({ apps, hits, action }: { apps: Opt[]; hits: Opt[]; action: (f: FormData) => Promise<void> }) {
  const list = useId();
  const [text, setText] = useState(hits.length === 1 ? hits[0].label : "");
  const id = apps.find((a) => a.label === text)?.id ?? "";

  return (
    <div className="min-w-0 flex-1 space-y-2">
      {hits.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">น่าจะเป็น:</span>
          {hits.map((h) => (
            <button key={h.id} type="button" onClick={() => setText(h.label)} className="rounded-full border px-2.5 py-1 hover:bg-muted">
              {h.label}
            </button>
          ))}
        </div>
      )}
      <form action={action} className="flex min-w-0 gap-2">
        <input type="hidden" name="applicationId" value={id} />
        <label className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            list={list}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="พิมพ์ชื่อบริษัทหรือตำแหน่งเพื่อผูก…"
            aria-label="ผูกกับใบสมัคร"
            className="h-8 w-full rounded-lg border border-input bg-card pr-2 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </label>
        <datalist id={list}>
          {apps.map((a) => <option key={a.id} value={a.label} />)}
        </datalist>
        <Button variant="outline" disabled={!id}>ผูก</Button>
      </form>
    </div>
  );
}
