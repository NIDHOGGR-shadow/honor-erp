import React, { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { ModuleType } from "../types";

const steps: { module: ModuleType; label: string }[] = [
  { module: "dashboard", label: "1. Stock overview" },
  { module: "inventory", label: "2. Products" },
  { module: "add-stock", label: "3. Receive stock" },
  { module: "stock-movements", label: "4. Movement history" },
  { module: "staff", label: "5. Staff access" },
];

export default function PresentationGuide() {
  const { activeModule, setActiveModule } = useApp();
  const [expanded, setExpanded] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 768px)").matches
      : false,
  );

  return (
    <section className="mb-5 min-w-0 rounded-2xl border border-emerald-900/10 bg-white px-4 py-2 sm:p-5" aria-label="Presentation guide">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-800">Honor · Presentation demo</p>
          <p className="mt-1 text-xs text-zinc-500">Browser preview only</p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
          aria-expanded={expanded}
          aria-controls="pilot-walkthrough"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide guide" : "Show guide"}
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
      {expanded && (
        <div id="pilot-walkthrough" className="mt-3 min-w-0 border-t border-zinc-100 pt-3">
          <p className="mb-3 text-xs leading-5 text-zinc-500">Use preview details. Shared stock, real accounts, email and payments are not connected.</p>
          <nav aria-label="Walkthrough steps" className="flex min-w-0 gap-2 overflow-x-auto pb-2 md:flex-wrap">
            {steps.map((step) => (
              <button
                key={step.module}
                onClick={() => {
                  setActiveModule(step.module);
                  if (window.matchMedia("(max-width: 767px)").matches) setExpanded(false);
                }}
                aria-current={activeModule === step.module ? "step" : undefined}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium ${activeModule === step.module ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-200 text-zinc-600 hover:bg-emerald-50"}`}
              >
                {step.label}
              </button>
            ))}
          </nav>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <a href="/pilot" className="honor-text-button"><ArrowLeft size={14} aria-hidden="true" />Demo overview</a>
            <a href="/" className="honor-text-button">Customer shop <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="/workspace" className="honor-text-button">Staff sign-in <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
        </div>
      )}
    </section>
  );
}
