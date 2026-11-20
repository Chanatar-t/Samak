"use client";
import { useActionState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncNow } from "./actions";

export default function SyncButton() {
  const [r, run, pending] = useActionState(syncNow, null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={run}>
        <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sync อีเมล</Button>
      </form>
      {pending && <span className="text-sm text-muted-foreground">กำลังอ่านอีเมล… ครั้งแรกอาจใช้เวลาเป็นนาที</span>}
      {r && "error" in r && <span className="text-sm text-destructive">{r.error}</span>}
      {r && !("error" in r) && (
        <span className="text-sm text-muted-foreground">
          อีเมลใหม่ {r.fetched} · สร้างใบใหม่ {r.created} · อัปเดต {r.updated} · รอตรวจ {r.review} · ไม่เกี่ยว {r.ignored}{r.ghosted ? ` · ย้ายไปเงียบหาย ${r.ghosted}` : ""}
        </span>
      )}
    </div>
  );
}
