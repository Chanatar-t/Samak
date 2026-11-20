// Pure matching / status rules for email sync. Tests: node --test src/lib/match.test.ts

type Status = "wishlist" | "applied" | "assessment" | "interview" | "offer" | "rejected" | "ghosted" | "withdrawn";
type App = { id: string; company: string; companyAliases: string[]; position: string; status: Status };

// strip legal suffixes, "Thailand", spaces, punctuation; keep Thai combining marks (\p{M})
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/บริษัท|จำกัด|\(?มหาชน\)?|บจก\.?|บมจ\.?|public company limited|company limited|co\.?,?\s*ltd\.?|ltd\.?|inc\.?|corporation|corp\.?|\(?thailand\)?|ประเทศไทย/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");

const same = (a: string, b: string) => !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))));

export function findMatches<T extends App>(company: string | null, position: string | null, apps: T[]): T[] {
  const n = normalize(company ?? "");
  if (!n) return [];
  const hits = apps.filter((a) => [a.company, ...a.companyAliases].some((c) => same(normalize(c), n)));
  if (hits.length <= 1 || !position) return hits;
  // same company, several applications: narrow by position
  const p = normalize(position);
  const byPos = hits.filter((a) => same(normalize(a.position), p));
  return byPos.length ? byPos : hits;
}

const RANK: Partial<Record<Status, number>> = { wishlist: 0, applied: 1, assessment: 2, interview: 3, offer: 4 };

// never move backwards; rejection always wins; leave closed applications alone
export function nextStatus(current: Status, incoming: Status | null): Status {
  if (!incoming) return current;
  if (incoming === "rejected") return "rejected";
  if (current === "ghosted") return incoming; // auto-ghosted, then they wrote back: it's alive again
  const cur = RANK[current];
  const inc = RANK[incoming];
  if (cur === undefined || inc === undefined) return current;
  return inc > cur ? incoming : current;
}
