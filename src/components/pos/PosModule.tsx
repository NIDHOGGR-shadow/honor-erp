/**
 * Honor — Point of Sale (POS) Counter Module
 * Rapid checkout, IMEI selection, Manager PIN discount elevation,
 * multi-payment tenders, and authentic Nigerian VAT-inclusive thermal receipt.
 */

import { loadBusinessProfile } from "../../config/business";
import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import {
  formatNaira,
  calculateDerivedVat,
  calculateVatBase,
  canSellOrOpenPos,
} from "../../utils/formatters";
import { ManagerPinModal } from "../common/ManagerPinModal";
import {
  Product,
  Variant,
  StockUnit,
  Customer,
  Sale,
  PaymentMethod,
  SaleLine,
} from "../../types";
import {
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Building,
  UserCheck,
  CheckCircle,
  Printer,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Boxes,
  X,
  Keyboard,
} from "lucide-react";

interface CartItem {
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  trackingType: "SERIALISED" | "QUANTITY";
  stockUnitId?: string;
  imei?: string;
  condition?: string;
  costPrice: number;
  unitPrice: number;
  quantity: number;
  discount: number;
}

export const PosModule: React.FC = () => {
  const {
    products,
    variants,
    stockUnits,
    stockLevels,
    customers,
    activeStaff,
    currentLocation,
    activeLocationId,
    createSale,
  } = useApp();

  const businessProfile = loadBusinessProfile();
  const [checkoutError, setCheckoutError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isDiscountElevated, setIsDiscountElevated] = useState<boolean>(false);
  const [discountApproverName, setDiscountApproverName] = useState<string>("");

  // Modals
  const [isImeiModalOpen, setIsImeiModalOpen] = useState(false);
  const [imeiModalVariant, setImeiModalVariant] = useState<Variant | null>(
    null,
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [posTerminalRef, setPosTerminalRef] =
    useState<string>("STANBIC-POS-01");
  const [bankRef, setBankRef] = useState<string>("");

  // Catalog search & category filter
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts (F2: scan focus, F4: pay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === "F4" && cart.length > 0 && !isPaymentModalOpen) {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, isPaymentModalOpen]);

  // Handle Barcode / IMEI Fast Scan
  const handleFastScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = catalogSearch.trim().toLowerCase();
    if (!query) return;

    // Check if query matches 15-digit IMEI in local stock
    const matchingUnit = stockUnits.find(
      (u) =>
        u.locationId === activeLocationId &&
        u.status === "IN_STOCK" &&
        (u.imei1.toLowerCase() === query ||
          (u.imei2 && u.imei2.toLowerCase() === query)),
    );

    if (matchingUnit) {
      const variant = variants.find((v) => v.id === matchingUnit.variantId);
      const product = products.find((p) => p.id === variant?.productId);
      if (variant && product) {
        addSerialisedToCart(product, variant, matchingUnit);
        setCatalogSearch("");
        return;
      }
    }

    // Check if query matches SKU
    const matchingVariant = variants.find((v) => v.sku.toLowerCase() === query);
    if (matchingVariant) {
      const product = products.find((p) => p.id === matchingVariant.productId);
      if (product) {
        if (product.trackingType === "SERIALISED") {
          openImeiPicker(matchingVariant);
        } else {
          addAccessoryToCart(product, matchingVariant);
        }
        setCatalogSearch("");
      }
    }
  };

  // Add Accessory (Quantity) to Cart
  const addAccessoryToCart = (product: Product, variant: Variant) => {
    const existingIndex = cart.findIndex(
      (item) => item.variantId === variant.id,
    );
    if (existingIndex > -1) {
      setCart((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          variantId: variant.id,
          variantName: `${product.name} - ${variant.name}`,
          productId: product.id,
          productName: product.name,
          trackingType: "QUANTITY",
          costPrice: variant.costPrice,
          unitPrice: variant.sellingPrice,
          quantity: 1,
          discount: 0,
        },
      ]);
    }
  };

  // Open IMEI picker for serialised devices
  const openImeiPicker = (variant: Variant) => {
    setImeiModalVariant(variant);
    setIsImeiModalOpen(true);
  };

  // Add Serialised Device to Cart with specific IMEI
  const addSerialisedToCart = (
    product: Product,
    variant: Variant,
    unit: StockUnit,
  ) => {
    // Check if already in cart
    if (cart.some((item) => item.stockUnitId === unit.id)) {
      alert(`IMEI ${unit.imei1} is already in the cart.`);
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        variantId: variant.id,
        variantName: `${product.name} - ${variant.name}`,
        productId: product.id,
        productName: product.name,
        trackingType: "SERIALISED",
        stockUnitId: unit.id,
        imei: unit.imei1,
        condition: unit.condition,
        costPrice: unit.costPrice || variant.costPrice,
        unitPrice: variant.sellingPrice,
        quantity: 1,
        discount: 0,
      },
    ]);

    setIsImeiModalOpen(false);
    setImeiModalVariant(null);
  };

  // Remove or change quantity
  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      if (item.trackingType === "SERIALISED") {
        // Serialised can only be removed
        return prev.filter((_, idx) => idx !== index);
      }
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, idx) => idx !== index);
      }
      return prev.map((it, idx) =>
        idx === index ? { ...it, quantity: nextQty } : it,
      );
    });
  };

  // Calculations
  const grossTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  // Discount rule:
  // Attendant cap is 5% or ₦5,000 max.
  const calculatedDiscount =
    discountPercent > 0
      ? Math.round((grossTotal * discountPercent) / 100)
      : discountAmount;

  const payableTotal = Math.max(0, grossTotal - calculatedDiscount);
  const derivedVat = calculateDerivedVat(payableTotal);
  const vatBase = calculateVatBase(payableTotal);

  // Handle discount change with cap validation
  const handleApplyDiscount = (val: number, isPct: boolean) => {
    if (isPct) {
      setDiscountPercent(val);
      setDiscountAmount(0);
      if (val > 5 && activeStaff.role === "SALES") {
        setIsPinModalOpen(true);
      }
    } else {
      setDiscountAmount(val);
      setDiscountPercent(0);
      if (val > 5000 && activeStaff.role === "SALES") {
        setIsPinModalOpen(true);
      }
    }
  };

  // Customer selection
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Complete Checkout
  const handleFinalizeSale = () => {
    if (cart.length === 0) return;

    const saleLines: SaleLine[] = cart.map((item) => ({
      id: `line-${crypto.randomUUID()}`,
      productName: item.productName,
      sku: variants.find((v) => v.id === item.variantId)?.sku || "",
      variantId: item.variantId,
      variantName: item.variantName,
      stockUnitId: item.stockUnitId,
      imei: item.imei,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      discount: item.discount,
      total: item.unitPrice * item.quantity,
    }));

    if (paymentMethod === "CASH" && cashTendered < payableTotal) {
      setCheckoutError("Cash received is less than the total.");
      return;
    }
    if (
      calculatedDiscount > 0 &&
      activeStaff.role === "SALES" &&
      (calculatedDiscount > 5000 || calculatedDiscount > grossTotal * 0.05) &&
      !isDiscountElevated
    ) {
      setCheckoutError("This discount requires manager approval.");
      return;
    }
    try {
      const saleRecord = createSale({
        locationId: activeLocationId,
        staffId: activeStaff.id,
        staffName: activeStaff.name,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
        subtotal: vatBase,
        vatAmount: derivedVat,
        discountTotal: calculatedDiscount,
        managerApprovedDiscount: isDiscountElevated,
        managerApproverName: discountApproverName || undefined,
        grandTotal: payableTotal,
        payments: [
          {
            id: crypto.randomUUID(),
            method: paymentMethod,
            amount: payableTotal,
            timestamp: new Date().toISOString(),
            reference:
              paymentMethod === "CARD"
                ? posTerminalRef
                : paymentMethod === "TRANSFER"
                  ? bankRef
                  : undefined,
          },
        ],
        paymentStatus: "PAID",
        amountPaid: payableTotal,
        balanceDue: 0,
        lines: saleLines,
      });

      setCompletedSale(saleRecord);
      setIsPaymentModalOpen(false);
      setCart([]);
      setSelectedCustomerId("");
      setDiscountAmount(0);
      setDiscountPercent(0);
      setIsDiscountElevated(false);
      setCheckoutError("");
    } catch (e) {
      setCheckoutError((e as Error).message);
    }
  };

  const categories = [
    "ALL",
    "Smartphones",
    "Audio & Accessories",
    "Charging & Power",
  ];

  // Available stock units for the modal variant
  const availableModalUnits = imeiModalVariant
    ? stockUnits.filter(
        (u) =>
          u.variantId === imeiModalVariant.id &&
          u.locationId === activeLocationId &&
          u.status === "IN_STOCK",
      )
    : [];

  // Guard: If staff cannot sell (e.g. inventory staff), block
  if (!canSellOrOpenPos(activeStaff.role)) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-zinc-200">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3 font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-zinc-900">Access Restricted</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Inventory staff are not permitted to operate the sales counter.
        </p>
      </div>
    );
  }

  // Guard: If location is ALL or Warehouse
  if (activeLocationId === "ALL" || currentLocation?.isWarehouse) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-zinc-200">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 font-bold">
          !
        </div>
        <h2 className="text-base font-bold text-zinc-900">
          Retail Location Required
        </h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
          Please select a specific retail branch (e.g. Ikeja or Victoria Island)
          from the top-bar location selector. Warehouses and aggregate views
          cannot execute sales.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-8rem)] lg:h-[calc(100vh-6.5rem)]">
      {/* Mobile Mode Switcher (Visible only on < lg screens) */}
      <div className="lg:hidden flex items-center bg-zinc-200/80 p-1 rounded-xl shrink-0">
        <button
          onClick={() => setMobileTab("catalog")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center ${
            mobileTab === "catalog"
              ? "bg-white text-zinc-900 shadow-xs"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          Catalog & Scan
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "cart"
              ? "bg-emerald-800 text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <span>Cart ({cart.length})</span>
          {cart.length > 0 && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                mobileTab === "cart"
                  ? "bg-emerald-950/50 text-emerald-100"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {formatNaira(payableTotal)}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* LEFT PANE: Fast Scan + Product Catalogue Grid */}
        <div
          className={`flex-1 flex flex-col bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs ${
            mobileTab === "catalog" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Fast Scanner & Category Filters */}
          <div className="p-3 border-b border-zinc-200/80 bg-zinc-50/50 space-y-2.5">
            <form onSubmit={handleFastScan} className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                ref={scanInputRef}
                type="text"
                placeholder="Scan Barcode / 15-digit IMEI, or search catalogue (Press F2 to focus)..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-9 pr-20 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-emerald-700 text-zinc-900"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 text-zinc-500 rounded border border-zinc-200">
                  F2
                </kbd>
              </div>
            </form>

            {/* Category Chips */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-emerald-800 text-white"
                      : "bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {products
              .filter(
                (p) =>
                  selectedCategory === "ALL" || p.category === selectedCategory,
              )
              .filter((p) => {
                if (!catalogSearch.trim()) return true;
                const q = catalogSearch.toLowerCase();
                return (
                  p.name.toLowerCase().includes(q) ||
                  p.brand.toLowerCase().includes(q)
                );
              })
              .map((product) => {
                const pVariants = variants.filter(
                  (v) => v.productId === product.id,
                );
                const defaultVariant =
                  pVariants.find((v) => v.isDefault) || pVariants[0];
                const pLevels = stockLevels.filter(
                  (sl) =>
                    pVariants.some((v) => v.id === sl.variantId) &&
                    sl.locationId === activeLocationId,
                );
                const onHand = pLevels.reduce((sum, sl) => sum + sl.onHand, 0);

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (product.trackingType === "SERIALISED") {
                        if (defaultVariant) openImeiPicker(defaultVariant);
                      } else {
                        if (defaultVariant)
                          addAccessoryToCart(product, defaultVariant);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer hover:shadow-sm ${
                      onHand > 0
                        ? "border-zinc-200/80 bg-white hover:border-emerald-600"
                        : "border-zinc-200 bg-zinc-50 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            product.trackingType === "SERIALISED"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-indigo-50 text-indigo-800"
                          }`}
                        >
                          {product.trackingType === "SERIALISED"
                            ? "IMEI"
                            : "Qty"}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${onHand > 0 ? "text-emerald-700" : "text-rose-600"}`}
                        >
                          {onHand} in stock
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {product.brand}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-xs font-black text-zinc-900 tabular-nums">
                        {defaultVariant
                          ? formatNaira(defaultVariant.sellingPrice)
                          : "—"}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-emerald-700 hover:text-white flex items-center justify-center font-bold text-xs transition-colors">
                        +
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* RIGHT PANE: Cart, Customer, Discount & Checkout */}
        <div
          className={`w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs shrink-0 ${
            mobileTab === "cart" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Cart Header */}
          <div className="p-3 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/70">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-800" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Current Sale ({cart.length})
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Customer Selector */}
          <div className="p-2.5 border-b border-zinc-100 bg-zinc-50/40">
            <div className="flex items-center gap-1.5 text-xs">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-xl text-xs bg-white text-zinc-800 focus:ring-1 focus:ring-emerald-700"
              >
                <option value="">Walk-in Customer (No Account)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}){" "}
                    {c.balance > 0 ? `— Owes ${formatNaira(c.balance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cart Line Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-zinc-100">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 text-xs">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                Cart is empty. Click an item on the left or scan an IMEI to
                begin.
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={`${item.variantId}-${index}`}
                  className="pt-2 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-zinc-900 truncate">
                      {item.variantName}
                    </div>
                    {item.imei && (
                      <div className="text-[10px] font-mono text-emerald-700 font-medium">
                        IMEI: <strong>{item.imei}</strong> (
                        {item.condition || "BRAND_NEW"})
                      </div>
                    )}
                    <div className="text-xs font-bold text-zinc-700 mt-0.5">
                      {formatNaira(item.unitPrice)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.trackingType === "QUANTITY" ? (
                      <div className="flex items-center border border-zinc-200 rounded-lg bg-zinc-50">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="p-1 hover:bg-zinc-200 text-zinc-600 rounded-l"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="p-1 hover:bg-zinc-200 text-zinc-600 rounded-r"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-zinc-500">
                        1 unit
                      </span>
                    )}

                    <button
                      onClick={() => updateQuantity(index, -item.quantity)}
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount & Totals Calculation Box */}
          <div className="p-3.5 border-t border-zinc-200 bg-zinc-50/60 space-y-2 text-xs">
            {/* Quick Discount Picker */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-600">Discount:</span>
              <div className="flex items-center gap-1">
                {[0, 3, 5, 10].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleApplyDiscount(pct, true)}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      discountPercent === pct
                        ? "bg-emerald-800 text-white"
                        : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    {pct === 0 ? "None" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {isDiscountElevated && (
              <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Manager Approved: {discountApproverName}</span>
              </div>
            )}

            {/* Breakdown Lines */}
            <div className="pt-2 border-t border-zinc-200/80 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Gross (VAT-Inclusive):</span>
                <span className="font-medium tabular-nums">
                  {formatNaira(grossTotal)}
                </span>
              </div>

              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount Applied:</span>
                  <span className="font-semibold tabular-nums">
                    -{formatNaira(calculatedDiscount)}
                  </span>
                </div>
              )}

              {/* Derived VAT Line: Required by Specification */}
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>VAT (7.5% derived):</span>
                <span className="font-mono tabular-nums">
                  {formatNaira(derivedVat)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-1 border-t border-zinc-200 text-zinc-900 font-extrabold text-base">
                <span>Total Payable:</span>
                <span className="text-emerald-800 text-lg tabular-nums">
                  {formatNaira(payableTotal)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Charge & Collect Payment</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-900 text-emerald-200 rounded">
                F4
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* IMEI Selection Modal (for serialised devices) */}
      {isImeiModalOpen && imeiModalVariant && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Select Physical Device (IMEI)
                </h3>
                <p className="text-xs text-zinc-500">{imeiModalVariant.name}</p>
              </div>
              <button
                onClick={() => setIsImeiModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {availableModalUnits.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 text-xs">
                  No units available in stock at this branch. Please request a
                  transfer.
                </div>
              ) : (
                availableModalUnits.map((unit) => {
                  const product = products.find(
                    (p) => p.id === imeiModalVariant.productId,
                  );
                  return (
                    <div
                      key={unit.id}
                      onClick={() =>
                        product &&
                        addSerialisedToCart(product, imeiModalVariant, unit)
                      }
                      className="p-3 border border-zinc-200 hover:border-emerald-600 rounded-xl cursor-pointer hover:bg-emerald-50/40 transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold text-zinc-900">
                          IMEI 1: {unit.imei1}
                        </div>
                        {unit.imei2 && (
                          <div className="text-[10px] font-mono text-zinc-500">
                            IMEI 2: {unit.imei2}
                          </div>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-semibold mt-1 inline-block">
                          {unit.condition}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs">
                        Select
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Tender Modal (F4) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Process Customer Payment
                </h3>
                <p className="text-xs text-zinc-500">
                  Total Due: <strong>{formatNaira(payableTotal)}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Tender Methods */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: "CARD",
                      label: "POS Card Terminal",
                      icon: CreditCard,
                    },
                    { id: "TRANSFER", label: "Bank Transfer", icon: Building },
                    { id: "CASH", label: "Cash Tender", icon: Banknote },
                    { id: "CREDIT", label: "Customer Credit", icon: UserCheck },
                  ].map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() =>
                          setPaymentMethod(method.id as PaymentMethod)
                        }
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          paymentMethod === method.id
                            ? "border-emerald-700 bg-emerald-50 text-emerald-950 font-bold shadow-xs"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash tendered calculator */}
              {paymentMethod === "CASH" && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Cash Tendered (₦)
                    </label>
                    <input
                      type="number"
                      value={cashTendered || ""}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      placeholder={payableTotal.toString()}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-mono text-sm font-bold bg-white"
                    />
                  </div>
                  {cashTendered > payableTotal && (
                    <div className="flex justify-between items-center text-emerald-800 font-bold">
                      <span>Change Due:</span>
                      <span className="text-sm font-mono">
                        {formatNaira(cashTendered - payableTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* POS Terminal reference */}
              {paymentMethod === "CARD" && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <label className="block text-zinc-600 mb-1">
                    Select Active POS Terminal
                  </label>
                  <select
                    value={posTerminalRef}
                    onChange={(e) => setPosTerminalRef(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white text-xs"
                  >
                    <option value="STANBIC-POS-01">
                      Stanbic IBTC POS Terminal (Counter 1)
                    </option>
                    <option value="MONIEPOINT-POS-02">
                      Moniepoint POS Terminal (Counter 2)
                    </option>
                    <option value="OPAY-POS-03">OPay Smart POS</option>
                  </select>
                </div>
              )}

              {/* Bank Transfer Reference */}
              {paymentMethod === "TRANSFER" && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <label className="block text-zinc-600 mb-1">
                    Bank Session / Narration Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GTB/20260914/89201"
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-white text-xs font-mono"
                  />
                </div>
              )}

              {checkoutError && (
                <p role="alert" className="text-sm text-rose-700">
                  {checkoutError}
                </p>
              )}
              <div className="pt-2 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSale}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirm & Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Elevation PIN Modal (Discount Approval) */}
      <ManagerPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setDiscountPercent(0);
          setDiscountAmount(0);
        }}
        title="Approve Counter Discount"
        reason={`Authorize over-cap discount of ${discountPercent > 0 ? `${discountPercent}%` : formatNaira(discountAmount)} for this transaction`}
        onSuccess={(managerName) => {
          setIsDiscountElevated(true);
          setDiscountApproverName(managerName);
        }}
      />

      {/* Sale Success & Official Thermal Receipt Preview Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-sm overflow-hidden animate-in fade-in duration-100">
            {/* Receipt Content (Thermal Style) */}
            <div className="p-6 bg-white font-mono text-zinc-900 text-xs space-y-3 border-b border-zinc-100">
              <div className="text-center space-y-1">
                <h2 className="text-base font-black tracking-tight uppercase">
                  {businessProfile.receiptHeader}
                </h2>
                <p className="text-[10px] text-zinc-500">
                  {currentLocation?.address || "Lagos, Nigeria"}
                </p>
                <p className="text-[10px] text-zinc-500">
                  Tel: {currentLocation?.phone || "0802 345 6789"}
                </p>
                <div className="border-t border-b border-dashed border-zinc-300 py-1 my-2">
                  <p className="font-bold">
                    RECEIPT #: {completedSale.receiptNumber}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(completedSale.timestamp).toLocaleString("en-NG")}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Cashier: {completedSale.staffName}
                  </p>
                  {completedSale.customerName && (
                    <p className="text-[10px] text-zinc-600 font-sans font-bold">
                      Buyer: {completedSale.customerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-zinc-300 pb-2">
                {completedSale.lines.map((line) => (
                  <div key={line.id} className="text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span className="truncate max-w-[200px]">
                        {line.variantName}
                      </span>
                      <span>{formatNaira(line.total)}</span>
                    </div>
                    {line.imei && (
                      <div className="text-[9px] text-zinc-500">
                        IMEI: {line.imei} (Warranty: 1 Year)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal (Base):</span>
                  <span>{formatNaira(completedSale.subtotal)}</span>
                </div>
                {/* 7.5% Derived VAT line */}
                <div className="flex justify-between text-zinc-600">
                  <span>VAT (7.5% derived):</span>
                  <span>{formatNaira(completedSale.vatAmount)}</span>
                </div>
                {completedSale.discountTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{formatNaira(completedSale.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-900">
                  <span>TOTAL PAID:</span>
                  <span>{formatNaira(completedSale.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Payment Tender:</span>
                  <span>
                    {completedSale.payments.map((p) => p.method).join(" + ")}
                  </span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-zinc-300 text-[10px] text-zinc-500">
                <p className="font-sans font-bold text-zinc-700">
                  {businessProfile.receiptFooter}
                </p>
                <p>{businessProfile.warrantyNotice}</p>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
