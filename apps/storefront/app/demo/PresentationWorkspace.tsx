"use client";
import React from "react";
import dynamic from "next/dynamic";

const BrowserWorkspace = dynamic(() => import("../../../../src/App"), {
  ssr: false,
  loading: () => <div role="status" className="grid min-h-screen place-items-center bg-[#f6f8f5] text-sm text-zinc-500">Opening Honor’s inventory walkthrough…</div>,
});

class PreviewBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="online-app grid min-h-screen place-items-center bg-[#f6f8f5] p-6"><section className="honor-panel max-w-md p-7"><h1 className="text-xl font-semibold">The browser preview could not open</h1><p className="mt-3 text-sm leading-7 text-zinc-500">Browser storage may be unavailable or contain an older preview. You can clear this preview and start empty, or return to the pilot overview.</p><button className="honor-button mt-5" onClick={() => {
      try { Object.keys(localStorage).filter(key => key.startsWith("honor_preview_empty_v1_")).forEach(key => localStorage.removeItem(key)); window.location.reload(); }
      catch { window.location.assign("/pilot"); }
    }}>Clear this browser preview</button><a href="/pilot" className="honor-text-button mt-3 block">Back to pilot overview</a></section></main> : this.props.children;
  }
}

export default function PresentationWorkspace() { return <PreviewBoundary><BrowserWorkspace presentation /></PreviewBoundary>; }
