"use client";
import React, { useMemo, useState } from "react";
import { ExternalLink, Package, Search } from "lucide-react";
import { honorDeviceCategories, honorDeviceReferences, honorNigeriaListedModels, type HonorDeviceReference } from "./honorDeviceLibrary";
import { ProductImage } from "./StorefrontDesign";

/** Model browser only. Never sends stock, products or prices to any API. */
export function HonorDevicePicker({ onChoose }: { onChoose: (model: HonorDeviceReference) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All devices");
  const [imageOnly, setImageOnly] = useState(false);
  const results = useMemo(() => honorDeviceReferences.filter(model =>
    (category === "All devices" || category === model.category) &&
    (!imageOnly || !!model.imageUrl) &&
    model.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ).sort((a,b) => Number(honorNigeriaListedModels.has(b.name)) - Number(honorNigeriaListedModels.has(a.name)) || Number(!!b.imageUrl) - Number(!!a.imageUrl) || a.name.localeCompare(b.name)), [query, category, imageOnly]);

  return <section aria-label="Choose an HONOR device">
    <p className="text-sm leading-6 text-zinc-600">
      Choose a HONOR model to fill in its name and picture. Then set your own SKU,
      selling price and stock before offering it for sale.
      Choosing a model does not create stock or publish anything. Images need to be checked against the exact model before using them in the store.
    </p>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 px-3">
        <Search size={16} aria-hidden="true" />
        <input aria-label="Search HONOR devices" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm" value={query}
          placeholder="Search model..." onChange={e => setQuery(e.target.value)} />
      </label>
      <select aria-label="Device category" className="online-input max-w-44" value={category} onChange={e => setCategory(e.target.value)}>
        <option>All devices</option>{honorDeviceCategories.map(item => <option key={item}>{item}</option>)}
      </select>
    </div>
    <label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-600">
      <input type="checkbox" checked={imageOnly} onChange={e => setImageOnly(e.target.checked)} />
      Show matched pictures only
    </label>
    <p className="mt-4 text-xs text-zinc-500">
      {results.length} model references shown · {honorDeviceReferences.filter(model => !!model.imageUrl).length} matched picture links in the library.
      HONOR Nigeria-listed models appear first; this does not mean they are stocked in Ikeja.
    </p>
    <div className="mt-3 grid max-h-[430px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
      {results.map(model => <article key={model.id} className="flex min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-3">
        <div className="grid h-28 place-items-center overflow-hidden rounded-md bg-zinc-50 p-2">
          {model.imageUrl ? <ProductImage src={model.imageUrl} name={model.name} /> :
            <span className="flex flex-col items-center gap-2 text-center text-[11px] text-zinc-400"><Package size={24}/><span>Picture to be confirmed</span></span>}
        </div>
        <p className="mt-3 min-h-9 text-xs font-semibold leading-5 text-zinc-800">{model.name}</p>
        <p className="mb-2 text-[10px] text-zinc-500">{model.category}</p>
        <p className="mb-3 text-[10px] text-zinc-500">{model.imageUrl ? "Picture candidate — check before publishing" : "No confirmed photo yet"}{honorNigeriaListedModels.has(model.name) ? " · On HONOR Nigeria" : ""}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button type="button" className="online-secondary min-h-9 flex-1 px-2 py-1 text-xs" onClick={() => onChoose(model)}>Use model</button>
          <a aria-label={"Official HONOR listing for "+model.name} href={model.officialProductUrl || model.officialCatalogUrl}
             rel="noopener noreferrer" target="_blank" className="inline-flex min-h-9 items-center gap-1 text-xs text-zinc-600">
             <ExternalLink size={14} /> HONOR
          </a>
        </div>
      </article>)}
    </div>
    {!results.length && <p className="py-8 text-center text-sm text-zinc-500">No matching model. Try another name or category.</p>}
  </section>;
}
