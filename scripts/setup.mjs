// One-command local setup: .env.local → Postgres in Docker → tables. Safe to re-run.
//   npm run setup                         asks for a login password
//   APP_PASSWORD=xxx npm run setup        non-interactive (CI / AI agents)
// Never overwrites a value that is already set in .env.local.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const ENV = ".env.local";
const run = (cmd, quiet = false) => execSync(cmd, { stdio: quiet ? "pipe" : "inherit" });
const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };

// 1. env file
let env = existsSync(ENV) ? readFileSync(ENV, "utf8") : readFileSync(".env.example", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const set = (k, v) => { env = new RegExp(`^${k}=`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`; };

if (!get("AUTH_SECRET")) set("AUTH_SECRET", randomBytes(32).toString("base64url"));
if (!get("APP_PASSWORD")) {
  let pw = process.env.APP_PASSWORD;
  if (!pw && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    pw = (await rl.question("ตั้งรหัสผ่านสำหรับเข้าเว็บ (เว้นว่าง = สุ่มให้): ")).trim();
    rl.close();
  }
  if (!pw) {
    pw = randomBytes(9).toString("base64url");
    console.log(`\nรหัสผ่านเข้าเว็บ (สุ่ม): ${pw}  ← จดไว้ หรือดูได้ใน ${ENV}`);
  }
  if (/\s/.test(pw)) fail("รหัสผ่านห้ามมีช่องว่าง");
  set("APP_PASSWORD", pw);
}
writeFileSync(ENV, env);
console.log(`✓ ${ENV} พร้อม`);

// 2. database
try { run("docker info", true); } catch { fail("Docker ยังไม่ทำงาน — เปิด Docker Desktop แล้วรัน npm run setup ใหม่"); }
run("docker compose up -d");
let ready = false;
for (let i = 0; i < 30 && !ready; i++) {
  try { run("docker compose exec -T db pg_isready -U postgres", true); ready = true; }
  catch { await new Promise((r) => setTimeout(r, 1000)); }
}
if (!ready) fail("Postgres ไม่ขึ้นภายใน 30 วินาที — ดู log ด้วย docker compose logs db");
run("npx drizzle-kit push"); // no --force: never auto-approve a data-losing change
console.log("✓ ฐานข้อมูลพร้อม");

console.log(`
เสร็จแล้ว ต่อไป:
  1. npm run dev  แล้วเปิด http://localhost:3000
  2. เข้าด้วยรหัสผ่านใน ${ENV} (APP_PASSWORD)
  3. ไปหน้า ตั้งค่า → เชื่อม Gmail ด้วย App Password`);
