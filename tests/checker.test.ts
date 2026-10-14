import { test } from "node:test";
import assert from "node:assert/strict";
import { check, normalise } from "../src/lib/checker";

test("normalise strips CRLF, trailing spaces and trailing blank lines", () => {
  assert.equal(normalise("1 2  \r\n3\t\r\n\r\n"), "1 2\n3");
});

test("Exact keeps inner whitespace significant", () => {
  assert.equal(check("Exact", "0 1\n", "0 1"), true);
  assert.equal(check("Exact", "0  1", "0 1"), false);
});

test("TokenCompare ignores whitespace layout but not tokens", () => {
  assert.equal(check("TokenCompare", "0\n1\n", "0 1"), true);
  assert.equal(check("TokenCompare", "0 1 2", "0 1"), false);
  assert.equal(check("TokenCompare", "", "0 1"), false);
});
