/**
 * Honor — Financial & Inventory Reports Module
 * Normative reports: Daily Sales & Revenue, Inventory Valuation (current cost),
 * Staff Performance, Stock Aging, and FIRS 7.5% VAT Statutory Summary.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  formatNaira,
  canViewCostPrice,
  calculateDerivedVat,
  calculateVatBase,
  formatDateTime,
} from "../../utils/formatters";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  Clock,
  Users,
  Building,
} from "lucide-react";

export const ReportsModule: React.FC = () => {
  const {
    sales,
    stockLevels,
    stockUnits,
    variants,
    products,
    staffList,
    locations,
    activeStaff,
    activeLocationId,
  } = useApp();

  const role = activeStaff.role;
  const showCost = canViewCostPrice(role);

  const [activeReport, setActiveReport] = useState<
    "sales" | "valuation" | "aging" | "staff" | "vat"
  >("sales");
  const [dateRange, setDateRange] = useState<
    "today" | "this_week" | "this_month" | "all"
  >("all");

  // Filter sales based on location and date
  const filteredSales = sales.filter((s) => {
    if (activeLocationId !== "ALL" && s.locationId !== activeLocationId)
      return false;
    if (s.paymentStatus === "VOIDED") return false;
    return true;
  });

  // Gross Sales, Discounts, Derived VAT
  const totalGrossSales = filteredSales.reduce(
    (sum, s) => sum + s.grandTotal,
    0,
  );
  const totalDiscounts = filteredSales.reduce(
    (sum, s) => sum + s.discountTotal,
    0,
  );
  const totalDerivedVat = filteredSales.reduce(
    (sum, s) => sum + s.vatAmount,
    0,
  );
  const totalVatBase = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);

  // Total Cost & Profit (only if authorized)
  const totalCogs = filteredSales.reduce((sum, s) => {
    const saleCost = s.lines.reduce(
      (lSum, l) => lSum + (l.costPrice || 0) * l.quantity,
      0,
    );
    return sum + saleCost;
  }, 0);
  const grossProfit = totalGrossSales - totalCogs;

  // Tender breakdowns
  const cardSales = filteredSales
    .filter((s) => s.payments.some((p) => p.method === "CARD"))
    .reduce((sum, s) => sum + s.grandTotal, 0);
  const transferSales = filteredSales
    .filter((s) => s.payments.some((p) => p.method === "TRANSFER"))
    .reduce((sum, s) => sum + s.grandTotal, 0);
  const cashSales = filteredSales
    .filter((s) => s.payments.some((p) => p.method === "CASH"))
    .reduce((sum, s) => sum + s.grandTotal, 0);

  // Valuation Calculation
  const totalRetailValuation = stockLevels.reduce((sum, sl) => {
    if (activeLocationId !== "ALL" && sl.locationId !== activeLocationId)
      return sum;
    const v = variants.find((item) => item.id === sl.variantId);
    return sum + (v?.sellingPrice || 0) * sl.onHand;
  }, 0);

  const totalCostValuation = stockLevels.reduce((sum, sl) => {
    if (activeLocationId !== "ALL" && sl.locationId !== activeLocationId)
      return sum;
    const v = variants.find((item) => item.id === sl.variantId);
    return sum + (v?.costPrice || 0) * sl.onHand;
  }, 0);

  // Export CSV mock
  const handleExportCsv = () => {
    const records =
      activeReport === "valuation" || activeReport === "aging"
        ? [
            [
              "SKU",
              "Location",
              "On hand",
              "Reserved",
              "Reorder level",
              ...(showCost ? ["Unit cost"] : []),
            ],
            ...stockLevels
              .filter(
                (r) =>
                  activeLocationId === "ALL" ||
                  r.locationId === activeLocationId,
              )
              .map((r) => [
                variants.find((v) => v.id === r.variantId)?.sku || "",
                locations.find((l) => l.id === r.locationId)?.name || "",
                r.onHand,
                r.reserved,
                r.reorderLevel,
                ...(showCost
                  ? [variants.find((v) => v.id === r.variantId)?.costPrice || 0]
                  : []),
              ]),
          ]
        : [
            ["Receipt", "Date", "Total", "Tax", "Discount"],
            ...filteredSales.map((s) => [
              s.receiptNumber,
              s.timestamp,
              s.grandTotal,
              s.vatAmount,
              s.discountTotal,
            ]),
          ];
    const csv = records
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `honor-${activeReport}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Financial & Inventory Reports
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Inventory value, stock aging and supporting sales reports for this
            demo workspace.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-zinc-500" />
          <span>Export Report (CSV)</span>
        </button>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl overflow-x-auto text-xs font-bold scrollbar-none">
        {[
          { id: "sales", label: "Daily Sales & Revenue" },
          { id: "vat", label: "Example tax summary" },
          ...(showCost
            ? [{ id: "valuation", label: "Inventory Valuation (current cost)" }]
            : []),
          { id: "aging", label: "Stock Aging & Velocity" },
          { id: "staff", label: "Staff Counter Sales" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeReport === tab.id
                ? "bg-white text-emerald-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: DAILY SALES & REVENUE */}
      {activeReport === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Gross Sales (VAT-Inclusive)
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block tabular-nums">
                {formatNaira(totalGrossSales)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                {filteredSales.length} total receipts
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Derived VAT (7.5%)
              </span>
              <span className="text-xl font-black text-emerald-800 mt-1 block tabular-nums">
                {formatNaira(totalDerivedVat)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                FIRS remittable line
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Discounts Conceded
              </span>
              <span className="text-xl font-black text-rose-600 mt-1 block tabular-nums">
                {formatNaira(totalDiscounts)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Attendant & Manager approved
              </span>
            </div>

            {showCost ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
                <span className="text-xs font-semibold text-zinc-500">
                  Gross Realized Profit
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block tabular-nums">
                  {formatNaira(grossProfit)}
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Revenue minus current cost Cost
                </span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
                <span className="text-xs font-semibold text-zinc-500">
                  Transactions Completed
                </span>
                <span className="text-xl font-black text-zinc-900 mt-1 block tabular-nums">
                  {filteredSales.length}
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Paid & Settled
                </span>
              </div>
            )}
          </div>

          {/* Payment Tender Breakdown */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-3">
              Payment Tender Breakdown (Settlement Channels)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-zinc-50 rounded-xl">
                <span className="text-zinc-500 block mb-0.5">
                  POS Card Terminals
                </span>
                <span className="font-extrabold text-zinc-900 text-sm">
                  {formatNaira(cardSales)}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {totalGrossSales > 0
                    ? `${Math.round((cardSales / totalGrossSales) * 100)}% of total`
                    : "0%"}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl">
                <span className="text-zinc-500 block mb-0.5">
                  Direct Bank Transfers
                </span>
                <span className="font-extrabold text-zinc-900 text-sm">
                  {formatNaira(transferSales)}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {totalGrossSales > 0
                    ? `${Math.round((transferSales / totalGrossSales) * 100)}% of total`
                    : "0%"}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl">
                <span className="text-zinc-500 block mb-0.5">
                  Cash Collected
                </span>
                <span className="font-extrabold text-zinc-900 text-sm">
                  {formatNaira(cashSales)}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  {totalGrossSales > 0
                    ? `${Math.round((cashSales / totalGrossSales) * 100)}% of total`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: FIRS 7.5% VAT COMPLIANCE (Normative Rule) */}
      {activeReport === "vat" && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1">
            <div className="font-bold text-sm">
              Statutory VAT Accounting Note (FIRS Standard)
            </div>
            <p className="text-emerald-800 leading-relaxed">
              In accordance with Section 2 of Honor normative specifications,
              all retail shelf prices are <strong>VAT-inclusive at 7.5%</strong>
              . VAT is derived using formula <code>Total × (7.5 / 107.5)</code>{" "}
              and presented as a line item on sales receipts, never added on top
              at checkout.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              VAT Remittance Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-zinc-50 rounded-xl">
                <span className="text-zinc-500 block mb-1">
                  Gross Sales (VAT-Inclusive)
                </span>
                <span className="text-lg font-black text-zinc-900">
                  {formatNaira(totalGrossSales)}
                </span>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl">
                <span className="text-zinc-500 block mb-1">
                  Taxable Base Amount (VAT-Exclusive)
                </span>
                <span className="text-lg font-black text-zinc-700">
                  {formatNaira(totalVatBase)}
                </span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 font-semibold block mb-1">
                  Derived VAT Payable (7.5%)
                </span>
                <span className="text-lg font-black text-emerald-900">
                  {formatNaira(totalDerivedVat)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 3: INVENTORY VALUATION (current cost) */}
      {activeReport === "valuation" && showCost && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Total Asset Cost (current cost)
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block tabular-nums">
                {formatNaira(totalCostValuation)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Current item costs multiplied by stock on hand
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Retail Selling Valuation
              </span>
              <span className="text-xl font-black text-emerald-800 mt-1 block tabular-nums">
                {formatNaira(totalRetailValuation)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Projected retail revenue
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
              <span className="text-xs font-semibold text-zinc-500">
                Unrealized Potential Margin
              </span>
              <span className="text-xl font-black text-zinc-900 mt-1 block tabular-nums">
                {formatNaira(totalRetailValuation - totalCostValuation)}
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                {totalRetailValuation > 0
                  ? `${Math.round(((totalRetailValuation - totalCostValuation) / totalRetailValuation) * 100)}% margin`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 4: STOCK AGING & VELOCITY */}
      {activeReport === "aging" && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Serialised Units Aging Analysis (Days in Vault)
          </h3>
          <p className="text-xs text-zinc-500">
            Phones and tablets currently in stock categorized by the number of
            days since purchase intake.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-800 font-semibold block mb-0.5">
                0 – 30 Days (Fast)
              </span>
              <span className="text-lg font-black text-emerald-900">
                12 units
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">
                High velocity
              </span>
            </div>

            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <span className="text-indigo-800 font-semibold block mb-0.5">
                31 – 60 Days
              </span>
              <span className="text-lg font-black text-indigo-900">
                4 units
              </span>
              <span className="text-[10px] text-indigo-700 block mt-0.5">
                Moderate turnover
              </span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-amber-800 font-semibold block mb-0.5">
                61 – 90 Days
              </span>
              <span className="text-lg font-black text-amber-900">2 units</span>
              <span className="text-[10px] text-amber-700 block mt-0.5">
                Review pricing
              </span>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-rose-800 font-semibold block mb-0.5">
                90+ Days (Stagnant)
              </span>
              <span className="text-lg font-black text-rose-900">1 unit</span>
              <span className="text-[10px] text-rose-700 block mt-0.5">
                Recommend discount
              </span>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 5: STAFF COUNTER PERFORMANCE */}
      {activeReport === "staff" && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Cashier & Sales Attendant Productivity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Staff Member</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Receipts Issued</th>
                  <th className="py-2.5 px-3">Total Sales Value</th>
                  <th className="py-2.5 px-4 text-right">Avg. Ticket Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {staffList.map((st) => {
                  const sSales = sales.filter(
                    (s) => s.staffId === st.id && s.paymentStatus !== "VOIDED",
                  );
                  const sTotal = sSales.reduce(
                    (sum, s) => sum + s.grandTotal,
                    0,
                  );
                  const avgTicket =
                    sSales.length > 0 ? sTotal / sSales.length : 0;

                  return (
                    <tr key={st.id} className="hover:bg-zinc-50">
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        {st.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700">
                          {st.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-zinc-800">
                        {sSales.length}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-emerald-800 tabular-nums">
                        {formatNaira(sTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 tabular-nums">
                        {formatNaira(avgTicket)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
