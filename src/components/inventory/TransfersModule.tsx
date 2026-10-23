/**
 * Honor — Transfers Module
 * Tracks stock movement between branches and the central warehouse.
 * Dispatched serial units become IN_TRANSIT; receiving updates to IN_STOCK at destination.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { formatDateTime } from "../../utils/formatters";
import { Transfer, TransferLine, TransferStatus } from "../../types";
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  X,
  Smartphone,
  Boxes,
} from "lucide-react";

export const TransfersModule: React.FC = () => {
  const {
    transfers,
    locations,
    stockUnits,
    stockLevels,
    variants,
    products,
    activeStaff,
    activeLocationId,
    dispatchTransfer,
    receiveTransfer,
  } = useApp();

  const [operationError, setOperationError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null,
  );

  // New Transfer Form State
  const [fromLocId, setFromLocId] = useState(locations[0]?.id || "loc-alaba");
  const [toLocId, setToLocId] = useState(locations[1]?.id || "loc-ikeja");
  const [transferNotes, setTransferNotes] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedAccessoryVariantId, setSelectedAccessoryVariantId] =
    useState("");
  const [accessoryQty, setAccessoryQty] = useState(5);

  // Filter transfers
  const filteredTransfers = transfers.filter((t) => {
    if (
      activeLocationId !== "ALL" &&
      t.fromLocationId !== activeLocationId &&
      t.toLocationId !== activeLocationId
    ) {
      return false;
    }
    if (selectedStatus !== "ALL" && t.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.transferNumber.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Available serial units at selected origin location
  const availableUnitsAtOrigin = stockUnits.filter(
    (u) => u.locationId === fromLocId && u.status === "IN_STOCK",
  );

  // Quantity variants available at origin
  const accessoryVariants = variants.filter((v) => {
    const prod = products.find((p) => p.id === v.productId);
    return prod?.trackingType === "QUANTITY";
  });

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromLocId === toLocId) {
      alert("Origin and destination locations must be different.");
      return;
    }

    const lines: TransferLine[] = [];

    // Group selected serial units by variant
    const unitsMap: { [varId: string]: string[] } = {};
    selectedUnitIds.forEach((uId) => {
      const u = stockUnits.find((unit) => unit.id === uId);
      if (u) {
        if (!unitsMap[u.variantId]) unitsMap[u.variantId] = [];
        unitsMap[u.variantId].push(u.id);
      }
    });

    Object.entries(unitsMap).forEach(([vId, unitIds]) => {
      const variant = variants.find((v) => v.id === vId);
      lines.push({
        id: `tl-${Date.now()}-${vId}`,
        variantId: vId,
        variantName: variant?.name || "Device",
        sku: variant?.sku || "",
        quantitySent: unitIds.length,
        stockUnitIds: unitIds,
      });
    });

    // Add accessory line if selected
    if (selectedAccessoryVariantId && accessoryQty > 0) {
      const variant = variants.find((v) => v.id === selectedAccessoryVariantId);
      lines.push({
        id: `tl-${Date.now()}-acc`,
        variantId: selectedAccessoryVariantId,
        variantName: variant?.name || "Accessory",
        sku: variant?.sku || "",
        quantitySent: accessoryQty,
      });
    }

    if (lines.length === 0) {
      alert("Please select at least one device or accessory to transfer.");
      return;
    }

    try {
      dispatchTransfer(fromLocId, toLocId, lines, transferNotes);
      setOperationError("");
    } catch (e) {
      setOperationError((e as Error).message);
      return;
    }
    setIsNewModalOpen(false);
    setSelectedUnitIds([]);
    setSelectedAccessoryVariantId("");
    setTransferNotes("");
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
            Branch Stock Transfers
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage multi-location inventory logistics between central warehouse
            and retail branches.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Dispatch New Transfer</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search transfer number, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 text-xs">
          {["ALL", "DISPATCHED", "RECEIVED", "DRAFT"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                selectedStatus === st
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {st === "ALL" ? "All Transfers" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-3">Origin Location</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Dispatch Date</th>
                <th className="py-3 px-3 text-center">Items Sent</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No stock transfers found for current filter.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((trf) => {
                  const fromLoc = locations.find(
                    (l) => l.id === trf.fromLocationId,
                  );
                  const toLoc = locations.find(
                    (l) => l.id === trf.toLocationId,
                  );
                  const totalItems = trf.lines.reduce(
                    (sum, l) => sum + l.quantitySent,
                    0,
                  );
                  const isDestinationMatch =
                    activeLocationId === "ALL" ||
                    trf.toLocationId === activeLocationId;

                  return (
                    <tr
                      key={trf.id}
                      onClick={() => setSelectedTransfer(trf)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                        {trf.transferNumber}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-700 font-medium">
                        {fromLoc?.name || trf.fromLocationId}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-900 font-semibold">
                        {toLoc?.name || trf.toLocationId}
                      </td>
                      <td className="py-3.5 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                        {formatDateTime(trf.dispatchDate)}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-zinc-900 tabular-nums">
                        {totalItems}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trf.status === "RECEIVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : trf.status === "DISPATCHED"
                                ? "bg-indigo-100 text-indigo-800 animate-pulse"
                                : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {trf.status === "DISPATCHED"
                            ? "In Transit"
                            : trf.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {trf.status === "DISPATCHED" && isDestinationMatch ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                receiveTransfer(trf.id);
                                setOperationError("");
                              } catch (e) {
                                setOperationError((e as Error).message);
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                          >
                            Receive at Branch
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-xs font-medium">
                            View Details
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

      {/* New Transfer Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-xl overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Dispatch New Branch Stock Transfer
                </h3>
                <p className="text-xs text-zinc-500">
                  Pick origin, destination, and select physical devices by IMEI
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTransfer}
              className="p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Origin Location (From)
                  </label>
                  <select
                    value={fromLocId}
                    onChange={(e) => {
                      setFromLocId(e.target.value);
                      setSelectedUnitIds([]);
                    }}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.isWarehouse ? "(Warehouse)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Destination Branch (To)
                  </label>
                  <select
                    value={toLocId}
                    onChange={(e) => setToLocId(e.target.value)}
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

              {/* Serialised Device Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Select Physical Devices to Dispatch (
                      {selectedUnitIds.length} selected)
                    </span>
                  </label>
                  <span className="text-zinc-400 text-[11px]">
                    {availableUnitsAtOrigin.length} units in stock
                  </span>
                </div>

                <div className="border border-zinc-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1 bg-zinc-50/50">
                  {availableUnitsAtOrigin.length === 0 ? (
                    <div className="py-4 text-center text-zinc-400 text-xs">
                      No serialised units in stock at{" "}
                      {locations.find((l) => l.id === fromLocId)?.name}.
                    </div>
                  ) : (
                    availableUnitsAtOrigin.map((unit) => {
                      const variant = variants.find(
                        (v) => v.id === unit.variantId,
                      );
                      const isChecked = selectedUnitIds.includes(unit.id);

                      return (
                        <label
                          key={unit.id}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-emerald-50 border-emerald-300"
                              : "bg-white border-zinc-200 hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedUnitIds((prev) =>
                                    prev.filter((id) => id !== unit.id),
                                  );
                                } else {
                                  setSelectedUnitIds((prev) => [
                                    ...prev,
                                    unit.id,
                                  ]);
                                }
                              }}
                              className="rounded text-emerald-700 focus:ring-emerald-700"
                            />
                            <div>
                              <div className="font-bold text-zinc-900">
                                {variant?.name}
                              </div>
                              <div className="font-mono text-zinc-500 text-[10px]">
                                IMEI 1: {unit.imei1}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-semibold">
                            {unit.condition}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quantity Accessory Picker (Optional) */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Optional: Add Bulk Quantity Accessories</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={selectedAccessoryVariantId}
                      onChange={(e) =>
                        setSelectedAccessoryVariantId(e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white"
                    >
                      <option value="">
                        -- Choose accessory (optional) --
                      </option>
                      {accessoryVariants.map((v) => (
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
                      value={accessoryQty}
                      onChange={(e) => setAccessoryQty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white"
                      placeholder="Qty"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Dispatch Notes / Courier Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dispatched with Driver Emeka (Plate: KJA-492-AX)"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
