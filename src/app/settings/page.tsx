import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/auth";
import { db, settings } from "@/db";
import { envCreds } from "@/lib/gmail";
import { ago } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { disconnectGmail } from "./actions";
import ConnectForm from "./connect-form";

const STEPS = [
  { text: "เปิด 2-Step Verification ของบัญชี Google (ถ้ายังไม่ได้เปิด)", href: "https://myaccount.google.com/signinoptions/twosv" },
  { text: "สร้าง App Password ตั้งชื่ออะไรก็ได้ เช่น job-tracker แล้วคัดลอกรหัส 16 ตัว", href: "https://myaccount.google.com/apppasswords" },
  { text: "วางอีเมลกับรหัสด้านล่าง แล้วกด ทดสอบและเชื่อมต่อ" },
];

export default async function Settings() {
  const userId = await requireUser();
  const [s] = await db.select().from(settings).where(eq(settings.userId, userId));
  const env = envCreds();
  const connected = s?.gmailUser && s.gmailAppPassword ? s.gmailUser : null;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">ตั้งค่า</h1>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">เชื่อม Gmail</h2>
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
          <Status label="สถานะ">
            {connected ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">เชื่อมแล้ว · {connected}</span>
            ) : env ? (
              <span>ใช้ค่าจาก .env.local · {env.user}</span>
            ) : (
              <span className="font-medium text-destructive">ยังไม่ได้เชื่อม</span>
            )}
          </Status>
          <Status label="sync ล่าสุด">{s?.lastSyncAt ? ago(s.lastSyncAt) + " · " + s.lastSyncAt.toLocaleString("th-TH", { timeStyle: "short", dateStyle: "short" }) : "ยังไม่เคย"}</Status>
          {s?.lastSyncError && <Status label="ผิดพลาดล่าสุด"><span className="text-destructive">{s.lastSyncError}</span></Status>}
          {connected && (
            <form action={disconnectGmail} className="pt-2">
              <Button variant="ghost" size="sm" className="text-destructive">ยกเลิกการเชื่อมต่อ</Button>
            </form>
          )}
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-5">
          <ol className="space-y-3 text-sm">
            {STEPS.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-highlight text-xs font-semibold text-highlight-foreground">{i + 1}</span>
                <span className="pt-0.5">
                  {st.text}
                  {st.href && (
                    <a href={st.href} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-medium underline underline-offset-4">
                      เปิดหน้านี้ <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <ConnectForm defaultUser={connected ?? env?.user ?? ""} />
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">ทำไมต้องใช้ App Password · ข้อจำกัด</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>แอปอ่านเมลผ่าน IMAP ด้วยรหัสเฉพาะแอป ไม่ต้องสร้าง project ใน Google Cloud</li>
              <li>รหัสถูกเข้ารหัสก่อนเก็บใน DB ของเครื่องคุณ และอ่านอย่างเดียว ไม่ส่งเมล ไม่ลบเมล</li>
              <li>บัญชีที่ไม่เปิด 2-Step, บัญชีองค์กรหรือมหาวิทยาลัยบางแห่ง และบัญชีที่เปิด Advanced Protection สร้าง App Password ไม่ได้</li>
              <li>ถ้าเปลี่ยนรหัส Google หรือลบ App Password ทิ้ง ต้องเชื่อมใหม่ที่หน้านี้</li>
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}

const Status = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0">{children}</span>
  </div>
);
