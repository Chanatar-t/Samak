"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, startTransition } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { STATUSES, type Application } from "@/db/schema";
import { STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { setStatus } from "../../actions";

type Status = Application["status"];

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [s, set] = useOptimistic(status);
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">เปลี่ยนสถานะ</span>
      <span className="relative">
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-70" />
    <select
      value={s}
      onChange={(e) => {
        const next = e.target.value as Status;
        startTransition(async () => {
          set(next);
          await setStatus(id, next);
        });
      }}
      className={cn("h-9 cursor-pointer appearance-none rounded-full border-0 pr-9 pl-4 text-sm font-medium ring-current/20 transition-shadow hover:ring-2", STATUS[s].chip)}
    >
      {STATUSES.map((x) => <option key={x} value={x}>{STATUS[x].label}</option>)}
    </select>
      </span>
    </label>
  );
}

// back to the list with its filters intact (list.tsx saves its URL in sessionStorage)
export function Back() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onClick={(e) => {
        let url: string | null = null;
        try { url = sessionStorage.getItem("list-url"); } catch {}
        if (url) {
          e.preventDefault();
          router.push(url);
        }
      }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> ใบสมัครทั้งหมด
    </Link>
  );
}
