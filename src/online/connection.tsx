"use client";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { client } from "./api";
import { PendingSubmission } from "./pendingSubmission";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
}
export function ConnectionNotice() {
  const online = useOnline();
  return online ? null : <div role="status" className="honor-offline"><WifiOff size={17} aria-hidden="true" /><span>You’re offline. Connect to the internet to sync with Honor.</span></div>;
}

export function useAuthSubmission(apiBase: string, configured: boolean, identity: string) {
  const online = useOnline();
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState("");
  const pending = useRef(new PendingSubmission());
  const checking = useRef(false);
  const submitting = useRef(false);
  const cancel = useCallback(() => {
    pending.current.cancel(); setWaiting(false); setStatus("");
  }, []);
  const ready = useCallback(async () => {
    if (navigator.onLine === false) return false;
    try {
      const config = await client(apiBase).request<{auth_provider?: string}>("/config", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return config.auth_provider === "supabase" || config.auth_provider === "development";
    } catch { return false; }
  }, [apiBase]);
  useEffect(() => {
    cancel();
    const discard = () => pending.current.cancel();
    window.addEventListener("pagehide", discard);
    return () => { pending.current.cancel(); window.removeEventListener("pagehide", discard); };
  }, [identity, cancel]);
  useEffect(() => {
    if (!waiting) return;
    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const result = await pending.current.reconnect(ready);
        if (result !== "waiting") {
          setWaiting(false);
          setStatus(result === "expired" ? "The waiting request expired. Submit again when you’re ready." : "");
        }
      } finally { checking.current = false; }
    };
    void check();
    const timer = window.setInterval(check, 15_000);
    window.addEventListener("online", check);
    return () => { window.clearInterval(timer); window.removeEventListener("online", check); };
  }, [waiting, ready]);
  const submit = async (action: () => Promise<void>) => {
    if (pending.current.waiting || submitting.current) return;
    submitting.current = true;
    setStatus("");
    pending.current.hold(action);
    try {
      if (online && configured) {
        const result = await pending.current.reconnect(ready);
        if (result !== "waiting") return;
      }
      setWaiting(true);
    } finally { submitting.current = false; }
  };
  return { submit, cancel, waiting, status: waiting
    ? `${online ? "Waiting for Honor to reconnect." : "You’re offline. Waiting for connection."} Nothing has been submitted. We’ll retry once within 5 minutes while this tab stays open.`
    : status };
}

export function SubmissionStatus({ status, waiting, cancel }: {status: string; waiting: boolean; cancel: () => void}) {
  return status ? <div role="status" className="honor-auth-status"><p>{status}</p>{waiting && <button type="button" className="underline underline-offset-4" onClick={cancel}>Cancel pending request</button>}</div> : null;
}
