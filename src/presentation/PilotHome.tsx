import React from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Boxes, Check, ClipboardList, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { Brand } from "../online/ui";

const stops = [
  { number: "01", title: "See what is in stock", detail: "Review availability, low-stock attention and the inventory overview.", href: "/demo#/dashboard", icon: Boxes },
  { number: "02", title: "Follow the stock workflow", detail: "Explore product setup, receiving and serial or IMEI tracking.", href: "/demo#/inventory", icon: ArrowDownToLine },
  { number: "03", title: "Understand who can do what", detail: "Review company roles, location access and staff administration.", href: "/demo#/staff", icon: Users },
  { number: "04", title: "Trace every movement", detail: "Explore the record of receipts, transfers, sales and adjustments.", href: "/demo#/stock-movements", icon: ClipboardList },
];

export default function PilotHome() {
  return <div className="honor-pilot online-app min-h-screen bg-[#f6f8f5] text-zinc-900">
    <a href="#pilot-content" className="sr-only focus:not-sr-only focus:block focus:p-4">Skip to presentation</a>
    <header className="border-b border-[#dce6df] bg-white/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <a href="/pilot" aria-label="Honor demo home"><Brand /></a>
        <nav aria-label="Demo navigation" className="flex items-center gap-5 text-sm">
          <a href="/" className="text-zinc-600 hover:text-emerald-800">Customer shop</a>
          <a href="/workspace" className="honor-text-button">Staff sign-in <ArrowUpRight size={15} aria-hidden="true" /></a>
        </nav>
      </div>
    </header>
    <main id="pilot-content" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <section aria-labelledby="pilot-title" className="honor-pilot-hero">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Presentation demo</p>
          <h1 id="pilot-title" className="max-w-xl text-4xl font-medium leading-[1.15] tracking-tight sm:text-5xl">Inventory, in order.<br /><span className="text-[#b9d6b5]">A clearer day at Honor.</span></h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-emerald-50/75">One place to follow stock, understand each movement and give the right people the right access.</p>
          <a href="/demo#/dashboard" className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#d7e8cf] px-6 py-3 text-sm font-semibold text-[#17372d] hover:bg-white">Open inventory walkthrough <ArrowRight size={17} aria-hidden="true" /></a>
          <p className="mt-4 text-xs leading-6 text-emerald-100/65">Interactive browser preview. No sign-in is required for this demonstration.</p>
        </div>
        <aside className="honor-pilot-summary" aria-label="Demo scope">
          <div className="mb-7 flex items-center gap-3"><Boxes size={23} className="text-[#b9d6b5]" aria-hidden="true" /><span className="text-sm font-semibold">Inventory comes first</span></div>
          {[
            ["Stock visibility", "What is available and where it belongs."],
            ["Movement history", "A reason and a record for every change."],
            ["Controlled access", "Staff work within assigned permissions."],
          ].map(([title, text]) => <div key={title} className="mb-5 flex gap-3 last:mb-0"><Check size={16} className="mt-1 shrink-0 text-[#b9d6b5]" aria-hidden="true" /><div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs leading-6 text-emerald-50/65">{text}</p></div></div>)}
        </aside>
      </section>

      <section aria-labelledby="walkthrough-title" className="mt-12 sm:mt-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="honor-eyebrow">A five-minute walkthrough</p><h2 id="walkthrough-title" className="mt-2 text-2xl font-semibold tracking-tight">Start with the work that matters.</h2></div><p className="max-w-sm text-sm leading-6 text-zinc-500">The workspace starts empty. No products, staff accounts or customer records have been added for the presentation.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {stops.map(stop => <a key={stop.number} href={stop.href} className="honor-pilot-stop group">
            <div className="mb-6 flex items-center justify-between"><span className="text-xs font-medium text-zinc-400">{stop.number}</span><stop.icon size={20} className="text-emerald-700" aria-hidden="true" /></div>
            <h3 className="text-lg font-semibold tracking-tight">{stop.title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{stop.detail}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">Explore this step <ArrowRight size={15} aria-hidden="true" /></span>
          </a>)}
        </div>
      </section>

      <section aria-labelledby="customer-preview-title" className="mt-8 grid gap-5 rounded-2xl border border-[#dce6df] bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
        <div className="flex gap-4"><ShoppingBag size={22} className="mt-1 shrink-0 text-emerald-700" aria-hidden="true" /><div><h2 id="customer-preview-title" className="text-lg font-semibold">The customer side, connected to the same stock.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Review the shop, signup and order entry screens. The shop is still opening soon; real accounts, reservations and payments await the service connection.</p></div></div>
        <a href="/" className="online-secondary">View customer shop <ArrowUpRight size={15} aria-hidden="true" /></a>
      </section>

      <section aria-labelledby="review-scope-title" className="mt-10 grid gap-6 border-t border-[#dce6df] pt-8 sm:grid-cols-2 sm:gap-12">
        <div><h2 id="review-scope-title" className="text-sm font-semibold">Ready to review</h2><p className="mt-3 text-sm leading-7 text-zinc-500">Inventory screens, empty states, product forms, receiving steps, movement history and the staff-permission layout. Preview changes stay in this browser and can be reset.</p></div>
        <div><h2 className="inline-flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-emerald-700" aria-hidden="true" />Before real business use</h2><p className="mt-3 text-sm leading-7 text-zinc-500">Connect the shared backend, activate the administrator, verify staff invitations and email delivery, then test checkout with the business’s payment provider. No live payments are collected here.</p></div>
      </section>
    </main>
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-3 px-5 py-8 text-xs text-zinc-500 sm:px-8"><span>Honor · Inventory, in order</span><span>One business. A first look at Honor.</span></footer>
  </div>;
}
