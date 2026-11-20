"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { db, settings } from "@/db";
import { testGmail } from "@/lib/gmail";
import { encrypt } from "@/lib/secret";
import { syncEmails } from "@/lib/sync";

export type ConnectState = { ok: boolean; msg: string } | null;

/** Test the login first; only a working app password gets saved, then run the first sync. */
export async function connectGmail(_: ConnectState, f: FormData): Promise<ConnectState> {
  const userId = await requireUser();
  const user = String(f.get("gmailUser") ?? "").trim();
  const pass = String(f.get("gmailAppPassword") ?? "").replace(/\s/g, "");
  if (!/^[^@\s]+@[^@\s]+$/.test(user)) return { ok: false, msg: "อีเมลไม่ถูกต้อง" };
  if (pass.length !== 16) return { ok: false, msg: `App Password ต้องมี 16 ตัวอักษร (ที่ใส่มา ${pass.length} ตัว) — ไม่ใช่รหัส Gmail ปกติ` };
  try {
    await testGmail({ user, pass });
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }
  const row = { gmailUser: user, gmailAppPassword: encrypt(pass) };
  await db.insert(settings).values({ userId, ...row }).onConflictDoUpdate({ target: settings.userId, set: row });
  try {
    const r = await syncEmails(userId);
    revalidatePath("/", "layout");
    return { ok: true, msg: `เชื่อมสำเร็จ · sync ครั้งแรกได้อีเมล ${r.fetched} ฉบับ` };
  } catch (e) {
    revalidatePath("/", "layout");
    return { ok: true, msg: `เชื่อมสำเร็จ แต่ sync ครั้งแรกล้มเหลว: ${e instanceof Error ? e.message : e}` };
  }
}

export async function disconnectGmail() {
  const userId = await requireUser();
  await db.update(settings).set({ gmailUser: null, gmailAppPassword: null }).where(eq(settings.userId, userId));
  revalidatePath("/settings");
}
