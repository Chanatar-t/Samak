// run: node --test src/lib/job-meta.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJobHtml } from "./job-meta.ts";

test("JobThai og:title", () => {
  const html = `<meta property="og:title" content="งาน หางาน สมัครงาน บริษัท ไบรต์ เอ็คซ์เพิร์ท จำกัด | BI Developer - JobThai"/>`;
  assert.deepEqual(parseJobHtml(html), { company: "บริษัท ไบรต์ เอ็คซ์เพิร์ท จำกัด", position: "BI Developer" });
});

test("JobThai /th/job/ with site-wide og:title first", () => {
  const html = `<meta property="og:title" content="JobThai - งาน หางาน สมัครงาน อัปเดตงานคุณภาพทุกวัน"/>
<meta property="og:title" content="เจ้าหน้าที่ แผนกพัฒนาระบบสารสนเทศ (Programmer) | บริษัท ทางด่วนและรถไฟฟ้ากรุงเทพ จำกัด (มหาชน) งาน หางาน สมัครงาน - JobThai"/>`;
  assert.deepEqual(parseJobHtml(html), {
    position: "เจ้าหน้าที่ แผนกพัฒนาระบบสารสนเทศ (Programmer)",
    company: "บริษัท ทางด่วนและรถไฟฟ้ากรุงเทพ จำกัด (มหาชน)",
  });
});

test("JSON-LD JobPosting (LinkedIn)", () => {
  const ld = { "@context": "https://schema.org", "@type": "JobPosting", title: "Software Engineer &amp; Co", hiringOrganization: { name: "Boonmee Lab" }, jobLocation: { address: { addressLocality: "บางรัก", addressRegion: null } } };
  const html = `<meta property="og:title" content="ignored"><script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  assert.deepEqual(parseJobHtml(html), { position: "Software Engineer & Co", company: "Boonmee Lab", location: "บางรัก" });
});

test("JSON-LD inside Next.js flight chunks, with salary + JD (JobThai /th/company/job/)", () => {
  const ld = { "@context": "http://schema.org", "@type": "JobPosting", title: "BI Developer", description: "<p>SQL</p><p>Python</p>",
    hiringOrganization: { name: "Bright" }, jobLocation: { address: { addressLocality: "บางซื่อ", addressRegion: "กรุงเทพมหานคร" } },
    baseSalary: { currency: "THB", value: { minValue: 30000, maxValue: 50000, unitText: "MONTH" } } };
  const chunk = JSON.stringify(`28:T763,${JSON.stringify(ld)}6:["$"]`);
  const html = `<script>self.__next_f.push([1,${chunk}])</script>`;
  assert.deepEqual(parseJobHtml(html), {
    position: "BI Developer", company: "Bright", location: "บางซื่อ, กรุงเทพมหานคร",
    salaryText: "30,000 - 50,000 THB / month", jobDescription: "SQL\nPython",
  });
});

test("JobThai __NEXT_DATA__ (/th/job/)", () => {
  const data = { props: { apolloState: { ROOT_QUERY: { 'getJobRawData({"id":1})': { data: {
    title: "Programmer", company: { name: "BEM" }, salary: "ตามโครงสร้างบริษัทฯ", description: "-พัฒนาระบบ\r\n-ดูแลระบบ",
    properties: ["อายุ 21-30 ปี"], workLocation: { district: { name: "ห้วยขวาง" }, province: { name: "กรุงเทพมหานคร" } } } } } } } };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
  assert.deepEqual(parseJobHtml(html), {
    position: "Programmer", company: "BEM", location: "ห้วยขวาง, กรุงเทพมหานคร", salaryText: "ตามโครงสร้างบริษัทฯ",
    jobDescription: "-พัฒนาระบบ\n-ดูแลระบบ\n\nคุณสมบัติ:\n- อายุ 21-30 ปี",
  });
});

test("generic fallback", () => {
  const html = `<title>Backend Dev</title><meta content="Acme" property="og:site_name">`;
  assert.deepEqual(parseJobHtml(html), { position: "Backend Dev", company: "Acme" });
});
