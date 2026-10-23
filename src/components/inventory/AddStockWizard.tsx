/**
 * Honor — Add Stock Wizard
 * Four normative paths:
 * 1. Purchase Receipt (link to PO, scan IMEIs or accessories, set cost price, assign location)
 * 2. Customer Return (find original sale by receipt or IMEI, select condition)
 * 3. Transfer-In (accept incoming transfer)
 * 4. Manual Adjustment (requires reason; positive adjustments require Manager PIN approval)
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { canViewCostPrice, formatNaira } from "../../utils/formatters";
import { ManagerPinModal } from "../common/ManagerPinModal";
import { DeviceCondition } from "../../types";
import {
  PlusCircle,
  ShoppingBag,
  RotateCcw,
  Truck,
  Sliders,
  CheckCircle2,
  Smartphone,
  Boxes,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

type WizardMode = "SELECT" | "PURCHASE" | "RETURN" | "TRANSFER" | "ADJUSTMENT";

export const AddStockWizard: React.FC = () => {
  const {
    purchases,
    receivePurchase,
    locations,
    products,
    variants,
    sales,
    stockUnits,
    activeStaff,
    activeLocationId,
    transfers,
    receiveTransfer,
    createAdjustment,
    setActiveModule,
  } = useApp();

  const [operationError, setOperationError] = useState("");
  const [receiptVariant, setReceiptVariant] = useState("");
  const [mode, setMode] = useState<WizardMode>("SELECT");
  const [successMessage, setSuccessMessage] = useState("");

  // 1. Purchase Receipt State
  const [selectedPoId, setSelectedPoId] = useState("");
  const [poImeis, setPoImeis] = useState<string>("");
  const [poQty, setPoQty] = useState<number>(1);

  // 2. Customer Return State
  const [returnSearchQuery, setReturnSearchQuery] = useState("");
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<any>(null);
  const [selectedReturnLine, setSelectedReturnLine] = useState<any>(null);
  const [returnCondition, setReturnCondition] =
    useState<DeviceCondition>("OPEN_BOX");
  const [returnReason, setReturnReason] = useState(
    "Customer changed mind within warranty",
  );

  // 3. Manual Adjustment State
  const [adjVariantId, setAdjVariantId] = useState("");
  const [adjLocationId, setAdjLocationId] = useState(
    locations[0]?.id || "loc-ikeja",
  );
  const [adjQtyDelta, setAdjQtyDelta] = useState<number>(1);
  const [adjReason, setAdjReason] = useState("Opening stock discrepancy count");
  const [adjImei, setAdjImei] = useState("");
  const [adjCostPrice, setAdjCostPrice] = useState("0");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Unreceived Purchases
  const pendingPurchases = purchases.filter(
    (p) => p.status === "ORDERED" || p.status === "PARTIALLY_RECEIVED",
  );

  // Pending Incoming Transfers
  const pendingTransfers = transfers.filter((t) => t.status === "DISPATCHED");

  // Handle PO Receipt submit
  const handleReceivePo = (e: React.FormEvent) => {
    e.preventDefault();
    const po = purchases.find((p) => p.id === selectedPoId);
    if (!po) return;

    // Parse IMEIs if provided
    const imeiList = poImeis
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const line =
      po.lines.find((l) => l.variantId === receiptVariant) || po.lines[0];
    if (!line) return;
    const product = products.find(
      (p) => p.id === variants.find((v) => v.id === line.variantId)?.productId,
    );
    const unitsToReceive = [
      {
        variantId: line.variantId,
        imeis: product?.trackingType === "SERIALISED" ? imeiList : [],
        quantity: poQty,
      },
    ];
    try {
      receivePurchase(po.id, unitsToReceive);
      setOperationError("");
    } catch (e) {
      setOperationError((e as Error).message);
      return;
    }
    setSuccessMessage(
      `Purchase Order #${po.purchaseNumber} successfully received and ledger movements updated.`,
    );
    setMode("SELECT");
    setSelectedPoId("");
    setPoImeis("");
  };

  // Handle Return submit
  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForReturn || !selectedReturnLine) return;

    setOperationError(
      "Line-level returns are being implemented. Use an approved sale reversal in Sales history for a complete reversal.",
    );
    return;
  };

  // Handle Adjustment Submit (requires manager PIN if staff is sales or inventory)
  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjVariantId) return;

    // If active staff is sales or inventory, require elevation PIN
    if (activeStaff.role === "SALES" || activeStaff.role === "INVENTORY") {
      setIsPinModalOpen(true);
    } else {
      executeAdjustment(activeStaff.name, activeStaff.id);
    }
  };

  const executeAdjustment = (approverName: string, approverId: string) => {
    const variant = variants.find((v) => v.id === adjVariantId);
    const product = products.find((p) => p.id === variant?.productId);
    const isSerialised = product?.trackingType === "SERIALISED";

    try {
      createAdjustment(
        adjVariantId,
        adjLocationId,
        adjQtyDelta,
        adjReason,
        approverId,
        isSerialised && adjQtyDelta > 0
          ? {
              imei1: adjImei.trim(),
              condition: "BRAND_NEW",
              costPrice: Number(adjCostPrice) || variant?.costPrice || 0,
            }
          : undefined,
      );
    } catch (e) {
      setOperationError((e as Error).message);
      return;
    }
    setOperationError("");
    setSuccessMessage(
      `Stock adjustment of ${adjQtyDelta > 0 ? `+${adjQtyDelta}` : adjQtyDelta} units executed with approval from ${approverName}.`,
    );
    setMode("SELECT");
    setAdjImei("");
    setAdjVariantId("");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      {operationError && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {operationError}
        </p>
      )}
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-zinc-900 tracking-tight">
          Add Stock Wizard
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          The single entry point for bringing goods into the business. Stock is
          never directly edited; every intake writes an immutable ledger
          movement.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 text-xs text-emerald-950 font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Method Selection Cards */}
      {mode === "SELECT" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("PURCHASE")}
            className="p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-emerald-600 text-left transition-all group shadow-xs hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 group-hover:text-emerald-800">
              1. Purchase Order Receipt
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Receive vendor deliveries against existing purchase orders, scan
              physical device IMEIs, and update branch stock.
            </p>
            <div className="mt-3 text-xs font-bold text-emerald-800 flex items-center gap-1">
              <span>{pendingPurchases.length} PO(s) awaiting receipt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => setMode("RETURN")}
            className="p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-indigo-600 text-left transition-all group shadow-xs hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-800">
              2. Customer Return
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Find original sales receipt or device IMEI, verify warranty
              condition, and return physical device to stock vault.
            </p>
            <div className="mt-3 text-xs font-bold text-indigo-700 flex items-center gap-1">
              <span>Restock with condition grade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => setMode("TRANSFER")}
            className="p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-emerald-600 text-left transition-all group shadow-xs hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 group-hover:text-emerald-800">
              3. Incoming Branch Transfer
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Inspect dispatched stock from central warehouse or another retail
              branch and accept units into local inventory.
            </p>
            <div className="mt-3 text-xs font-bold text-emerald-800 flex items-center gap-1">
              <span>{pendingTransfers.length} incoming transfer(s)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button
            onClick={() => setMode("ADJUSTMENT")}
            className="p-5 rounded-2xl border-2 border-zinc-200 bg-white hover:border-amber-600 text-left transition-all group shadow-xs hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 group-hover:text-amber-800">
              4. Manual Stock Adjustment
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Audited reconciliation for opening stock, damages, or count
              corrections. Requires reason and Manager PIN authorization.
            </p>
            <div className="mt-3 text-xs font-bold text-amber-800 flex items-center gap-1">
              <span>Manager approval required</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* 1. PURCHASE ORDER RECEIPT FORM */}
      {mode === "PURCHASE" && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-bold text-zinc-900">
              Receive Goods from Purchase Order
            </h3>
            <button
              onClick={() => setMode("SELECT")}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleReceivePo} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Select Purchase Order
              </label>
              <select
                required
                value={selectedPoId}
                onChange={(e) => {
                  setSelectedPoId(e.target.value);
                  setReceiptVariant("");
                  setPoImeis("");
                  setPoQty(1);
                }}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700"
              >
                <option value="">-- Choose an open PO --</option>
                {pendingPurchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchaseNumber} · {p.supplierName} (
                    {locations.find((l) => l.id === p.locationId)?.name}) —{" "}
                    {formatNaira(p.totalAmount)}
                  </option>
                ))}
              </select>
            </div>

            {selectedPoId && (
              <>
                <label className="block text-sm font-medium">
                  Item to receive
                  <select
                    aria-label="Item to receive"
                    value={
                      receiptVariant ||
                      purchases.find((p) => p.id === selectedPoId)?.lines[0]
                        ?.variantId ||
                      ""
                    }
                    onChange={(e) => setReceiptVariant(e.target.value)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3"
                  >
                    {purchases
                      .find((p) => p.id === selectedPoId)
                      ?.lines.map((l) => (
                        <option key={l.id} value={l.variantId}>
                          {l.variantName} ·{" "}
                          {l.quantityOrdered - l.quantityReceived} remaining
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Quantity received
                  <input
                    aria-label="Quantity received"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={poQty}
                    onChange={(e) => setPoQty(Number(e.target.value))}
                    className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 px-3"
                  />
                </label>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs">
                  <div className="font-bold text-zinc-900 mb-1">
                    Ordered Line Items:
                  </div>
                  {purchases
                    .find((p) => p.id === selectedPoId)
                    ?.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex justify-between py-1 text-zinc-600"
                      >
                        <span>{line.variantName}</span>
                        <span className="font-bold">
                          {line.quantityOrdered} ordered @{" "}
                          {formatNaira(line.unitCost)}
                        </span>
                      </div>
                    ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Scan or Paste Serial Numbers / IMEIs (One per line)
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">
                    For serialised devices, enter exactly 15 digits for each
                    phone received.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="358912345678901&#10;358912345678902"
                    value={poImeis}
                    onChange={(e) => setPoImeis(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-xs border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setMode("SELECT")}
                className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedPoId}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Receipt & Write Ledger
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. CUSTOMER RETURN FORM */}
      {mode === "RETURN" && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-bold text-zinc-900">
              Process Customer Return & Restock
            </h3>
            <button
              onClick={() => setMode("SELECT")}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Find Sale by Receipt Number or 15-Digit IMEI
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. HNR-2026-10492 or 3589..."
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = returnSearchQuery.trim().toLowerCase();
                    const match = sales.find(
                      (s) =>
                        s.receiptNumber.toLowerCase().includes(q) ||
                        s.lines.some((l) => l.imei?.toLowerCase().includes(q)),
                    );
                    setSelectedSaleForReturn(match || null);
                    if (match) setSelectedReturnLine(match.lines[0]);
                  }}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold"
                >
                  Search
                </button>
              </div>
            </div>

            {selectedSaleForReturn && (
              <form
                onSubmit={handleProcessReturn}
                className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3"
              >
                <div className="text-xs font-bold text-zinc-900">
                  Sale #{selectedSaleForReturn.receiptNumber} —{" "}
                  {selectedSaleForReturn.customerName || "Walk-in"}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Select Item to Return
                  </label>
                  <select
                    value={selectedReturnLine?.id}
                    onChange={(e) => {
                      const l = selectedSaleForReturn.lines.find(
                        (item: any) => item.id === e.target.value,
                      );
                      setSelectedReturnLine(l);
                    }}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-white"
                  >
                    {selectedSaleForReturn.lines.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.variantName}{" "}
                        {l.imei ? `(IMEI: ${l.imei})` : `(Qty: ${l.quantity})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Condition Upon Return
                    </label>
                    <select
                      value={returnCondition}
                      onChange={(e) =>
                        setReturnCondition(e.target.value as DeviceCondition)
                      }
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-white"
                    >
                      <option value="OPEN_BOX">Open Box (Resalable)</option>
                      <option value="BRAND_NEW">Brand New (Unopened)</option>
                      <option value="UK_USED">Used Condition</option>
                      <option value="REFURBISHED">Refurbished</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Reason for Return
                    </label>
                    <input
                      type="text"
                      required
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Accept Return & Restock Unit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. TRANSFER-IN FORM */}
      {mode === "TRANSFER" && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-bold text-zinc-900">
              Accept Incoming Branch Transfer
            </h3>
            <button
              onClick={() => setMode("SELECT")}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-3">
            {pendingTransfers.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                No transfers currently in transit.
              </div>
            ) : (
              pendingTransfers.map((trf) => (
                <div
                  key={trf.id}
                  className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-zinc-900 font-mono">
                      Transfer #{trf.transferNumber}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      From:{" "}
                      <strong>
                        {
                          locations.find((l) => l.id === trf.fromLocationId)
                            ?.name
                        }
                      </strong>{" "}
                      → To:{" "}
                      <strong>
                        {locations.find((l) => l.id === trf.toLocationId)?.name}
                      </strong>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {trf.lines.length} items dispatched
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        receiveTransfer(trf.id);
                        setOperationError("");
                      } catch (e) {
                        setOperationError((e as Error).message);
                        return;
                      }
                      setSuccessMessage(
                        `Transfer #${trf.transferNumber} received and added to local branch inventory.`,
                      );
                      setMode("SELECT");
                    }}
                    className="px-3 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800"
                  >
                    Verify & Receive
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. MANUAL ADJUSTMENT FORM */}
      {mode === "ADJUSTMENT" && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Manual Stock Adjustment
              </h3>
              <p className="text-xs text-zinc-500">
                Audited modification of stock levels. Reason is mandatory;
                approvals are logged in the audit ledger.
              </p>
            </div>
            <button
              onClick={() => setMode("SELECT")}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Select Variant / Item
                </label>
                <select
                  required
                  value={adjVariantId}
                  onChange={(e) => setAdjVariantId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="">-- Choose product variant --</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (
                      {products.find((p) => p.id === v.productId)?.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Target Location
                </label>
                <select
                  value={adjLocationId}
                  onChange={(e) => setAdjLocationId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.isWarehouse ? "(Warehouse)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Quantity Delta (Positive for additions, negative for
                  write-offs)
                </label>
                <input
                  type="number"
                  required
                  value={adjQtyDelta}
                  onChange={(e) => setAdjQtyDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Mandatory Reason
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physical stock count opening variance"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* If product is serialised and delta > 0, ask for IMEI */}
            {adjVariantId &&
              adjQtyDelta > 0 &&
              products.find(
                (p) =>
                  p.id ===
                  variants.find((v) => v.id === adjVariantId)?.productId,
              )?.trackingType === "SERIALISED" && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Physical Device IMEI (15 Digits)
                  </label>
                  <input
                    type="text"
                    placeholder="3589..."
                    value={adjImei}
                    onChange={(e) => setAdjImei(e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-xs bg-white font-mono"
                  />
                </div>
              )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setMode("SELECT")}
                className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <span>Submit Stock Adjustment</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manager Elevation PIN Modal */}
      <ManagerPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title="Stock Adjustment Authorization"
        reason={`Authorize stock adjustment of ${adjQtyDelta > 0 ? `+${adjQtyDelta}` : adjQtyDelta} units for ${variants.find((v) => v.id === adjVariantId)?.name}`}
        onSuccess={(mgrName, mgrId) => {
          executeAdjustment(mgrName, mgrId);
        }}
      />
    </div>
  );
};
