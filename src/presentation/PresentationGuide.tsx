import React, { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { ModuleType } from "../types";

const steps: {module: ModuleType; label: string}[] = [
  {module: "dashboard", label: "1. Stock overview"},
  {module: "inventory", label: "2. Products"},
  {module: "add-stock", label: "3. Receive stock"},
  {module: "stock-movements", label: "4. Movement history"},
  {module: "staff", label: "5. Staff access"},
];

export default function PresentationGuide() {
  const { activeModule, setActiveModule } = useApp();
  const [expanded, setExpanded] = useState(true);
  return <section className="mb-6 rounded-2xl border border-emerald-900/10 bg-white p-4 sm:p-5" aria-label="Presentation guide">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-emerald-800">Honor · Presentation pilot</p><p className="mt-1 text-xs leading-6 text-zinc-500">Browser preview only. Use preview details; no shared stock, real accounts, email or payments.</p></div><button className="inline-flex min-h-10 items-center gap-1 text-xs text-emerald-800" aria-expanded={expanded} aria-controls="pilot-walkthrough" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide guide" : "Show guide"}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div>
    {expanded && <div id="pilot-walkthrough" className="mt-4 border-t border-zinc-100 pt-4"><nav aria-label="Walkthrough steps" className="flex flex-wrap gap-2">{steps.map(step => <button key={step.module} onClick={() => setActiveModule(step.module)} aria-current={activeModule === step.module ? "step" : undefined} className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-medium ${activeModule === step.module ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-200 text-zinc-600 hover:bg-emerald-50"}`}>{step.label}</button>)}</nav><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><a href="/pilot" className="honor-text-button"><ArrowLeft size={14} aria-hidden="true" />Pilot overview</a><a href="/" className="honor-text-button">Customer shop <ArrowUpRight size={14} aria-hidden="true" /></a><a href="/workspace" className="honor-text-button">Staff sign-in <ArrowUpRight size={14} aria-hidden="true" /></a></div></div>}
  </section>;
}
