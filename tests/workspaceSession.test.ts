import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/online/api";
import { canOpenWorkspacePage, loadWorkspaceSession } from "../src/online/workspaceSession";

function profile(role = "ADMIN") {
  return {
    id: "test-user", name: "Test staff", email: "staff@example.test",
    mfa: false, factors: [], companies: [{
      id: "owned-company", name: "Test company", slug: "test-company",
      currency: "NGN", timezone: "Africa/Lagos", role,
    }],
  };
}

test("workspace requests use verified company membership and role, not an arbitrary selected ID", async () => {
  const original = globalThis.fetch;
  try {
    for (const role of ["ADMIN", "MANAGER", "STOCK", "SALES"]) {
      const calls: string[] = [];
      globalThis.fetch = async (url, options) => {
        const path = String(url).replace("/api/v1", "");
        calls.push(path);
        assert.equal(options?.credentials, "include");
        const companyId = new Headers(options?.headers).get("X-Company-Id");
        if (path === "/me") {
          assert.equal(companyId, null);
          return Response.json(profile(role));
        }
        assert.equal(companyId, "owned-company");
        return Response.json([]);
      };
      const snapshot = await loadWorkspaceSession("/api/v1", "unowned-company");
      assert.equal(snapshot.companyId, "owned-company");
      assert.equal(calls.includes("/team"), role === "ADMIN");
      assert.equal(calls.includes("/audit"), role === "ADMIN");
      assert.equal(calls.includes("/jobs"), role === "ADMIN");
      assert.equal(calls.includes("/transfer-destinations"), role !== "SALES");
      assert.ok(calls.includes("/stock/balances"));
      assert.ok(!calls.includes("/config"));
    }
  } finally { globalThis.fetch = original; }
});

test("expired sessions and malformed profiles never trigger company data requests", async () => {
  const original = globalThis.fetch;
  try {
    for (const body of [null, {}, { ...profile(), companies: [{ id: "forged", role: "OWNER" }] }]) {
      let calls = 0;
      globalThis.fetch = async () => { ++calls; return Response.json(body); };
      await assert.rejects(loadWorkspaceSession("/api/v1", ""), (e: unknown) =>
        e instanceof ApiError && e.status === 502);
      assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = async () => {
      ++calls; return Response.json({ detail: "Session expired" }, { status: 401 });
    };
    await assert.rejects(loadWorkspaceSession("/api/v1", "owned-company"), (e: unknown) =>
      e instanceof ApiError && e.status === 401);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("an account without company membership receives no company records or implicit administrator access", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    ++calls; return Response.json({ ...profile(), companies: [] });
  };
  try {
    const snapshot = await loadWorkspaceSession("/api/v1", "unowned-company");
    assert.equal(calls, 1);
    assert.equal(snapshot.companyId, "");
    assert.ok(Object.values(snapshot.data).every(rows => rows.length === 0));
  } finally { globalThis.fetch = original; }
});

test("temporary-password accounts receive no company data before setting a private password", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { ++calls; return Response.json({ ...profile(), must_change_password: true }); };
  try {
    const snapshot = await loadWorkspaceSession("/api/v1", "owned-company");
    assert.equal(calls, 1);
    assert.equal(snapshot.companyId, "");
    assert.ok(Object.values(snapshot.data).every(rows => rows.length === 0));
  } finally { globalThis.fetch = original; }
});

test("revoked access or invalid collection responses cannot produce a partial workspace snapshot", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [403, 200]) {
      globalThis.fetch = async (url) => {
        if (String(url).endsWith("/me")) return Response.json(profile());
        if (String(url).endsWith("/stock/balances"))
          return Response.json({ detail: "Access changed" }, { status });
        return Response.json([]);
      };
      await assert.rejects(loadWorkspaceSession("/api/v1", "owned-company"), (e: unknown) =>
        e instanceof ApiError && e.status === (status === 403 ? 403 : 502));
    }
  } finally { globalThis.fetch = original; }
});

test("a lower-role snapshot contains none of the previous administrator's records", async () => {
  const original = globalThis.fetch;
  let role = "ADMIN";
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/me")) return Response.json(profile(role));
    return Response.json([{ id: "test-record" }]);
  };
  try {
    const admin = await loadWorkspaceSession("/api/v1", "");
    assert.equal(admin.data.team.length, 1);
    role = "SALES";
    const sales = await loadWorkspaceSession("/api/v1", "owned-company");
    assert.deepEqual(sales.data.team, []);
    assert.deepEqual(sales.data.audit, []);
    assert.deepEqual(sales.data.jobs, []);
    assert.deepEqual(sales.data.destinations, []);
    assert.equal(admin.data.team.length, 1);
    assert.equal(canOpenWorkspacePage(role, "People & access"), false);
  } finally { globalThis.fetch = original; }
});

test("staff navigation denies unknown roles, unknown pages and ungranted operations", () => {
  assert.equal(canOpenWorkspacePage("ADMIN", "Company"), true);
  assert.equal(canOpenWorkspacePage("MANAGER", "Company"), false);
  assert.equal(canOpenWorkspacePage("STOCK", "Receive stock"), true);
  assert.equal(canOpenWorkspacePage("SALES", "Receive stock"), false);
  assert.equal(canOpenWorkspacePage("SALES", "Inventory"), true);
  assert.equal(canOpenWorkspacePage("OWNER", "Overview"), false);
  assert.equal(canOpenWorkspacePage("ADMIN", "Unrecognised module"), false);
});
