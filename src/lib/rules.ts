// Free, rule-based email reader for job-board templates (JobsDB, JobThai, JobBKK, LinkedIn, Workable).
// Same output shape as the LLM extractor so sync.ts doesn't care which one ran.
// Tests: node --test src/lib/rules.test.ts
import type { RawEmail } from "./gmail.ts";

type Kind = "application_confirmation" | "viewed" | "assessment" | "interview" | "offer" | "rejection" | "other_update" | "not_job_application";
type Source = "jobthai" | "jobsdb" | "jobbkk" | "linkedin" | "company_site" | "referral" | "other";
export type Classified = {
  kind: Kind;
  company: string | null;
  position: string | null;
  source: Source;
  scheduledAt: string | null;
  summary: string;
  confidence: number;
};

const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const out = (kind: Kind, source: Source, company: string | null, position: string | null, summary: string, confidence = 0.95): Classified => ({
  kind, source, summary, confidence, scheduledAt: null,
  company: company ? flat(company) : null,
  position: position ? flat(position).replace(/…$/, "") : null,
});
const skip = (source: Source): Classified => out("not_job_application", source, null, null, "ไม่เกี่ยวกับใบสมัคร");

const BOARD: [RegExp, Source][] = [[/jobsdb/i, "jobsdb"], [/jobthai/i, "jobthai"], [/jobbkk/i, "jobbkk"], [/linkedin/i, "linkedin"]];

/** Known job-board templates. null = not a board email, let the caller guess or ask the LLM. */
export function classify(e: RawEmail): Classified | null {
  const s = flat(e.subject);
  const body = flat(e.text);
  let m: RegExpMatchArray | null;

  if (/workable/i.test(e.from) && (m = s.match(/^Thanks for applying to (.+)$/))) {
    const pos = body.match(/Your application for the (.+?) job was submitted/)?.[1] ?? null;
    return out("application_confirmation", "company_site", m[1], pos, "ส่งใบสมัครผ่านเว็บบริษัทแล้ว");
  }

  const source = BOARD.find(([re]) => re.test(e.from))?.[1];
  if (!source) return null;

  switch (source) {
    case "jobsdb":
      if (/^ส่งใบสมัครของคุณเรียบร้อยแล้ว/.test(s) && (m = body.match(/ใบสมัครของคุณสำหรับตำแหน่ง (.+?) ถูกส่งถึง (.+?) เรียบร้อยแล้ว/)))
        return out("application_confirmation", source, m[2], m[1], "ส่งใบสมัครผ่าน Jobsdb แล้ว");
      if ((m = s.match(/^(.+?) ได้ดูใบสมัครของคุณสำหรับ (.+)$/))) return out("viewed", source, m[1], m[2], "บริษัทเปิดดูใบสมัครแล้ว");
      if ((m = s.match(/^อัปเดตใบสมัครสำหรับ (.+) ที่ (.+)$/)))
        return /ไม่ได้รับการพิจารณา/.test(body)
          ? out("rejection", source, m[2], m[1], "บริษัทแจ้งว่าใบสมัครไม่ได้รับการพิจารณาต่อ")
          : out("other_update", source, m[2], m[1], "มีอัปเดตใบสมัครใน Jobsdb", 0.8);
      if ((m = s.match(/^(.+?) has responded to your application for (.+)$/)))
        return out("other_update", source, m[1], m[2], "บริษัทส่งข้อความตอบกลับใบสมัครผ่าน Jobsdb — เปิดอ่านในอีเมล");
      return skip(source); // job alerts, digests, "posting closed", profile views
    case "jobthai":
      if ((m = body.match(/ใบสมัครตำแหน่ง (.+?) ถูกส่งถึง (.+?) แล้ว/))) return out("application_confirmation", source, m[2], m[1], "ส่งใบสมัครผ่าน JobThai แล้ว");
      return skip(source);
    case "jobbkk":
      if ((m = body.match(/ประวัติของคุณได้ถูกเปิดดูโดย (.+?)(?: \[| https?:\/\/| <| เมื่อวันที่)/))) return out("viewed", source, m[1], null, "บริษัทเปิดดูเรซูเม่ใน JobBKK");
      return skip(source);
    case "linkedin":
      if ((m = s.match(/your application was sent to (.+)$/i))) return out("application_confirmation", source, m[1], null, "ส่งใบสมัครผ่าน LinkedIn แล้ว");
      if ((m = s.match(/^Your application was viewed by (.+)$/))) return out("viewed", source, m[1], null, "บริษัทเปิดดูใบสมัครใน LinkedIn");
      // usually a rejection, but the plain-text body doesn't say — let the user confirm
      if ((m = s.match(/^Your application to (.+) at (.+)$/))) return out("other_update", source, m[2], m[1], "LinkedIn แจ้งอัปเดตใบสมัคร — เปิดอ่านในอีเมล", 0.6);
      return skip(source);
    default:
      return skip(source);
  }
}

// domains that don't name the employer: free mail, and HR/form tools that send for many companies
const NOT_EMPLOYER = /^(gmail|googlemail|google|hotmail|outlook|live|yahoo|icloud|me|msn|proton|protonmail|empeo|workable|workablemail|notion|lever|greenhouse|smartrecruiters|bamboohr|typeform|jotform)$/;

const kindOf = (t: string): Kind | null =>
  /แบบทดสอบ|assessment|assignment|coding test|technical test/i.test(t) ? "assessment"
  : /สัมภาษณ์|interview/i.test(t) ? "interview"
  : /offer letter|เสนอตำแหน่ง|ยินดีรับเข้าทำงาน/i.test(t) ? "offer"
  : /unfortunately|not (?:be )?moving forward|ไม่ผ่านการพิจารณา|ไม่ได้รับการคัดเลือก/i.test(t) ? "rejection"
  : null;

/** Mail from a person (HR, recruiter): guess kind from keywords and company from the sender's domain. Always goes to review. */
export function guess(e: RawEmail): Classified {
  // subject first: a test invite often mentions the interview that follows it
  const kind = kindOf(e.subject) ?? kindOf(e.text.slice(0, 2000)) ?? "other_update";
  const domain = e.from.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
  const label = domain.split(".").filter((p) => !/^(co|com|net|org|ac|or|go|th|mail|careers?|jobs?|hr|recruit(ment)?|e|candidates)$/.test(p)).at(-1) ?? null;
  return out(kind, "company_site", label && !NOT_EMPLOYER.test(label) ? label : null, null, flat(e.subject).slice(0, 120), 0.5);
}
