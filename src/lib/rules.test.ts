import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, guess } from "./rules.ts";

const mail = (from: string, subject: string, text = "") => ({ gmailMessageId: "1", from, subject, text, receivedAt: new Date() });
const pick = (r: ReturnType<typeof classify>) => r && [r.kind, r.company, r.position, r.source];
const JOBSDB = '"ใบสมัครงานของ Jobsdb" <noreply@e.jobsdb.com>';

test("JobsDB application sent (body wraps lines)", () => {
  const r = classify(mail(JOBSDB, "ส่งใบสมัครของคุณเรียบร้อยแล้ว – ยืนยันข้อมูลสำคัญ", "สวัสดี A ใบสมัครของคุณสำหรับตำแหน่ง Developer / System Analyst (AS/400))\nถูกส่งถึง iCONEXT CO., LTD. (Head Office) เรียบร้อยแล้ว"));
  assert.deepEqual(pick(r), ["application_confirmation", "iCONEXT CO., LTD. (Head Office)", "Developer / System Analyst (AS/400))", "jobsdb"]);
});

test("JobsDB viewed / rejected / employer reply / noise", () => {
  assert.deepEqual(pick(classify(mail(JOBSDB, "Gofive Company Limited ได้ดูใบสมัครของคุณสำหรับ Full Stack Developer (New Grads Welcome)"))),
    ["viewed", "Gofive Company Limited", "Full Stack Developer (New Grads Welcome)", "jobsdb"]);
  assert.deepEqual(pick(classify(mail(JOBSDB, "อัปเดตใบสมัครสำหรับ Junior Programmer (Full Stack) ที่ Muangthai Capital Public Company Limited", "ใบสมัครของคุณน่าจะไม่ได้รับการพิจารณาต่อ"))),
    ["rejection", "Muangthai Capital Public Company Limited", "Junior Programmer (Full Stack)", "jobsdb"]);
  assert.deepEqual(pick(classify(mail('"X ที่ Gofive Company Limited ผ่าน Jobsdb" <noreply@jobsdb.com>', "Gofive Company Limited has responded to your application for Full Stack Developer (New Grads Welcom…"))),
    ["other_update", "Gofive Company Limited", "Full Stack Developer (New Grads Welcom", "jobsdb"]);
  assert.equal(classify(mail(JOBSDB, "สวัสดี A ตำแหน่งงาน X ของ Y ได้ปิดรับสมัครแล้ว"))?.kind, "not_job_application");
  assert.equal(classify(mail('"Jobsdb" <noreply@e.jobsdb.com>', "บันทึกการค้นหางานที่ตรงกับความต้องการของคุณ"))?.kind, "not_job_application");
});

test("JobThai sent", () => {
  const r = classify(mail('"JobThai - Upload File" <upload-file@application.jobthai.com>', "ใบสมัครส่งถึงบริษัทแล้ว (Your application was successfully sent)",
    "(English version below)\nใบสมัครตำแหน่ง Full Stack Developer ถูกส่งถึง Nemera Technologies Co., Ltd. แล้ว\nคุณได้ส่งใบสมัครงานเมื่อ"));
  assert.deepEqual(pick(r), ["application_confirmation", "Nemera Technologies Co., Ltd.", "Full Stack Developer", "jobthai"]);
});

test("JobBKK resume viewed, job update ignored", () => {
  const r = classify(mail('"JOBBKK.COM" <jobs@jobbkk.com>', "iCheck information Resume view Alert", "ประวัติของคุณได้ถูกเปิดดูโดย บริษัท อิวา ดีไซน์ (ประเทศไทย) จำกัด\nhttps://x.y/z เมื่อวันที่ 23/09/2569"));
  assert.deepEqual(pick(r), ["viewed", "บริษัท อิวา ดีไซน์ (ประเทศไทย) จำกัด", null, "jobbkk"]);
  assert.equal(classify(mail('"JOBBKK.COM" <jobs@jobbkk.com>', "JOB UPDATE ตำแหน่งงานส่งตรงถึงท่าน"))?.kind, "not_job_application");
});

test("LinkedIn + Workable", () => {
  const LI = '"LinkedIn" <jobs-noreply@linkedin.com>';
  assert.deepEqual(pick(classify(mail(LI, "Your application was viewed by OxygenAI"))), ["viewed", "OxygenAI", null, "linkedin"]);
  assert.deepEqual(pick(classify(mail(LI, "Chonasit, your application was sent to Omise"))), ["application_confirmation", "Omise", null, "linkedin"]);
  assert.deepEqual(pick(classify(mail(LI, "Your application to Full Stack Engineer at Geek Squad Studio"))), ["other_update", "Geek Squad Studio", "Full Stack Engineer", "linkedin"]);
  assert.equal(classify(mail(LI, "New jobs similar to Back End Developer at Allianz Technology"))?.kind, "not_job_application");
  assert.deepEqual(pick(classify(mail('"Workable" <noreply@candidates.workablemail.com>', "Thanks for applying to CP Axtra", "Your application for the AI Product Engineer job was submitted successfully."))),
    ["application_confirmation", "CP Axtra", "AI Product Engineer", "company_site"]);
});

test("non-board mail → null; guess() reads kind + company from domain", () => {
  const hr = mail('"Weena U" <weena.u@frontiscompany.com>', "FRONTIS: .NET Developer - Interview Step");
  assert.equal(classify(hr), null);
  assert.deepEqual([guess(hr).kind, guess(hr).company], ["interview", "frontiscompany"]);
  assert.equal(guess(mail("a <a@gmail.com>", "hello")).company, null);
  assert.equal(guess(mail("hr <hr@careers.scb.co.th>", "Unfortunately we will not be moving forward")).kind, "rejection");
  const ats = guess(mail("Gofive <noreply@empeo.com>", "เริ่มทำแบบทดสอบสมัครงานตำแหน่ง Full Stack", "หลังทำแบบทดสอบจะมีนัดสัมภาษณ์"));
  assert.deepEqual([ats.kind, ats.company], ["assessment", null]);
  const bkk = classify(mail("<jobs@jobbkk.com>", "iCheck information Resume view Alert", "ประวัติของคุณได้ถูกเปิดดูโดย บริษัท เอ จำกัด\n[https://www.jobbkk.com/company/1] เมื่อวันที่"));
  assert.equal(bkk?.company, "บริษัท เอ จำกัด");
});
