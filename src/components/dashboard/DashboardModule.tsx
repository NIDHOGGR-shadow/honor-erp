import React, { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Search,
  Truck,
  AlertTriangle,
  PackageCheck,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  canAccessModule,
  canViewCostPrice,
  formatNaira,
  formatDateTime,
} from "../../utils/formatters";
import type { ModuleType } from "../../types";

export const DashboardModule: React.FC = () => {
  const {
    activeStaff,
    activeLocationId,
    stockLevels,
    stockMovements,
    stockUnits,
    transfers,
    variants,
    products,
    locations,
    setActiveModule,
    setSelectedProductId,
  } = useApp();
  const [tab, setTab] = useState<"attention" | "all">("attention");
  const [query, setQuery] = useState("");
  const scoped = stockLevels.filter(
    (row) => activeLocationId === "ALL" || row.locationId === activeLocationId,
  );
  const available = (row: (typeof scoped)[number]) =>
    Math.max(0, row.onHand - row.reserved);
  const attention = scoped.filter((row) => available(row) <= row.reorderLevel);
  const incoming = transfers.filter(
    (t) =>
      t.status === "DISPATCHED" &&
      (activeLocationId === "ALL" || t.toLocationId === activeLocationId),
  );
  const incomingUnits = incoming.reduce(
    (sum, t) => sum + t.lines.reduce((n, l) => n + l.quantitySent, 0),
    0,
  );
  const stockValue = scoped.reduce(
    (sum, row) =>
      sum +
      row.onHand *
        (variants.find((v) => v.id === row.variantId)?.costPrice || 0),
    0,
  );
  const deviceCount = stockUnits.filter(
    (u) =>
      u.status === "IN_STOCK" &&
      (activeLocationId === "ALL" || u.locationId === activeLocationId),
  ).length;
  const rows = (tab === "attention" ? attention : scoped)
    .filter((row) => {
      const v = variants.find((v) => v.id === row.variantId);
      return (
        !query ||
        `${v?.name} ${v?.sku} ${locations.find((l) => l.id === row.locationId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) => available(a) - available(b));
  const movements = [...stockMovements]
    .filter(
      (m) =>
        activeLocationId === "ALL" ||
        m.fromLocationId === activeLocationId ||
        m.toLocationId === activeLocationId,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 4);
  const actions: {
    module: ModuleType;
    title: string;
    detail: string;
    icon: typeof Boxes;
  }[] = [
    {
      module: "add-stock",
      title: "Receive stock",
      detail: "Record a delivery or opening stock",
      icon: ArrowDownLeft,
    },
    {
      module: "transfers",
      title: "Move stock",
      detail: "Dispatch and receive between locations",
      icon: Truck,
    },
    {
      module: "purchases",
      title: "Replenish stock",
      detail: "Create a supplier purchase order",
      icon: ClipboardList,
    },
    {
      module: "stock-movements",
      title: "View stock history",
      detail: "Trace receipts, sales and adjustments",
      icon: Boxes,
    },
  ];
  const openItem = (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (variant) {
      setSelectedProductId(variant.productId);
      setActiveModule("inventory");
    }
  };
  const metrics = [
    {
      label: "Available stock",
      value: scoped
        .reduce((sum, row) => sum + available(row), 0)
        .toLocaleString(),
      note: "Units on hand, excluding reserved",
      icon: Boxes,
      accent: false,
    },
    {
      label: "Needs replenishment",
      value: attention.length.toString(),
      note: `${attention.filter((row) => available(row) === 0).length} item/location pairs out of stock`,
      icon: AlertTriangle,
      accent: attention.length > 0,
    },
    {
      label: "Incoming stock",
      value: incomingUnits.toLocaleString(),
      note: `Across ${incoming.length} dispatched transfer${incoming.length === 1 ? "" : "s"}`,
      icon: Truck,
      accent: false,
    },
    {
      label: canViewCostPrice(activeStaff.role)
        ? "Stock value at cost"
        : "Serialised units",
      value: canViewCostPrice(activeStaff.role)
        ? formatNaira(stockValue)
        : deviceCount.toString(),
      note: canViewCostPrice(activeStaff.role)
        ? "Current item costs · demo estimate"
        : "Devices currently in stock",
      icon: PackageCheck,
      accent: false,
    },
  ];
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="honor-eyebrow mb-2">Inventory control</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Inventory overview
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            Know what you have, what is moving, and what needs your attention.
          </p>
        </div>
        <button
          className="honor-button"
          onClick={() =>
            setActiveModule(
              canAccessModule(activeStaff.role, "add-stock")
                ? "add-stock"
                : "inventory",
            )
          }
        >
          <ArrowDownLeft className="h-4 w-4" />
          {canAccessModule(activeStaff.role, "add-stock")
            ? "Receive stock"
            : "Browse inventory"}
        </button>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <section key={m.label} className="honor-panel p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-500">{m.label}</h2>
              <m.icon
                className={`h-4 w-4 ${m.accent ? "text-amber-600" : "text-emerald-700"}`}
              />
            </div>
            <p
              className={`my-4 text-3xl font-semibold tracking-tight tabular-nums ${m.accent ? "text-amber-700" : "text-zinc-900"}`}
            >
              {m.value}
            </p>
            <p className="text-xs leading-5 text-zinc-500">{m.note}</p>
          </section>
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="honor-panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div>
              <h2 className="text-base font-semibold">Stock health</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Review low stock before it becomes a missed sale.
              </p>
            </div>
            <button
              className="honor-text-button"
              onClick={() => setActiveModule("inventory")}
            >
              All inventory <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-zinc-100 px-6 py-4">
            <div
              className="flex gap-1 rounded-lg bg-zinc-100 p-1"
              role="group"
              aria-label="Stock health view"
            >
              {(["attention", "all"] as const).map((id) => (
                <button
                  key={id}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                  className={`min-h-9 rounded-md px-3 text-xs font-medium ${tab === id ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500"}`}
                >
                  {id === "attention"
                    ? `Needs attention (${attention.length})`
                    : "All stock"}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-48">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <input
                aria-label="Search stock health"
                placeholder="Search item or SKU"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/70 text-xs text-zinc-500">
                <tr>
                  <th className="px-6 py-4 font-medium" scope="col">
                    Item / location
                  </th>
                  <th className="px-4 py-4 text-right font-medium" scope="col">
                    Available
                  </th>
                  <th className="px-4 py-4 font-medium" scope="col">
                    Status
                  </th>
                  <th className="px-6 py-4" scope="col">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.slice(0, 6).map((row) => {
                  const v = variants.find((v) => v.id === row.variantId);
                  const prod = products.find((p) => p.id === v?.productId);
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/60">
                      <td className="min-w-52 px-6 py-5">
                        <p className="font-medium text-zinc-800">
                          {prod?.name || v?.name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {v?.sku} ·{" "}
                          {locations.find((l) => l.id === row.locationId)?.name}
                        </p>
                      </td>
                      <td className="px-4 py-5 text-right font-semibold tabular-nums">
                        {available(row)}
                        <span className="mt-1 block text-xs font-normal text-zinc-400">
                          min. {row.reorderLevel}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${available(row) === 0 ? "bg-rose-50 text-rose-700" : available(row) <= row.reorderLevel ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {available(row) === 0
                            ? "Out of stock"
                            : available(row) <= row.reorderLevel
                              ? "Low stock"
                              : "Healthy"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={() => openItem(row.variantId)}
                          aria-label={`Review ${v?.name || "item"} at ${locations.find((l) => l.id === row.locationId)?.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-emerald-700"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="p-12 text-center">
              {products.length === 0 ? <Boxes className="mx-auto mb-3 h-7 w-7 text-zinc-400" /> : <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-emerald-600" />}
              <p className="font-medium">
                {query ? "No matching items" : products.length === 0 ? "No products yet" : scoped.length === 0 ? "No stock recorded" : "Stock is looking healthy"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {query
                  ? "Try another item name or SKU."
                  : products.length === 0 ? "Your inventory starts empty. Add products when you are ready." : scoped.length === 0 ? "Receive stock to start tracking availability." : "There are no items below their reorder level in this view."}
              </p>
            </div>
          )}
          {rows.length > 6 && (
            <p className="border-t border-zinc-100 px-6 py-4 text-xs text-zinc-500">
              Showing 6 of {rows.length} item/location pairs. Open all inventory
              to review more.
            </p>
          )}
        </section>
        <aside className="space-y-6">
          <section className="honor-panel p-6">
            <h2 className="text-base font-semibold">Stock operations</h2>
            <p className="mb-5 mt-1 text-sm text-zinc-500">
              A clear next step.
            </p>
            <div className="space-y-2">
              {actions
                .filter((a) => canAccessModule(activeStaff.role, a.module))
                .map((a) => (
                  <button
                    key={a.module}
                    onClick={() => setActiveModule(a.module)}
                    className="group flex min-h-16 w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-zinc-50"
                  >
                    <a.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <span>
                      <span className="block text-sm font-medium">
                        {a.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">
                        {a.detail}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </section>
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Truck className="h-4 w-4" />
              Incoming transfers
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-800">
              {incoming.length
                ? `${incoming.length} transfer${incoming.length === 1 ? "" : "s"} waiting to be received. Confirm physical quantities before accepting.`
                : "No transfers are waiting to be received at this location."}
            </p>
            {incoming.length > 0 &&
              canAccessModule(activeStaff.role, "transfers") && (
                <button
                  className="honor-text-button mt-4"
                  onClick={() => setActiveModule("transfers")}
                >
                  Review transfers <ArrowRight className="h-4 w-4" />
                </button>
              )}
          </section>
        </aside>
      </div>
      <section className="honor-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <h2 className="text-base font-semibold">Recent stock activity</h2>
          <button
            className="honor-text-button"
            onClick={() => setActiveModule("stock-movements")}
          >
            Full movement history <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {movements.length === 0 && <p className="px-6 py-8 text-sm text-zinc-500">No stock movements yet.</p>}
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                  {m.quantityChange > 0 ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {variants.find((v) => v.id === m.variantId)?.name ||
                      "Stock movement"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {m.movementType.replaceAll("_", " ").toLowerCase()} ·{" "}
                    {m.referenceNumber}
                  </p>
                </div>
              </div>
              <div className="ml-12 text-right">
                <p
                  className={`text-sm font-semibold ${m.quantityChange > 0 ? "text-emerald-700" : "text-zinc-700"}`}
                >
                  {m.quantityChange > 0 ? "+" : ""}
                  {m.quantityChange} units
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatDateTime(m.timestamp)}
                </p>
              </div>
            </div>
          ))}
          {movements.length === 0 && (
            <p className="px-6 pb-6 text-sm text-zinc-500">
              Stock receipts, transfers and sales will appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
