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

export async function fetchJobEmails(since: Date, query = JOB_QUERY): Promise<RawEmail[]> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ""); // Google shows it as "abcd efgh ijkl mnop"
  if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not set in .env.local");

  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
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
