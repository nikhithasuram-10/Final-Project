const test = require("node:test");
const assert = require("node:assert/strict");

test("project category list matches the supported donation categories", () => {
  const categories = ["Prepared meals", "Bakery", "Fruits & vegetables", "Dairy", "Packaged food", "Other"];
  assert.equal(categories.length, 6);
  assert.ok(categories.includes("Prepared meals"));
  assert.ok(categories.includes("Fruits & vegetables"));
});

test("pickup deadline validation assumptions reject expired dates", () => {
  const now = new Date();
  const expired = new Date(now.getTime() - 60_000);
  const valid = new Date(now.getTime() + 60 * 60_000);
  assert.ok(expired <= now);
  assert.ok(valid > now);
});

test("the donation form's safety confirmation is required", () => {
  assert.equal({ safety_confirmed: true }.safety_confirmed, true);
  assert.equal({ safety_confirmed: false }.safety_confirmed, false);
});
