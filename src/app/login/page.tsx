import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, googleEnabled, signIn } from "@/auth";
import LoginForm from "./form";

export default async function Login() {
  if ((await auth())?.user) redirect("/");
  const passwordSet = !!process.env.APP_PASSWORD;

  async function withPassword(_: unknown, f: FormData) {
    "use server";
    try {
      await signIn("credentials", { password: f.get("password"), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) return "รหัสผ่านไม่ถูกต้อง";
      throw e; // the success redirect is thrown too
    }
    return null;
  }
  async function withGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <div className="mx-auto mt-[12vh] w-full max-w-sm space-y-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg */}
        <img src="/icon.svg" alt="" width={40} height={40} />
        <h1 className="text-2xl font-semibold tracking-tight">Samak</h1>
      </div>
      {passwordSet ? (
        <LoginForm action={withPassword} />
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          ยังไม่ได้ตั้งรหัสผ่าน — รัน <code className="rounded bg-muted px-1">npm run setup</code> หรือใส่ <code className="rounded bg-muted px-1">APP_PASSWORD</code> ใน <code className="rounded bg-muted px-1">.env.local</code> แล้วรีสตาร์ท <code className="rounded bg-muted px-1">npm run dev</code>
        </p>
      )}
      {googleEnabled && (
        <form action={withGoogle}>
          <button className="h-10 w-full rounded-full border bg-card text-sm font-medium hover:bg-muted">เข้าด้วย Google</button>
        </form>
      )}
    </div>
  );
}
