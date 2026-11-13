// Spike helper: see which emails JOB_QUERY catches, and (with --extract) what Claude reads from them.
// Writes nothing to the DB. Run: npm run gmail:peek [-- --days 30] [-- --extract]
import { fetchJobEmails } from "../src/lib/gmail.ts";

process.loadEnvFile(".env.local");
const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 30;
const withExtract = process.argv.includes("--extract");

const mails = await fetchJobEmails(new Date(Date.now() - days * 864e5));
console.log(`${mails.length} emails in the last ${days} days\n`);
const { extract } = withExtract ? await import("../src/lib/extract.ts") : { extract: null };
for (const m of mails.sort((a, b) => +a.receivedAt - +b.receivedAt)) {
  console.log(`${m.receivedAt.toISOString().slice(0, 10)}  ${m.from.slice(0, 40).padEnd(40)}  ${m.subject}`);
  if (extract) {
    const x = await extract(m);
    console.log(`            → ${x ? `${x.kind} | ${x.company} | ${x.position} | ${x.source} | ${x.confidence}` : "(failed)"}`);
  }
}
