"use client";
import React, { useState } from "react";
import { Brand, Field } from "./ui";
import { client } from "./api";
import { ConnectionNotice } from "./connection";
import PasswordInput from "./PasswordInput";

export default function PasswordSetup({ api, complete, signOut }: { api: ReturnType<typeof client>; complete: () => Promise<void>; signOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="online-app grid min-h-screen place-items-center bg-[#f6f8f5] px-5 py-8"><section className="honor-auth honor-panel w-full max-w-md p-6 sm:p-8">
    <Brand /><ConnectionNotice />
    <h1 className="mt-7 text-2xl font-semibold">Make this account yours</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-500">Replace the temporary password from your administrator before opening Honor. Your new password stays private.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <form className="mt-6 space-y-5" onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget; const fields = new FormData(form);
      if (fields.get("new_password") !== fields.get("confirm_password")) { setError("Your new passwords do not match."); return; }
      setBusy(true); setError("");
      try { await api.send("/auth/password", { current_password: fields.get("current_password"), new_password: fields.get("new_password") }); form.reset(); await complete(); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>
      <Field label="Temporary password"><PasswordInput required name="current_password" autoComplete="current-password" maxLength={256} className="online-input" /></Field>
      <Field label="New private password"><PasswordInput required name="new_password" autoComplete="new-password" minLength={12} maxLength={256} className="online-input" /></Field>
      <Field label="Confirm new password"><PasswordInput required name="confirm_password" autoComplete="new-password" minLength={12} maxLength={256} className="online-input" /></Field>
      <p className="text-xs leading-6 text-zinc-500">Use at least 12 characters and a different password from the temporary one.</p>
      <button disabled={busy} className="honor-button w-full">{busy ? "Updating…" : "Save private password"}</button>
    </form>
    <button disabled={busy} className="honor-text-button mt-4" onClick={signOut}>Sign out</button>
  </section></main>;
}
