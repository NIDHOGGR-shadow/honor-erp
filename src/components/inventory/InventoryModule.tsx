/**
 * Honor — Inventory Module
 * Normative product catalog with list view and 5-tab detail view:
 * 1. Overview, 2. Units (IMEI tracking), 3. Stock by Location, 4. Price History, 5. Activity
 * Strictly respects serialised vs quantity distinction and role-based cost price visibility.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  canViewCostPrice,
  formatNaira,
  formatDateTime,
} from "../../utils/formatters";
import {
  Product,
  Variant,
  StockUnit,
  TrackingType,
  DeviceCondition,
} from "../../types";
import {
  Boxes,
  Smartphone,
  Search,
  Plus,
  Filter,
  ChevronRight,
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  Tag,
  History,
  X,
  FileSpreadsheet,
} from "lucide-react";

export const InventoryModule: React.FC = () => {
  const {
    products,
    variants,
    stockUnits,
    stockLevels,
    stockMovements,
    locations,
    activeStaff,
    activeLocationId,
    selectedProductId,
    setSelectedProductId,
    addProduct,
    setActiveModule,
  } = useApp();

  const role = activeStaff.role;
  const showCost = canViewCostPrice(role);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedTracking, setSelectedTracking] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<
    "overview" | "units" | "stock" | "pricing" | "activity"
  >("overview");

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("Apple");
  const [newProdModel, setNewProdModel] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Smartphones");
  const [newProdTracking, setNewProdTracking] =
    useState<TrackingType>("SERIALISED");
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantName, setNewVariantName] = useState("Standard");
  const [newCostPrice, setNewCostPrice] = useState("0");
  const [newSellingPrice, setNewSellingPrice] = useState("0");

  // Filter products
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "ALL" && p.category !== selectedCategory)
      return false;
    if (selectedBrand !== "ALL" && p.brand !== selectedBrand) return false;
    if (selectedTracking !== "ALL" && p.trackingType !== selectedTracking)
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = [
    "ALL",
    "Smartphones",
    "Tablets",
    "Wearables",
    "Laptops",
    "Audio & Accessories",
    "Charging & Power",
  ];
  const brands = [
    "ALL",
    "Apple",
    "Samsung",
    "Google",
    "Xiaomi",
    "Anker",
    "Oraimo",
  ];

  // Handle Add Product Submit
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdModel.trim()) return;

    const prodId = `prod-${Date.now()}`;
    const varId = `var-${Date.now()}`;

    const newProduct: Product = {
      id: prodId,
      name: newProdName.trim(),
      brand: newProdBrand,
      model: newProdModel.trim(),
      category: newProdCategory,
      trackingType: newProdTracking,
      createdAt: new Date().toISOString(),
    };

    const newVariant: Variant = {
      id: varId,
      productId: prodId,
      sku:
        newVariantSku.trim() ||
        `SKU-${Math.floor(10000 + Math.random() * 90000)}`,
      name: newVariantName.trim(),
      costPrice: Number(newCostPrice) || 0,
      sellingPrice: Number(newSellingPrice) || 0,
      isDefault: true,
    };

    addProduct(newProduct, [newVariant]);
    setIsAddModalOpen(false);
    // Reset form
    setNewProdName("");
    setNewProdModel("");
    setNewVariantSku("");
    setNewCostPrice("0");
    setNewSellingPrice("0");
    setSelectedProductId(prodId);
  };

  // If a product is selected, render the 5-tab detail view
  if (selectedProductId) {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      setSelectedProductId(null);
      return null;
    }

    const prodVariants = variants.filter((v) => v.productId === product.id);
    const prodVariantIds = prodVariants.map((v) => v.id);

    // Units for this product
    const prodUnits = stockUnits.filter((u) =>
      prodVariantIds.includes(u.variantId),
    );

    // Stock levels for this product
    const prodLevels = stockLevels.filter((sl) =>
      prodVariantIds.includes(sl.variantId),
    );

    // Movements for this product
    const prodMovements = stockMovements.filter((m) =>
      prodVariantIds.includes(m.variantId),
    );

    const totalOnHand = prodLevels.reduce((sum, sl) => {
      if (activeLocationId !== "ALL" && sl.locationId !== activeLocationId)
        return sum;
      return sum + sl.onHand;
    }, 0);

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Back Button & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedProductId(null)}
              className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
              title="Back to Catalogue"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900">
                  {product.name}
                </h1>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    product.trackingType === "SERIALISED"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {product.trackingType === "SERIALISED"
                    ? "Serialised (IMEI)"
                    : "Quantity-Tracked"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {product.brand} · {product.category} · Model: {product.model}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {role !== "SALES" && (
              <button
                onClick={() => setActiveModule("add-stock")}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stock Intake</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <div className="text-[11px] text-zinc-500 font-medium">
              On-Hand Total
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
              {totalOnHand}{" "}
              <span className="text-xs font-normal text-zinc-500">
                {product.trackingType === "SERIALISED" ? "units" : "pcs"}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <div className="text-[11px] text-zinc-500 font-medium">
              Retail Price (VAT Incl.)
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
              {prodVariants[0]
                ? formatNaira(prodVariants[0].sellingPrice)
                : "—"}
            </div>
          </div>

          {showCost && (
            <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
              <div className="text-[11px] text-zinc-500 font-medium">
                Unit Cost Price
              </div>
              <div className="text-xl font-bold text-zinc-700 mt-1 tabular-nums">
                {prodVariants[0] ? formatNaira(prodVariants[0].costPrice) : "—"}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <div className="text-[11px] text-zinc-500 font-medium">
              Variants Configured
            </div>
            <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
              {prodVariants.length}
            </div>
          </div>
        </div>

        {/* 5 Normative Detail Tabs */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="flex border-b border-zinc-200 px-4 gap-4 overflow-x-auto">
            {[
              { id: "overview", label: "1. Overview" },
              { id: "units", label: `2. Physical Units (${prodUnits.length})` },
              { id: "stock", label: "3. Stock by Location" },
              { id: "pricing", label: "4. Price History" },
              { id: "activity", label: "5. Activity & Movements" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-emerald-700 text-emerald-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                    Product Specifications
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-zinc-400 block mb-1">
                        Brand & Category
                      </span>
                      <span className="font-bold text-zinc-900">
                        {product.brand} · {product.category}
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-zinc-400 block mb-1">
                        Model Reference
                      </span>
                      <span className="font-bold text-zinc-900">
                        {product.model}
                      </span>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <span className="text-zinc-400 block mb-1">
                        VAT Status
                      </span>
                      <span className="font-bold text-emerald-800">
                        7.5% VAT Inclusive (Nigeria)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                    Product Variants ({prodVariants.length})
                  </h3>
                  <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Variant Specification</th>
                          {showCost && (
                            <th className="py-2.5 px-3">Cost Price</th>
                          )}
                          <th className="py-2.5 px-3">
                            Selling Price (VAT Incl.)
                          </th>
                          <th className="py-2.5 px-3 text-right">Default</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {prodVariants.map((v) => (
                          <tr key={v.id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-3 font-mono text-zinc-700 font-bold">
                              {v.sku}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-zinc-900">
                              {v.name}
                            </td>
                            {showCost && (
                              <td className="py-2.5 px-3 text-zinc-600">
                                {formatNaira(v.costPrice)}
                              </td>
                            )}
                            <td className="py-2.5 px-3 font-bold text-zinc-900">
                              {formatNaira(v.sellingPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {v.isDefault && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-semibold">
                                  Default
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PHYSICAL UNITS (SERIALISED ONLY) */}
            {activeTab === "units" && (
              <div className="space-y-4">
                {product.trackingType !== "SERIALISED" ? (
                  <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-500 text-xs">
                    This is a quantity-tracked accessory. Physical serial
                    numbers & IMEIs are not tracked for bulk quantity items.
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-zinc-500">
                        Every single physical device has its own IMEI, location,
                        condition, and status ledger.
                      </div>
                      <span className="text-xs font-bold text-emerald-800">
                        {
                          prodUnits.filter((u) => u.status === "IN_STOCK")
                            .length
                        }{" "}
                        available in stock
                      </span>
                    </div>

                    <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">IMEI 1</th>
                            <th className="py-2.5 px-3">Condition</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Location</th>
                            {showCost && (
                              <th className="py-2.5 px-3">Cost Price</th>
                            )}
                            <th className="py-2.5 px-3">Date Received</th>
                            <th className="py-2.5 px-3 text-right">
                              Warranty / Customer
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {prodUnits.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="p-6 text-center text-zinc-400"
                              >
                                No physical units registered. Receive a purchase
                                order or transfer to add units.
                              </td>
                            </tr>
                          ) : (
                            prodUnits.map((unit) => {
                              const loc = locations.find(
                                (l) => l.id === unit.locationId,
                              );
                              return (
                                <tr key={unit.id} className="hover:bg-zinc-50">
                                  <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                                    {unit.imei1}
                                    {unit.imei2 && (
                                      <span className="block text-[10px] text-zinc-400">
                                        SIM 2: {unit.imei2}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700">
                                      {unit.condition}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        unit.status === "IN_STOCK"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : unit.status === "SOLD"
                                            ? "bg-indigo-100 text-indigo-800"
                                            : unit.status === "IN_TRANSIT"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {unit.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-zinc-700">
                                    {loc?.name || "—"}
                                  </td>
                                  {showCost && (
                                    <td className="py-2.5 px-3 font-mono text-zinc-600">
                                      {formatNaira(unit.costPrice)}
                                    </td>
                                  )}
                                  <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                                    {formatDateTime(unit.receivedDate)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-[11px] text-zinc-500">
                                    {unit.status === "SOLD"
                                      ? "Sold under warranty"
                                      : "Unassigned"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STOCK BY LOCATION */}
            {activeTab === "stock" && (
              <div className="space-y-4">
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-center">On Hand</th>
                        <th className="py-2.5 px-3 text-center">Reserved</th>
                        <th className="py-2.5 px-3 text-center">
                          Reorder Level
                        </th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {locations.map((loc) => {
                        const locLevels = prodLevels.filter(
                          (sl) => sl.locationId === loc.id,
                        );
                        const onHand = locLevels.reduce(
                          (sum, sl) => sum + sl.onHand,
                          0,
                        );
                        const reserved = locLevels.reduce(
                          (sum, sl) => sum + sl.reserved,
                          0,
                        );
                        const reorder = locLevels[0]?.reorderLevel || 3;
                        const isLow = onHand <= reorder;

                        return (
                          <tr key={loc.id} className="hover:bg-zinc-50">
                            <td className="py-3 px-3 font-bold text-zinc-900">
                              {loc.name}
                            </td>
                            <td className="py-3 px-3 text-zinc-500">
                              {loc.isWarehouse ? (
                                <span className="text-[10px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-semibold">
                                  Central Warehouse
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                                  Retail POS Branch
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-zinc-900 tabular-nums">
                              {onHand}
                            </td>
                            <td className="py-3 px-3 text-center text-zinc-500 tabular-nums">
                              {reserved}
                            </td>
                            <td className="py-3 px-3 text-center text-zinc-500 tabular-nums">
                              {reorder}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isLow ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                  Low Stock Warning
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                  Healthy Level
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: PRICE HISTORY */}
            {activeTab === "pricing" && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                  <h4 className="text-xs font-bold text-zinc-900 mb-1">
                    Standard Pricing Policy
                  </h4>
                  <p className="text-xs text-zinc-600">
                    Honor operates with VAT-inclusive pricing. All retail price
                    changes are logged for auditing and financial reporting.
                  </p>
                </div>

                <div className="border border-zinc-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-zinc-800 mb-2">
                    Current Active Pricing
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white border border-zinc-200 rounded-xl">
                      <span className="text-zinc-500 block">
                        Retail Selling Price (VAT 7.5% Included)
                      </span>
                      <span className="text-lg font-bold text-zinc-900 mt-1 block">
                        {prodVariants[0]
                          ? formatNaira(prodVariants[0].sellingPrice)
                          : "—"}
                      </span>
                    </div>
                    {showCost && (
                      <div className="p-3 bg-white border border-zinc-200 rounded-xl">
                        <span className="text-zinc-500 block">
                          Standard Cost Price
                        </span>
                        <span className="text-lg font-bold text-zinc-700 mt-1 block">
                          {prodVariants[0]
                            ? formatNaira(prodVariants[0].costPrice)
                            : "—"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ACTIVITY & MOVEMENTS */}
            {activeTab === "activity" && (
              <div className="space-y-4">
                <div className="text-xs text-zinc-500">
                  Audit trail of all ledger movements (purchases, sales,
                  transfers, adjustments) for this product.
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference #</th>
                        <th className="py-2.5 px-3 text-center">Qty Change</th>
                        <th className="py-2.5 px-3">Reason / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {prodMovements.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-6 text-center text-zinc-400"
                          >
                            No ledger movements recorded for this product.
                          </td>
                        </tr>
                      ) : (
                        prodMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">
                              {formatDateTime(m.timestamp)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800">
                                {m.movementType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                              {m.referenceNumber}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-center font-bold tabular-nums ${
                                m.quantityChange > 0
                                  ? "text-emerald-700"
                                  : "text-rose-600"
                              }`}
                            >
                              {m.quantityChange > 0
                                ? `+${m.quantityChange}`
                                : m.quantityChange}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-600 truncate max-w-[240px]">
                              {m.reason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: Product List Catalogue View
  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Inventory Catalogue
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage serialised devices (IMEI tracking) and accessories across
            branches
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role !== "SALES" && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by product name, model, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 text-zinc-900"
            />
          </div>

          {/* Tracking Type Chip Filter */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0">
            {["ALL", "SERIALISED", "QUANTITY"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedTracking(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  selectedTracking === type
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {type === "ALL"
                  ? "All Tracking"
                  : type === "SERIALISED"
                    ? "Serialised"
                    : "Quantity"}
              </button>
            ))}
          </div>
        </div>

        {/* Category & Brand Filters */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            <span className="text-zinc-400 text-[11px] font-semibold uppercase">
              Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-emerald-800 text-white"
                    : "bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Product Name & Spec</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Tracking</th>
                <th className="py-3 px-3 text-center">On Hand Total</th>
                {showCost && <th className="py-3 px-3">Cost Price</th>}
                <th className="py-3 px-3">Selling Price (VAT Incl.)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    {products.length === 0 ? "No products yet. Add your first product when you are ready." : "No products found matching the current filters."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const pVariants = variants.filter(
                    (v) => v.productId === p.id,
                  );
                  const pLevels = stockLevels.filter((sl) =>
                    pVariants.some((v) => v.id === sl.variantId),
                  );
                  const totalOnHand = pLevels.reduce((sum, sl) => {
                    if (
                      activeLocationId !== "ALL" &&
                      sl.locationId !== activeLocationId
                    )
                      return sum;
                    return sum + sl.onHand;
                  }, 0);

                  const defaultVariant =
                    pVariants.find((v) => v.isDefault) || pVariants[0];

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 font-bold shrink-0">
                            {p.trackingType === "SERIALISED" ? (
                              <Smartphone className="w-4 h-4 text-emerald-700" />
                            ) : (
                              <Boxes className="w-4 h-4 text-indigo-700" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {p.brand} · {p.model}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-zinc-600 font-medium">
                        {p.category}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            p.trackingType === "SERIALISED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {p.trackingType === "SERIALISED"
                            ? "Serialised (IMEI)"
                            : "Quantity-Tracked"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-zinc-900 tabular-nums">
                          {totalOnHand}
                        </span>{" "}
                        <span className="text-[10px] text-zinc-400">
                          {p.trackingType === "SERIALISED" ? "units" : "pcs"}
                        </span>
                      </td>
                      {showCost && (
                        <td className="py-3.5 px-3 text-zinc-600 tabular-nums">
                          {defaultVariant
                            ? formatNaira(defaultVariant.costPrice)
                            : "—"}
                        </td>
                      )}
                      <td className="py-3.5 px-3 font-bold text-zinc-900 tabular-nums">
                        {defaultVariant
                          ? formatNaira(defaultVariant.sellingPrice)
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductId(p.id);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-emerald-700 hover:bg-zinc-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Add New Product to Catalogue
                </h3>
                <p className="text-xs text-zinc-500">
                  Configure device specs & permanent tracking type
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Product Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. iPhone 16 Pro Max"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Brand
                  </label>
                  <select
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                  >
                    {brands
                      .filter((b) => b !== "ALL")
                      .map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                  >
                    {categories
                      .filter((c) => c !== "ALL")
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Model Code / Reference
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A3106"
                  value={newProdModel}
                  onChange={(e) => setNewProdModel(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {/* Permanent Tracking Type Choice */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <label className="block text-xs font-bold text-zinc-900 mb-1">
                  Stock tracking method
                </label>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Tracking type is set at creation and cannot be modified once
                  movements exist.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProdTracking("SERIALISED")}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      newProdTracking === "SERIALISED"
                        ? "border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    <div className="text-xs font-bold">Serialised (IMEI)</div>
                    <div className="text-[10px] text-zinc-500">
                      For phones, tablets, smart watches
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProdTracking("QUANTITY")}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      newProdTracking === "QUANTITY"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-950 font-bold shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    <div className="text-xs font-bold">Quantity-Based</div>
                    <div className="text-[10px] text-zinc-500">
                      For chargers, cases, screen guards
                    </div>
                  </button>
                </div>
              </div>

              {/* Initial Variant & Pricing */}
              <div className="border-t border-zinc-200 pt-3 space-y-3">
                <div className="text-xs font-bold text-zinc-900">
                  Default Variant & Pricing
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Variant Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 256GB Black Titanium"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Optional auto-generated SKU"
                      value={newVariantSku}
                      onChange={(e) => setNewVariantSku(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Cost Price (₦)
                    </label>
                    <input
                      type="number"
                      value={newCostPrice}
                      onChange={(e) => setNewCostPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1">
                      Selling Price (₦, VAT-Incl.)
                    </label>
                    <input
                      type="number"
                      value={newSellingPrice}
                      onChange={(e) => setNewSellingPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
