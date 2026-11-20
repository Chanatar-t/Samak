import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatches, nextStatus, normalize } from "./match.ts";

const app = (id: string, company: string, position = "Dev", companyAliases: string[] = []) =>
  ({ id, company, position, companyAliases, status: "applied" as const });

test("normalize strips legal suffixes but keeps Thai vowels", () => {
  assert.equal(normalize("บริษัท ทางด่วนและรถไฟฟ้ากรุงเทพ จำกัด (มหาชน)"), "ทางด่วนและรถไฟฟ้ากรุงเทพ");
  assert.equal(normalize("Jitta Co., Ltd."), "jitta");
  assert.equal(normalize("Gofive (Thailand) Company Limited"), "gofive");
});

test("findMatches: legal-name vs brand, aliases, no false hit on short names", () => {
  const apps = [app("1", "บริษัท จิตตะ ดอท คอม จำกัด", "Dev", ["Jitta"]), app("2", "Gofive"), app("3", "AB")];
  assert.deepEqual(findMatches("Jitta", null, apps).map((a) => a.id), ["1"]); // via alias
  assert.deepEqual(findMatches("Jitta.com", null, apps).map((a) => a.id), ["1"]); // alias contained in name
  assert.deepEqual(findMatches("GOFIVE CO., LTD.", null, apps).map((a) => a.id), ["2"]);
  assert.deepEqual(findMatches("ABC Corp", null, apps).map((a) => a.id), []);
  assert.deepEqual(findMatches(null, null, apps), []);
});

test("findMatches narrows by position when one company has several applications", () => {
  const apps = [app("1", "Gofive", "Frontend Developer"), app("2", "Gofive", "Backend Developer")];
  assert.deepEqual(findMatches("Gofive", "Backend Developer", apps).map((a) => a.id), ["2"]);
  assert.equal(findMatches("Gofive", "QA", apps).length, 2);
});

test("nextStatus only moves forward, rejection wins, closed stays closed", () => {
  assert.equal(nextStatus("applied", "interview"), "interview");
  assert.equal(nextStatus("ghosted", "interview"), "interview");
  assert.equal(nextStatus("ghosted", null), "ghosted");
  assert.equal(nextStatus("interview", "assessment"), "interview");
  assert.equal(nextStatus("interview", "rejected"), "rejected");
  assert.equal(nextStatus("withdrawn", "interview"), "withdrawn");
  assert.equal(nextStatus("applied", null), "applied");
});
