import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("a password verifies against its own hash only", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("correct horse batterY", hash), false);
});

test("the same password hashes differently each time (random salt)", async () => {
  assert.notEqual(await hashPassword("same"), await hashPassword("same"));
});

test("malformed stored hashes never verify", async () => {
  assert.equal(await verifyPassword("x", "plaintext"), false);
  assert.equal(await verifyPassword("x", ""), false);
});
