"use client";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Brand, Field } from "./ui";
import { client } from "./api";
import { ConnectionNotice } from "./connection";

export default function PasswordSetup({ api, complete, signOut }: {
  api: ReturnType<typeof client>;
  complete: () => Promise<void>;
  signOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const passwordField = (label: string, name: string, autocomplete: string, minLength = 1) =>
    <Field label={label}>
      <div className="relative">
        <input required type={visible[name] ? "text" : "password"} name={name}
          autoComplete={autocomplete} minLength={minLength} maxLength={256}
          className="online-input pr-24" />
        <button type="button" className="honor-password-toggle absolute right-1 top-1"
          aria-label={visible[name] ? "Hide " + label.toLowerCase() : "Show " + label.toLowerCase()}
          aria-pressed={Boolean(visible[name])}
          onClick={() => setVisible(previous => ({ ...previous, [name]: !previous[name] }))}>
          {visible[name] ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{visible[name] ? "Hide" : "Show"}</span>
        </button>
      </div>
    </Field>;

  return <main className="honor-password-change online-app grid min-h-screen place-items-center bg-[#f7f7f8] px-5 py-8">
    <section className="honor-auth honor-panel w-full max-w-md p-6 sm:p-8">
      <Brand /><ConnectionNotice />
      <h1 className="mt-7 text-2xl font-semibold">Make this account yours</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-500">Replace the temporary password from your administrator before opening HONOR. Your new password stays private.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <form className="mt-6 space-y-5" onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget; const fields = new FormData(form);
        if (fields.get("new_password") !== fields.get("confirm_password")) { setError("Your new passwords do not match."); return; }
        setBusy(true); setError("");
        try {
          await api.send("/auth/password", { current_password: fields.get("current_password"), new_password: fields.get("new_password") });
          form.reset(); setVisible({}); await complete();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>
        {passwordField("Temporary password", "current_password", "current-password")}
        {passwordField("New private password", "new_password", "new-password", 12)}
        {passwordField("Confirm new password", "confirm_password", "new-password", 12)}
        <p className="text-xs leading-6 text-zinc-500">Use at least 12 characters and a different password from the temporary one.</p>
        <button disabled={busy} className="honor-button w-full">{busy ? "Updating…" : "Save private password"}</button>
      </form>
      <button disabled={busy} className="honor-text-button mt-4" onClick={signOut}>Sign out</button>
    </section>
  </main>;
}
