import test from "node:test";
import assert from "node:assert/strict";
import { safeAuthRedirect } from "../lib/auth-redirect.ts";

test("auth redirects preserve the invitation and automatic join intent", () => {
  const path = `/invite/${"a".repeat(64)}?join=1`;
  assert.equal(safeAuthRedirect(path), path);
});
test("auth redirects reject foreign origins and URL parser tricks", () => {
  for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/\r\nevil", ""]) {
    assert.equal(safeAuthRedirect(path), "/dashboard");
  }
});
