import { OWNER } from "@/auth";
import { syncEmails } from "@/lib/sync";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Schedule lives in vercel.json at deploy time.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  // ?from=2026-09-01 re-reads an older window after a rules fix (delete the stale email rows first)
  const from = new URL(req.url).searchParams.get("from");
  return Response.json(await syncEmails(OWNER, from ? new Date(from) : undefined));
}
