import { test } from "node:test";
import assert from "node:assert/strict";
import { decrypt, encrypt } from "./secret.ts";

test("round trip, random IV, wrong secret fails", () => {
  const a = encrypt("abcd efgh ijkl mnop", "s1");
  assert.equal(decrypt(a, "s1"), "abcd efgh ijkl mnop");
  assert.notEqual(a, encrypt("abcd efgh ijkl mnop", "s1"));
  assert.ok(!a.includes("abcd"));
  assert.throws(() => decrypt(a, "s2"));
});
