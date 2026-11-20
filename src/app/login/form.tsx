"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm({ action }: { action: (prev: string | null, f: FormData) => Promise<string | null> }) {
  const [error, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3">
      <Input name="password" type="password" required autoFocus autoComplete="current-password" placeholder="รหัสผ่าน" aria-label="รหัสผ่าน" className="h-10" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" disabled={pending} className="h-10 w-full rounded-full">
        {pending && <Loader2 className="animate-spin" />}เข้าสู่ระบบ
      </Button>
    </form>
  );
}
