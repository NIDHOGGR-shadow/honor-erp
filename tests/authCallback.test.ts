import { test } from "node:test";
import assert from "node:assert/strict";
import { readAuthCallback } from "../src/online/authCallback";

test("only complete provider credentials can be passed to the server exchange", () => {
  assert.deepEqual(readAuthCallback("#access_token=fixture-access&refresh_token=fixture-refresh"), {
    kind: "session", accessToken: "fixture-access", refreshToken: "fixture-refresh",
  });
  assert.equal(readAuthCallback("#access_token=fixture-access")?.kind, "error");
  assert.equal(readAuthCallback("#access_token=" + "a".repeat(8001) + "&refresh_token=fixture-refresh")?.kind, "error");
});

test("provider errors use safe copy without displaying arbitrary fragment text", () => {
  const result = readAuthCallback("#error=access_denied&error_code=otp_expired&error_description=untrusted-content");
  assert.equal(result?.kind, "error");
  assert.match(result?.kind === "error" ? result.message : "", /expired/);
  assert.doesNotMatch(JSON.stringify(result), /untrusted-content/);
  assert.equal(readAuthCallback("#/dashboard"), null);
});
