/**
 * Honor — Global Search Modal (Keyboard shortcut /)
 * Searches products, 15-digit IMEIs, customers, suppliers, sales receipts & POs.
 */

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { formatNaira } from "../../utils/formatters";
import {
  Search,
  X,
  Smartphone,
  Users,
  Building2,
  Receipt,
  FileText,
  Tag,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    products,
    variants,
    stockUnits,
    customers,
    suppliers,
    sales,
    purchases,
    setActiveModule,
    setSelectedProductId,
    setSelectedCustomerId,
    setSelectedSupplierId,
    setSelectedSaleId,
  } = useApp();

  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user presses '/' when not typing in another input
      if (
        e.key === "/" &&
        !isGlobalSearchOpen &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      } else if (e.key === "Escape" && isGlobalSearchOpen) {
        setIsGlobalSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGlobalSearchOpen, setIsGlobalSearchOpen]);

  useEffect(() => {
    if (isGlobalSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isGlobalSearchOpen]);

  if (!isGlobalSearchOpen) return null;

  const trimmed = query.trim().toLowerCase();

  // 1. Exact 15-digit IMEI match check
  const exactImeiMatch =
    trimmed.length === 15
      ? stockUnits.find(
          (u) =>
            u.imei1.toLowerCase() === trimmed ||
            (u.imei2 && u.imei2.toLowerCase() === trimmed),
        )
      : null;

  // 2. Search IMEIs & Stock Units
  const matchedUnits =
    trimmed.length >= 3
      ? stockUnits
          .filter(
            (u) =>
              u.imei1.toLowerCase().includes(trimmed) ||
              (u.imei2 && u.imei2.toLowerCase().includes(trimmed)) ||
              (u.serialNumber &&
                u.serialNumber.toLowerCase().includes(trimmed)),
          )
          .slice(0, 5)
      : [];

  // 3. Search Products & Variants
  const matchedProducts =
    trimmed.length >= 2
      ? products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(trimmed) ||
              p.brand.toLowerCase().includes(trimmed) ||
              p.model.toLowerCase().includes(trimmed),
          )
          .slice(0, 4)
      : [];

  // 4. Search Customers
  const matchedCustomers =
    trimmed.length >= 2
      ? customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(trimmed) ||
              c.phone.includes(trimmed) ||
              (c.email && c.email.toLowerCase().includes(trimmed)),
          )
          .slice(0, 4)
      : [];

  // 5. Search Suppliers
  const matchedSuppliers =
    trimmed.length >= 2
      ? suppliers
          .filter(
            (s) =>
              s.name.toLowerCase().includes(trimmed) ||
              s.phone.includes(trimmed),
          )
          .slice(0, 3)
      : [];

  // 6. Search Sales (Receipt Numbers)
  const matchedSales =
    trimmed.length >= 2
      ? sales
          .filter(
            (s) =>
              s.receiptNumber.toLowerCase().includes(trimmed) ||
              (s.customerName &&
                s.customerName.toLowerCase().includes(trimmed)),
          )
          .slice(0, 4)
      : [];

  const hasAnyResults =
    exactImeiMatch ||
    matchedUnits.length > 0 ||
    matchedProducts.length > 0 ||
    matchedCustomers.length > 0 ||
    matchedSuppliers.length > 0 ||
    matchedSales.length > 0;

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setActiveModule("inventory");
    setIsGlobalSearchOpen(false);
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveModule("customers");
    setIsGlobalSearchOpen(false);
  };

  const handleSelectSupplier = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setActiveModule("suppliers");
    setIsGlobalSearchOpen(false);
  };

  const handleSelectSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setActiveModule("sales");
    setIsGlobalSearchOpen(false);
  };

  const handleSelectUnit = (unit: (typeof stockUnits)[0]) => {
    const variant = variants.find((v) => v.id === unit.variantId);
    if (variant) {
      setSelectedProductId(variant.productId);
      setActiveModule("inventory");
    }
    setIsGlobalSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-zinc-200/80 flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, 15-digit IMEI, customers, suppliers, receipts... (Press Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm sm:text-base font-medium bg-transparent focus:outline-none placeholder:text-zinc-400 text-zinc-900"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-zinc-100 text-zinc-500 rounded-md border border-zinc-200">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-zinc-100">
          {/* Exact 15-digit IMEI alert */}
          {exactImeiMatch && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Exact 15-Digit IMEI Match Found
                </div>
                <div className="text-sm font-bold text-emerald-950 mt-0.5 font-mono">
                  {exactImeiMatch.imei1}
                </div>
                <div className="text-xs text-emerald-800">
                  Status:{" "}
                  <span className="font-semibold">{exactImeiMatch.status}</span>{" "}
                  · Condition: {exactImeiMatch.condition}
                </div>
              </div>
              <button
                onClick={() => handleSelectUnit(exactImeiMatch)}
                className="px-3 py-1.5 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>View Device</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Matched Stock Units / IMEIs */}
          {matchedUnits.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Physical Devices & IMEIs ({matchedUnits.length})
              </div>
              <div className="space-y-1.5">
                {matchedUnits.map((unit) => {
                  const variant = variants.find((v) => v.id === unit.variantId);
                  return (
                    <div
                      key={unit.id}
                      onClick={() => handleSelectUnit(unit)}
                      className="p-2.5 rounded-xl hover:bg-zinc-50 border border-zinc-100 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-zinc-900">
                          {variant?.name || "Device Unit"}
                        </div>
                        <div className="text-xs font-mono text-emerald-700 mt-0.5">
                          IMEI 1: <strong>{unit.imei1}</strong>{" "}
                          {unit.serialNumber
                            ? `· S/N: ${unit.serialNumber}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            unit.status === "IN_STOCK"
                              ? "bg-emerald-100 text-emerald-800"
                              : unit.status === "SOLD"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {unit.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matched Products */}
          {matchedProducts.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Products & Catalogue ({matchedProducts.length})
              </div>
              <div className="space-y-1.5">
                {matchedProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p.id)}
                    className="p-2.5 rounded-xl hover:bg-zinc-50 border border-zinc-100 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-900">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {p.brand} · {p.category} · {p.trackingType}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Customers */}
          {matchedCustomers.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Customers ({matchedCustomers.length})
              </div>
              <div className="space-y-1.5">
                {matchedCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c.id)}
                    className="p-2.5 rounded-xl hover:bg-zinc-50 border border-zinc-100 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-900">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {c.phone} {c.email ? `· ${c.email}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {c.balance > 0 ? (
                        <span className="text-rose-600 font-semibold">
                          Owes {formatNaira(c.balance)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Cleared
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Sales */}
          {matchedSales.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Sales Receipts ({matchedSales.length})
              </div>
              <div className="space-y-1.5">
                {matchedSales.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSale(s.id)}
                    className="p-2.5 rounded-xl hover:bg-zinc-50 border border-zinc-100 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-900 font-mono">
                        {s.receiptNumber}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {s.customerName || "Walk-in"} · {s.lines.length} item(s)
                      </div>
                    </div>
                    <div className="text-xs font-bold text-zinc-900">
                      {formatNaira(s.grandTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAnyResults && query.length >= 2 && (
            <div className="py-12 text-center text-zinc-400 text-xs">
              No matching products, IMEIs, customers, or receipts found for "
              {query}".
            </div>
          )}

          {query.length < 2 && (
            <div className="py-10 text-center text-zinc-400 text-xs">
              Type at least 2 characters to search across inventory, serial
              numbers, customers, and sales.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
