"use client";
import { useActionState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "../fields";
import { connectGmail } from "./actions";

export default function ConnectForm({ defaultUser }: { defaultUser: string }) {
  const [state, run, pending] = useActionState(connectGmail, null);
  return (
    <form action={run} className="space-y-4">
      <Field label="อีเมล Gmail">
        <Input name="gmailUser" type="email" required defaultValue={defaultUser} placeholder="you@gmail.com" autoComplete="username" />
      </Field>
      <Field label="App Password (16 ตัว)">
        <Input name="gmailAppPassword" type="password" required placeholder="abcd efgh ijkl mnop" autoComplete="off" className="font-mono" />
      </Field>
      {state && (
        <p className={`flex items-start gap-2 text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>
          {state.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          {state.msg}
        </p>
      )}
      <Button size="lg" disabled={pending} className="rounded-full px-5">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "กำลังทดสอบและ sync…" : "ทดสอบและเชื่อมต่อ"}
      </Button>
    </form>
  );
}
