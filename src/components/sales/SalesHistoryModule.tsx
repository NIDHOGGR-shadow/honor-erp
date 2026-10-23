/**
 * Honor — Sales History Module
 * Transaction audit trail, receipt lookup, warranty inspection, and void sale handling.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  formatNaira,
  formatDateTime,
  canVoidSale,
} from "../../utils/formatters";
import { Sale } from "../../types";
import {
  Receipt,
  Search,
  Filter,
  Eye,
  AlertOctagon,
  X,
  Printer,
  CheckCircle,
  Smartphone,
  Clock,
  ShieldAlert,
} from "lucide-react";

export const SalesHistoryModule: React.FC = () => {
  const {
    sales,
    locations,
    staffList,
    activeStaff,
    activeLocationId,
    selectedSaleId,
    setSelectedSaleId,
    voidSale,
  } = useApp();

  const [operationError, setOperationError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [voidReason, setVoidReason] = useState("");
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  const activeSale = selectedSaleId
    ? sales.find((s) => s.id === selectedSaleId)
    : null;

  // Filter sales
  const filteredSales = sales.filter((s) => {
    if (activeLocationId !== "ALL" && s.locationId !== activeLocationId)
      return false;
    if (statusFilter !== "ALL" && s.paymentStatus !== statusFilter)
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.receiptNumber.toLowerCase().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.customerPhone && s.customerPhone.includes(q)) ||
        s.lines.some((l) => l.imei?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleConfirmVoid = () => {
    if (!activeSale || !voidReason.trim()) return;
    try {
      voidSale(activeSale.id, voidReason);
      setOperationError("");
    } catch (e) {
      setOperationError((e as Error).message);
      return;
    }
    setIsVoidModalOpen(false);
    setVoidReason("");
  };

  const isUserAllowedToVoid = canVoidSale(activeStaff.role);

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
            Sales History & Receipts
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Audit trail of completed sales, warranty tracking by IMEI, and
            receipt lookup.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search receipt #, buyer name, phone, device IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 text-xs">
          {["ALL", "PAID", "VOIDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                statusFilter === st
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {st === "ALL" ? "All Sales" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Tender</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3">Grand Total</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    No sales records found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const loc = locations.find((l) => l.id === sale.locationId);
                  const isVoid = sale.paymentStatus === "VOIDED";

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSaleId(sale.id)}
                      className={`hover:bg-zinc-50/80 cursor-pointer transition-colors ${
                        isVoid ? "opacity-60 bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                        {sale.receiptNumber}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                        {formatDateTime(sale.timestamp)}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-zinc-900">
                        {sale.customerName || "Walk-in Customer"}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600">
                        {loc?.name || sale.locationId}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600">
                        {sale.staffName}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-700">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 font-semibold">
                          {sale.payments.map((p) => p.method).join(" + ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-zinc-800">
                        {sale.lines.length}
                      </td>
                      <td className="py-3.5 px-3 font-extrabold text-zinc-900 tabular-nums">
                        {formatNaira(sale.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isVoid
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Drawer Modal */}
      {activeSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-800" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Sale Receipt #{activeSale.receiptNumber}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {formatDateTime(activeSale.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSaleId(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Void Status Banner */}
              {activeSale.paymentStatus === "VOIDED" && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <div className="font-bold flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                    <span>This sale was voided</span>
                  </div>
                  <div className="text-[11px] mt-0.5">
                    Reason: {activeSale.voidReason}
                  </div>
                </div>
              )}

              {/* Customer & Location Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold">
                    Customer
                  </span>
                  <span className="font-bold text-zinc-900 text-xs">
                    {activeSale.customerName || "Walk-in Customer"}
                  </span>
                  {activeSale.customerPhone && (
                    <span className="block text-zinc-500 text-[11px]">
                      {activeSale.customerPhone}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold">
                    Branch & Cashier
                  </span>
                  <span className="font-bold text-zinc-900 text-xs">
                    {
                      locations.find((l) => l.id === activeSale.locationId)
                        ?.name
                    }
                  </span>
                  <span className="block text-zinc-500 text-[11px]">
                    {activeSale.staffName}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-zinc-50 font-bold text-zinc-700 border-b border-zinc-200">
                  Purchased Items ({activeSale.lines.length})
                </div>
                <div className="divide-y divide-zinc-100 p-2 space-y-1">
                  {activeSale.lines.map((line) => (
                    <div
                      key={line.id}
                      className="p-2 flex items-start justify-between"
                    >
                      <div>
                        <div className="font-bold text-zinc-900">
                          {line.variantName}
                        </div>
                        {line.imei && (
                          <div className="text-[11px] font-mono text-emerald-700 font-medium">
                            IMEI: {line.imei} · 1 Year Warranty Active
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">
                          {formatNaira(line.total)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Qty: {line.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial & VAT Breakdown */}
              <div className="p-3 bg-zinc-50 rounded-xl space-y-1.5">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal (VAT-Exclusive):</span>
                  <span className="font-mono">
                    {formatNaira(activeSale.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>VAT (7.5% derived line):</span>
                  <span className="font-mono font-semibold text-emerald-800">
                    {formatNaira(activeSale.vatAmount)}
                  </span>
                </div>
                {activeSale.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{formatNaira(activeSale.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-200 text-zinc-900">
                  <span>Grand Total (VAT-Inclusive):</span>
                  <span className="text-emerald-800">
                    {formatNaira(activeSale.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <div>
                {activeSale.paymentStatus !== "VOIDED" &&
                  isUserAllowedToVoid && (
                    <button
                      onClick={() => setIsVoidModalOpen(true)}
                      className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Void Sale</span>
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedSaleId(null)}
                  className="px-3 py-1.5 border border-zinc-200 text-zinc-700 rounded-xl font-semibold hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Sale Reason Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 text-rose-600">
              <AlertOctagon className="w-4 h-4" />
              <span>Confirm Void Sale #{activeSale?.receiptNumber}</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Voiding this sale reverses stock units, returns IMEI devices to
              IN_STOCK, and writes reverse movements to the ledger.
            </p>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Mandatory Void Reason
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Accidental double charge / Customer cancelled"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="px-3 py-1.5 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={!voidReason.trim()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
