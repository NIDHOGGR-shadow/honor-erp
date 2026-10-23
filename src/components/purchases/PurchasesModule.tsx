/**
 * Honor — Purchases Module
 * Purchase order creation, vendor tracking, and receiving workflow.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { formatNaira, formatDateTime } from "../../utils/formatters";
import { Purchase, PurchaseLine } from "../../types";
import {
  ShoppingBag,
  Plus,
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  X,
  ArrowRight,
  PackageCheck,
} from "lucide-react";

export const PurchasesModule: React.FC = () => {
  const {
    purchases,
    addPurchase,
    suppliers,
    locations,
    variants,
    products,
    activeStaff,
    activeLocationId,
    setActiveModule,
  } = useApp();

  const [operationError, setOperationError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPo, setSelectedPo] = useState<Purchase | null>(null);
  const [isNewPoModalOpen, setIsNewPoModalOpen] = useState(false);

  // New PO State
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || "");
  const [poLocationId, setPoLocationId] = useState(locations[0]?.id || "");
  const [poLines, setPoLines] = useState<
    { variantId: string; quantity: number; unitCost: number }[]
  >([
    {
      variantId: variants[0]?.id || "",
      quantity: 10,
      unitCost: variants[0]?.costPrice || 0,
    },
  ]);

  const filteredPurchases = purchases.filter((p) => {
    if (activeLocationId !== "ALL" && p.locationId !== activeLocationId)
      return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.purchaseNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup) return;

    const total = poLines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    const newPo: Purchase = {
      id: `po-${Date.now()}`,
      purchaseNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      locationId: poLocationId,
      status: "ORDERED",
      orderDate: new Date().toISOString(),
      expectedDate: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      totalAmount: total,
      paidAmount: 0,
      lines: poLines.map((l, idx) => {
        const v = variants.find((variant) => variant.id === l.variantId);
        return {
          id: `pol-${Date.now()}-${idx}`,
          variantId: l.variantId,
          variantName: v?.name || "Item",
          sku: v?.sku || "",
          quantityOrdered: l.quantity,
          quantityReceived: 0,
          unitCost: l.unitCost,
          totalCost: l.quantity * l.unitCost,
        };
      }),
    };

    // Save
    try {
      addPurchase(newPo);
      setOperationError("");
    } catch (e) {
      setOperationError((e as Error).message);
      return;
    }
    setIsNewPoModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {operationError && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {operationError}
        </p>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Purchase Orders & Supply Intake
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Procurement management with suppliers, incoming shipments, and
            receiving records.
          </p>
        </div>

        <button
          onClick={() => setIsNewPoModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search PO #, supplier name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 text-xs">
          {["ALL", "ORDERED", "RECEIVED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                statusFilter === st
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {st === "ALL" ? "All Orders" : st}
            </button>
          ))}
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Destination Branch</th>
                <th className="py-3 px-3">Order Date</th>
                <th className="py-3 px-3">Total Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No purchase orders found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => {
                  const loc = locations.find((l) => l.id === po.locationId);
                  const isReceived = po.status === "RECEIVED";

                  return (
                    <tr
                      key={po.id}
                      onClick={() => setSelectedPo(po)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                        {po.purchaseNumber}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-zinc-900">
                        {po.supplierName}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600">
                        {loc?.name || po.locationId}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                        {formatDateTime(po.orderDate)}
                      </td>
                      <td className="py-3.5 px-3 font-extrabold text-zinc-900 tabular-nums">
                        {formatNaira(po.totalAmount)}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isReceived
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isReceived ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModule("add-stock");
                            }}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                          >
                            Receive Goods
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-xs font-medium">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {isNewPoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Create Purchase Order
                </h3>
                <p className="text-xs text-zinc-500">
                  Order inventory from authorized distributors
                </p>
              </div>
              <button
                onClick={() => setIsNewPoModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Select Supplier
                  </label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Destination Location
                  </label>
                  <select
                    value={poLocationId}
                    onChange={(e) => setPoLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.isWarehouse ? "(Warehouse)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Select Variant & Quantity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={poLines[0]?.variantId}
                      onChange={(e) => {
                        const v = variants.find(
                          (item) => item.id === e.target.value,
                        );
                        setPoLines([
                          {
                            variantId: e.target.value,
                            quantity: poLines[0]?.quantity || 1,
                            unitCost: v?.costPrice || 0,
                          },
                        ]);
                      }}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white"
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={1}
                      value={poLines[0]?.quantity}
                      onChange={(e) =>
                        setPoLines([
                          { ...poLines[0], quantity: Number(e.target.value) },
                        ])
                      }
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white"
                      placeholder="Qty"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewPoModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
