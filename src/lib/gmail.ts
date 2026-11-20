import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type RawEmail = { gmailMessageId: string; from: string; subject: string; receivedAt: Date; text: string };

// Gmail search syntax ({a b} = OR). Wide on purpose: the LLM drops what isn't about an application.
// ponytail: tune after the spike (npm run gmail:peek) once real senders/subjects are known
export const JOB_QUERY = [
  "{from:jobthai.com from:jobsdb.com from:jobbkk.com from:jobs-noreply@linkedin.com",
  "subject:สมัคร subject:ใบสมัคร subject:สัมภาษณ์ subject:ตำแหน่ง",
  "subject:application subject:applying subject:applied subject:interview subject:assessment subject:candidate}",
  // drop known newsletters at the source (rules.ts would ignore them anyway, this just saves fetching)
  '-subject:"job alert" -subject:"JOB UPDATE" -subject:"New jobs similar" -subject:"is hiring" -from:jobalerts-noreply@linkedin.com',
].join(" ");

export type GmailCreds = { user: string; pass: string };
export const envCreds = (): GmailCreds | null =>
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } : null;

function connect({ user, pass }: GmailCreds) {
  // Google shows the app password as "abcd efgh ijkl mnop"
  return new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: user.trim(), pass: pass.replace(/\s/g, "") }, logger: false });
}

/** Log in and log out; throws a Thai, actionable message on failure. */
export async function testGmail(creds: GmailCreds) {
  const client = connect(creds);
  try {
    await client.connect();
    await client.logout();
  } catch (e) {
    const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string };
    if (err.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials/i.test(err.responseText ?? err.message ?? ""))
      throw new Error("Gmail ไม่ยอมรับอีเมลหรือรหัสนี้ — ต้องใช้ App Password 16 ตัว (ไม่ใช่รหัส Gmail ปกติ) และต้องเปิด 2-Step Verification ก่อน");
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/.test(err.code ?? "")) throw new Error("ต่อ imap.gmail.com ไม่ได้ — เช็กอินเทอร์เน็ตหรือ firewall");
    throw new Error(`เชื่อม Gmail ไม่สำเร็จ: ${err.responseText ?? err.message ?? String(e)}`);
  }
}

export async function fetchJobEmails(since: Date, creds: GmailCreds | null = envCreds(), query = JOB_QUERY): Promise<RawEmail[]> {
  if (!creds) throw new Error("ยังไม่ได้เชื่อม Gmail — ไปที่หน้า ตั้งค่า");
  const user = creds.user.trim();
  const client = connect(creds);
  await client.connect();
  try {
    // "All Mail" has a localized name (e.g. Thai UI), find it by its special-use flag
    const allMail = (await client.list()).find((b) => b.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(allMail);
    try {
      const uids = await client.search({ since, gmraw: query }, { uid: true });
      if (!uids || !uids.length) return [];
      const out: RawEmail[] = [];
      for await (const m of client.fetch(uids, { source: true, emailId: true, internalDate: true }, { uid: true })) {
        if (!m.source || !m.emailId) continue;
        const p = await simpleParser(m.source);
        if (p.from?.value.some((a) => a.address?.toLowerCase() === user.toLowerCase())) continue; // your own replies in the thread
        out.push({
          gmailMessageId: m.emailId,
          from: p.from?.text ?? "",
          subject: p.subject ?? "",
          receivedAt: p.date ?? new Date(m.internalDate ?? Date.now()),
          text: (p.text || (typeof p.html === "string" ? p.html.replace(/<[^>]+>/g, " ") : "")).replace(/\n{3,}/g, "\n\n").trim(),
        });
      }
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
