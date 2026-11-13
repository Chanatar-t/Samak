export type JobMeta = { position?: string; company?: string; location?: string; salaryText?: string; jobDescription?: string };

const decode = (s?: string | null) =>
  s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim() || undefined;

// HTML fragment → plain text with line breaks kept
const text = (s?: string | null) =>
  decode(
    decode(s) // some sites double-encode (&lt;p&gt;)
      ?.replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  );

const join = (parts: (string | null | undefined)[], sep = ", ") => parts.filter(Boolean).join(sep) || undefined;
const num = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-US") : undefined);

const meta = (html: string, p: string) =>
  decode(
    // last match wins: SPAs (JobThai) emit a site-wide default first, then the page-specific tag
    [
      ...html.matchAll(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)`, "gi")),
      ...html.matchAll(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, "gi")),
    ].sort((a, b) => a.index - b.index).at(-1)?.[1],
  );

// balanced-brace JSON object starting at s[start] === "{"
function jsonAt(s: string, start: number) {
  let depth = 0, inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return s.slice(start, i + 1);
  }
}

// Next.js App Router streams page data in self.__next_f.push([1,"..."]) chunks; JSON-LD can live in there
const flight = (html: string) =>
  [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
    .map((m) => { try { return JSON.parse(`"${m[1]}"`) as string; } catch { return ""; } })
    .join("");

/* eslint-disable @typescript-eslint/no-explicit-any -- scraped JSON, shape varies per site */
function fromJobPosting(p: any): JobMeta {
  const addr = [p.jobLocation].flat()[0]?.address;
  const v = p.baseSalary?.value;
  const range = v?.minValue != null || v?.maxValue != null ? join([num(v.minValue), num(v.maxValue)], " - ") : num(v?.value ?? v);
  return {
    position: decode(p.title),
    company: decode(p.hiringOrganization?.name),
    location: join([addr?.addressLocality, addr?.addressRegion]),
    salaryText: range && join([range, p.baseSalary?.currency, v?.unitText && `/ ${v.unitText.toLowerCase()}`], " "),
    jobDescription: join([text(p.description), p.qualifications && `คุณสมบัติ:\n${text(p.qualifications)}`], "\n\n"),
  };
}

// schema.org JobPosting: LinkedIn, JobThai and most company/ATS career pages ship it
function jobPosting(html: string): JobMeta | null {
  for (const src of [html, flight(html)]) {
    for (const m of src.matchAll(/"@type"\s*:\s*"JobPosting"/g)) {
      const start = src.lastIndexOf("{", src.lastIndexOf('"@context"', m.index));
      try {
        const j = JSON.parse(jsonAt(src, start) ?? "");
        const p = [j, j?.["@graph"] ?? []].flat(2).find((x) => x?.["@type"] === "JobPosting");
        if (p?.title) return fromJobPosting(p);
      } catch {}
    }
  }
  return null;
}

// JobThai /th/job/ (Pages Router): job data sits in __NEXT_DATA__ apolloState, no JSON-LD
function jobThaiNextData(html: string): JobMeta | null {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  try {
    const q = JSON.parse(raw).props?.apolloState?.ROOT_QUERY ?? {};
    const d: any = Object.entries(q).find(([k]) => k.startsWith("getJobRawData"))?.[1];
    const job = d?.data;
    if (!job?.title) return null;
    const w = job.workLocation;
    const props: string[] = job.properties ?? [];
    return {
      position: decode(job.title),
      company: decode(job.company?.name),
      location: join([w?.district?.name, w?.province?.name]),
      salaryText: decode(job.salary),
      jobDescription: join([text(job.description), props.length ? `คุณสมบัติ:\n${props.map((x) => `- ${x}`).join("\n")}` : null], "\n\n"),
    };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const clean = (m: JobMeta) => Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as JobMeta;

export function parseJobHtml(html: string): JobMeta {
  const rich = jobPosting(html) ?? jobThaiNextData(html);
  if (rich) return clean(rich);
  const title = meta(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]*)/i)?.[1]);
  // JobThai /th/company/job/: "งาน หางาน สมัครงาน <company> | <position> - JobThai"
  const jt = title?.match(/^งาน หางาน สมัครงาน (.+?) \| (.+?) - JobThai$/);
  if (jt) return { company: jt[1], position: jt[2] };
  // JobThai /th/job/: "<position> | <company> งาน หางาน สมัครงาน - JobThai"
  const jt2 = title?.match(/^(.+?) \| (.+?) งาน หางาน สมัครงาน - JobThai$/);
  if (jt2) return { position: jt2[1], company: jt2[2] };
  return clean({ position: title, company: meta(html, "og:site_name") });
}
