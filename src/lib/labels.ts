import type { Application } from "@/db/schema";

type Status = Application["status"];
type Source = Application["source"];

export const STATUS: Record<Status, { label: string; dot: string; chip: string }> = {
  wishlist: { label: "อยากสมัคร", dot: "bg-slate-400", chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  applied: { label: "สมัครแล้ว", dot: "bg-blue-500", chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  assessment: { label: "ทำแบบทดสอบ", dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  interview: { label: "สัมภาษณ์", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  offer: { label: "ได้ offer", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "ไม่ผ่าน", dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  ghosted: { label: "เงียบหาย", dot: "bg-zinc-400", chip: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
  withdrawn: { label: "ถอนตัว", dot: "bg-zinc-400", chip: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300" },
};

export const SOURCE: Record<Source, string> = {
  jobthai: "JobThai",
  jobsdb: "JobsDB",
  jobbkk: "JobBKK",
  linkedin: "LinkedIn",
  company_site: "เว็บบริษัท",
  referral: "คนแนะนำ",
  other: "อื่นๆ",
};

const AVATAR = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-600"];

export function avatar(company: string) {
  const name = company.replace(/^(บริษัท|บจก\.?|บมจ\.?)\s*/, "").trim() || company;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return { initial: [...name][0]?.toUpperCase() ?? "?", color: AVATAR[Math.abs(h) % AVATAR.length] };
}

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto", style: "short" }); // "16 วันที่แล้ว", fits table cells

export function ago(d: Date | string) {
  const days = Math.round((new Date(d).getTime() - Date.now()) / 864e5);
  if (days === 0) return "วันนี้";
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}
