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

test("generic fallback", () => {
  const html = `<title>Backend Dev</title><meta content="Acme" property="og:site_name">`;
  assert.deepEqual(parseJobHtml(html), { position: "Backend Dev", company: "Acme" });
});
