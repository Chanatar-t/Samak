export type JobMeta = { position?: string; company?: string; location?: string };

const decode = (s?: string) =>
  s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || undefined;

// last match wins: SPAs (JobThai) emit a site-wide default first, then the page-specific tag
const meta = (html: string, p: string) =>
  decode(
    [
      ...html.matchAll(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)`, "gi")),
      ...html.matchAll(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, "gi")),
    ].sort((a, b) => a.index - b.index).at(-1)?.[1],
  );

// schema.org JobPosting: LinkedIn and most company/ATS career pages (Workable, Greenhouse, Lever...) ship it
function jobPosting(html: string): JobMeta | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const p = [j, j?.["@graph"] ?? []].flat(2).find((x) => x?.["@type"] === "JobPosting");
      if (!p) continue;
      const addr = [p.jobLocation].flat()[0]?.address;
      return {
        position: decode(p.title),
        company: decode(p.hiringOrganization?.name),
        location: [addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(", ") || undefined,
      };
    } catch {}
  }
  return null;
}

export function parseJobHtml(html: string): JobMeta {
  const ld = jobPosting(html);
  if (ld?.position) return ld;
  const title = meta(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]*)/i)?.[1]);
  // JobThai /th/company/job/: "งาน หางาน สมัครงาน <company> | <position> - JobThai"
  const jt = title?.match(/^งาน หางาน สมัครงาน (.+?) \| (.+?) - JobThai$/);
  if (jt) return { company: jt[1], position: jt[2] };
  // JobThai /th/job/: "<position> | <company> งาน หางาน สมัครงาน - JobThai"
  const jt2 = title?.match(/^(.+?) \| (.+?) งาน หางาน สมัครงาน - JobThai$/);
  if (jt2) return { position: jt2[1], company: jt2[2] };
  return { position: title, company: meta(html, "og:site_name") };
}
