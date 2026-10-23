/**
 * Honor — Stock Movements Ledger
 * The central immutable ledger for all inventory events.
 * Stock is never edited directly; this table is the complete audit trail.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  canViewCostPrice,
  formatNaira,
  formatDateTime,
} from "../../utils/formatters";
import { MovementType, StockMovement } from "../../types";
import {
  ArrowLeftRight,
  Search,
  Filter,
  Download,
  Calendar,
  MapPin,
  X,
  ShieldCheck,
  FileText,
} from "lucide-react";

export const StockMovementsModule: React.FC = () => {
  const {
    stockMovements,
    variants,
    products,
    locations,
    staffList,
    activeStaff,
    activeLocationId,
  } = useApp();

  const role = activeStaff.role;
  const showCost = canViewCostPrice(role);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedMovement, setSelectedMovement] =
    useState<StockMovement | null>(null);

  // Filter movements
  const filteredMovements = stockMovements.filter((m) => {
    if (activeLocationId !== "ALL") {
      if (
        m.fromLocationId !== activeLocationId &&
        m.toLocationId !== activeLocationId
      ) {
        return false;
      }
    }
    if (selectedType !== "ALL" && m.movementType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const variant = variants.find((v) => v.id === m.variantId);
      return (
        m.referenceNumber.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (variant && variant.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const movementTypes: { id: string; label: string }[] = [
    { id: "ALL", label: "All Event Types" },
    { id: "SALE", label: "POS Sales" },
    { id: "PURCHASE_RECEIPT", label: "Purchase Receipts" },
    { id: "TRANSFER_DISPATCH", label: "Transfer Dispatches" },
    { id: "TRANSFER_RECEIVE", label: "Transfer Receipts" },
    { id: "RETURN", label: "Customer Returns" },
    { id: "ADJUSTMENT", label: "Stock Adjustments" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-zinc-900 tracking-tight">
              Stock Movements Ledger
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
              Immutable Ledger
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Every increase or decrease in stock writes a non-editable record
            with staff ID, reference number, and timestamp.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter by reference #, reason, variant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:ring-1 focus:ring-emerald-700"
            >
              {movementTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Movement Type</th>
                <th className="py-3 px-3">Reference #</th>
                <th className="py-3 px-3">Variant / Item</th>
                <th className="py-3 px-3">From → To Location</th>
                <th className="py-3 px-3 text-center">Qty Change</th>
                {showCost && <th className="py-3 px-3">Unit Cost</th>}
                <th className="py-3 px-4">Staff / Approver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    No ledger records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const variant = variants.find((v) => v.id === m.variantId);
                  const fromLoc = locations.find(
                    (l) => l.id === m.fromLocationId,
                  );
                  const toLoc = locations.find((l) => l.id === m.toLocationId);
                  const staff = staffList.find((s) => s.id === m.staffId);
                  const isPositive = m.quantityChange > 0;

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMovement(m)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {formatDateTime(m.timestamp)}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.movementType === "SALE"
                              ? "bg-indigo-100 text-indigo-800"
                              : m.movementType === "PURCHASE_RECEIPT"
                                ? "bg-emerald-100 text-emerald-800"
                                : m.movementType === "RETURN"
                                  ? "bg-amber-100 text-amber-800"
                                  : m.movementType === "ADJUSTMENT"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-zinc-900">
                        {m.referenceNumber}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-zinc-900">
                        {variant?.name || "Item"}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600 text-[11px]">
                        {fromLoc ? fromLoc.name : "—"} →{" "}
                        {toLoc ? toLoc.name : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-center tabular-nums font-extrabold text-sm">
                        <span
                          className={
                            isPositive ? "text-emerald-700" : "text-rose-600"
                          }
                        >
                          {isPositive
                            ? `+${m.quantityChange}`
                            : m.quantityChange}
                        </span>
                      </td>
                      {showCost && (
                        <td className="py-3.5 px-3 font-mono text-zinc-600 tabular-nums">
                          {m.costPrice ? formatNaira(m.costPrice) : "—"}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-zinc-700 text-xs">
                        <div className="font-semibold">
                          {staff?.name || "Staff"}
                        </div>
                        {m.approverStaffId && (
                          <div className="text-[10px] text-amber-700 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Approved by Manager</span>
                          </div>
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

      {/* Movement Detail Drawer Modal */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Stock Ledger Entry Details
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  ID: {selectedMovement.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedMovement(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <span className="text-zinc-400 block mb-0.5">
                    Reference Document
                  </span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    {selectedMovement.referenceNumber}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <span className="text-zinc-400 block mb-0.5">Event Type</span>
                  <span className="font-bold text-zinc-900">
                    {selectedMovement.movementType}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Timestamp:</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formatDateTime(selectedMovement.timestamp)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Quantity Changed:</span>
                  <span
                    className={`font-bold tabular-nums text-sm ${
                      selectedMovement.quantityChange > 0
                        ? "text-emerald-700"
                        : "text-rose-600"
                    }`}
                  >
                    {selectedMovement.quantityChange > 0
                      ? `+${selectedMovement.quantityChange}`
                      : selectedMovement.quantityChange}
                  </span>
                </div>
                {showCost && selectedMovement.costPrice && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Unit Cost:</span>
                    <span className="font-bold text-zinc-900">
                      {formatNaira(selectedMovement.costPrice)}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl">
                <span className="text-zinc-400 block mb-1">Reason / Notes</span>
                <p className="text-zinc-800 font-medium">
                  {selectedMovement.reason}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 flex justify-end bg-zinc-50/50">
              <button
                onClick={() => setSelectedMovement(null)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
