import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Workspace from "../src/online/Workspace";

test("unconfigured staff entry renders server-side without browser globals or access to inventory", () => {
  const html = renderToStaticMarkup(
    React.createElement(Workspace, { configured: false, shopUrl: "/" }),
  );
  assert.match(html, /HONOR · TEAM ACCESS/);
  assert.match(html, /Welcome back/);
  assert.match(html, /honor-staff-signin/);
  assert.match(html, /Sign-in is temporarily unavailable/);
  assert.doesNotMatch(html, /<fieldset disabled|Create an account|Create account|Create company workspace/);
  assert.match(html, /Show password/);
  assert.match(html, /<button class="honor-button w-full">Sign in to workspace/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /Opening your workspace|Shared company workspace|Stock updates from your company records/);
});

test("staff password recovery can render its deep link before browser hydration", () => {
  const html = renderToStaticMarkup(
    React.createElement(Workspace, {
      configured: false,
      initialSearch: "recovery=test-recovery-token",
      shopUrl: "/",
    }),
  );
  assert.match(html, /Choose a new password/);
  assert.match(html, /new-password/);
  assert.doesNotMatch(html, /test-recovery-token|Shared company workspace/);
});

test("staff activation is offered only with a private invitation and never public store registration", () => {
  const html = renderToStaticMarkup(React.createElement(Workspace, { configured: false, initialSearch: "invite=" + "a".repeat(43) }));
  assert.match(html, /Activate assigned account/);
  assert.doesNotMatch(html, /Create an account|Create company workspace|Set up your store/);
});

test("configured staff entry waits for a verified session before rendering company records", () => {
  const html = renderToStaticMarkup(
    React.createElement(Workspace, { configured: true }),
  );
  assert.match(html, /Opening your workspace/);
  assert.doesNotMatch(html, /Shared company workspace|Stock updates from your company records/);
});

test("a recovery link takes priority over restoring an existing staff session", () => {
  const html = renderToStaticMarkup(
    React.createElement(Workspace, {
      configured: true,
      initialSearch: "recovery=test-recovery-token",
    }),
  );
  assert.match(html, /Choose a new password/);
  assert.doesNotMatch(html, /Opening your workspace|Shared company workspace|test-recovery-token/);
});
