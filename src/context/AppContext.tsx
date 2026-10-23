/**
 * Honor — Global Application State & Store
 * Manages all 11 domain objects, global location context, role elevation & persistence
 */

import { changeStock, validateDevices } from "../utils/stockRules";
import { canAccessModule } from "../utils/formatters";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  UserRole,
  Location,
  Staff,
  Product,
  Variant,
  StockUnit,
  StockLevel,
  StockMovement,
  Sale,
  Purchase,
  Transfer,
  Customer,
  Supplier,
  NotificationItem,
  AuditLogEntry,
  ModuleType,
  ReportId,
  SaleLine,
  TransferLine,
} from "../types";
import {
  INITIAL_LOCATIONS,
  INITIAL_STAFF,
  INITIAL_PRODUCTS,
  INITIAL_VARIANTS,
  INITIAL_STOCK_UNITS,
  INITIAL_STOCK_LEVELS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_TRANSFERS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_MOVEMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
} from "../data/mockData";

interface AppContextType {
  // Navigation & View
  activeModule: ModuleType;
  setActiveModule: (mod: ModuleType) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  selectedSupplierId: string | null;
  setSelectedSupplierId: (id: string | null) => void;
  selectedSaleId: string | null;
  setSelectedSaleId: (id: string | null) => void;
  selectedTransferId: string | null;
  setSelectedTransferId: (id: string | null) => void;
  selectedPurchaseId: string | null;
  setSelectedPurchaseId: (id: string | null) => void;
  activeReportId: ReportId;
  setActiveReportId: (rep: ReportId) => void;

  // Global Context
  activeLocationId: string; // 'ALL' or specific location ID
  setActiveLocationId: (locId: string) => void;
  currentLocation: Location | null;
  activeStaff: Staff;
  switchStaffRole: (role: UserRole) => void;
  setActiveStaff: (staff: Staff) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (col: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;

  // Data collections
  locations: Location[];
  staffList: Staff[];
  products: Product[];
  variants: Variant[];
  stockUnits: StockUnit[];
  stockLevels: StockLevel[];
  stockMovements: StockMovement[];
  sales: Sale[];
  purchases: Purchase[];
  transfers: Transfer[];
  customers: Customer[];
  suppliers: Supplier[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];

  // Mutators & Operations
  addPurchase: (purchase: Purchase) => void;
  createSale: (
    saleData: Omit<Sale, "id" | "receiptNumber" | "timestamp">,
  ) => Sale;
  voidSale: (saleId: string, reason: string) => boolean;
  receivePurchase: (
    purchaseId: string,
    unitsToReceive: { variantId: string; imeis: string[]; quantity: number }[],
  ) => void;
  dispatchTransfer: (
    fromLocId: string,
    toLocId: string,
    lines: TransferLine[],
    notes?: string,
  ) => Transfer;
  receiveTransfer: (transferId: string) => void;
  createAdjustment: (
    variantId: string,
    locationId: string,
    quantityChange: number,
    reason: string,
    approverStaffId?: string,
    serialUnit?: { imei1: string; condition: any; costPrice: number },
  ) => void;
  addProduct: (product: Product, variants: Variant[]) => void;
  updateProduct: (product: Product, variants: Variant[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  addStaff: (staff: Staff) => void;
  updateStaff: (staff: Staff) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  verifyManagerPin: (pin: string) => Staff | null;
  resetToDemoData: () => void;

  // Computed helpers
  lowStockCount: number;
  pendingTransfersCount: number;
  unreadNotificationsCount: number;
}

const STORAGE_PREFIX = "honor_inventory_v2_";

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Navigation
  const [activeModule, setActiveModuleState] = useState<ModuleType>(() => {
    const hash = window.location.hash
      .replace("#/", "")
      .split("?")[0] as ModuleType;
    return hash &&
      [
        "dashboard",
        "inventory",
        "add-stock",
        "stock-movements",
        "transfers",
        "pos",
        "sales",
        "purchases",
        "customers",
        "suppliers",
        "reports",
        "staff",
        "settings",
      ].includes(hash)
      ? hash
      : "dashboard";
  });

  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    null,
  );
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null,
  );
  const [activeReportId, setActiveReportId] =
    useState<ReportId>("gross-profit");

  // Sidebar & Search UI
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // Active Staff & Role
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "staff");
    return saved ? JSON.parse(saved) : INITIAL_STAFF;
  });

  const [activeStaff, setActiveStaff] = useState<Staff>(() => {
    return staffList.find((s) => s.role === "OWNER") || staffList[0];
  });

  // Global Location Context
  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "locations");
    return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
  });

  const [activeLocationId, setActiveLocationIdState] =
    useState<string>("loc-ikeja");

  // Products & Variants
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "products");
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [variants, setVariants] = useState<Variant[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "variants");
    return saved ? JSON.parse(saved) : INITIAL_VARIANTS;
  });

  // Stock Units & Levels
  const [stockUnits, setStockUnits] = useState<StockUnit[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "stock_units");
    return saved ? JSON.parse(saved) : INITIAL_STOCK_UNITS;
  });

  const [stockLevels, setStockLevels] = useState<StockLevel[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "stock_levels");
    return saved ? JSON.parse(saved) : INITIAL_STOCK_LEVELS;
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "stock_movements");
    return saved ? JSON.parse(saved) : INITIAL_MOVEMENTS;
  });

  // Sales & Purchases
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "sales");
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "purchases");
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  // Transfers
  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "transfers");
    return saved ? JSON.parse(saved) : INITIAL_TRANSFERS;
  });

  // CRM: Customers & Suppliers
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "customers");
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "suppliers");
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  // Notifications & Audit
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "notifications");
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + "audit_logs");
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  // Keep localStorage updated
  useEffect(() => {
    localStorage.setItem(STORAGE_PREFIX + "products", JSON.stringify(products));
    localStorage.setItem(STORAGE_PREFIX + "variants", JSON.stringify(variants));
    localStorage.setItem(
      STORAGE_PREFIX + "stock_units",
      JSON.stringify(stockUnits),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "stock_levels",
      JSON.stringify(stockLevels),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "stock_movements",
      JSON.stringify(stockMovements),
    );
    localStorage.setItem(STORAGE_PREFIX + "sales", JSON.stringify(sales));
    localStorage.setItem(
      STORAGE_PREFIX + "purchases",
      JSON.stringify(purchases),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "transfers",
      JSON.stringify(transfers),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "customers",
      JSON.stringify(customers),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "suppliers",
      JSON.stringify(suppliers),
    );
    localStorage.setItem(STORAGE_PREFIX + "staff", JSON.stringify(staffList));
    localStorage.setItem(
      STORAGE_PREFIX + "locations",
      JSON.stringify(locations),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "notifications",
      JSON.stringify(notifications),
    );
    localStorage.setItem(
      STORAGE_PREFIX + "audit_logs",
      JSON.stringify(auditLogs),
    );
  }, [
    products,
    variants,
    stockUnits,
    stockLevels,
    stockMovements,
    sales,
    purchases,
    transfers,
    customers,
    suppliers,
    staffList,
    locations,
    notifications,
    auditLogs,
  ]);

  // Sync route with browser hash
  const setActiveModule = (mod: ModuleType) => {
    if (!canAccessModule(activeStaff.role, mod)) return;
    setActiveModuleState(mod);
    window.location.hash = `#/${mod}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
        .replace("#/", "")
        .split("?")[0] as ModuleType;
      if (hash && hash !== activeModule) {
        setActiveModuleState(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeModule]);

  // Demo scoping is for product review; the production API must enforce this independently.
  const setActiveLocationId = (locId: string) => {
    if (locId === "ALL" && !activeStaff.assignedLocationIds.includes("*"))
      return;
    if (locId !== "ALL" && !locations.some((l) => l.id === locId)) return;
    if (
      !activeStaff.assignedLocationIds.includes("*") &&
      !activeStaff.assignedLocationIds.includes(locId)
    )
      return;
    setActiveLocationIdState(locId);
  };
  const activateStaff = (person: Staff) => {
    if (person.status !== "ACTIVE") return;
    setActiveStaff(person);
    if (!person.assignedLocationIds.includes("*"))
      setActiveLocationIdState(person.assignedLocationIds[0]);
    setActiveModuleState("dashboard");
    window.location.hash = "#/dashboard";
  };
  const switchStaffRole = (role: UserRole) => {
    const person = staffList.find(
      (s) =>
        s.role === role &&
        s.status === "ACTIVE" &&
        (s.assignedLocationIds.includes("*") ||
          s.assignedLocationIds.includes(activeLocationId)),
    );
    if (person) activateStaff(person);
  };
  const assertLocation = (locationId: string) => {
    if (
      !locations.some((l) => l.id === locationId) ||
      (!activeStaff.assignedLocationIds.includes("*") &&
        !activeStaff.assignedLocationIds.includes(locationId))
    )
      throw new Error("This location is outside your assigned access.");
  };
  const addPurchase = (purchase: Purchase) => {
    if (!canAccessModule(activeStaff.role, "purchases"))
      throw new Error("Purchasing access is required.");
    assertLocation(purchase.locationId);
    if (
      !purchase.lines.length ||
      purchase.lines.some(
        (l) =>
          !Number.isSafeInteger(l.quantityOrdered) ||
          l.quantityOrdered <= 0 ||
          l.unitCost < 0,
      )
    )
      throw new Error("Enter valid purchase quantities and costs.");
    setPurchases((prev) => [purchase, ...prev]);
  };

  const currentLocation = useMemo(() => {
    if (activeLocationId === "ALL") return null;
    return locations.find((l) => l.id === activeLocationId) || null;
  }, [activeLocationId, locations]);

  // Low stock calculation
  const lowStockCount = useMemo(() => {
    return stockLevels.filter((sl) => {
      if (activeLocationId !== "ALL" && sl.locationId !== activeLocationId)
        return false;
      return sl.onHand <= sl.reorderLevel;
    }).length;
  }, [stockLevels, activeLocationId]);

  // Pending transfers calculation (dispatched and awaiting receipt at active branch)
  const pendingTransfersCount = useMemo(() => {
    return transfers.filter((t) => {
      if (t.status !== "DISPATCHED") return false;
      if (activeLocationId !== "ALL" && t.toLocationId !== activeLocationId)
        return false;
      return true;
    }).length;
  }, [transfers, activeLocationId]);

  // Unread notifications
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Manager PIN verification for elevations
  const verifyManagerPin = (pin: string): Staff | null => {
    const approver = staffList.find(
      (s) =>
        (s.role === "OWNER" || s.role === "MANAGER") &&
        s.pin === pin &&
        s.status === "ACTIVE" &&
        (s.assignedLocationIds.includes("*") ||
          s.assignedLocationIds.includes(activeLocationId)),
    );
    return approver || null;
  };

  // --- Operations ---

  // 1. Create Sale (POS Checkout)
  const createSale = (
    saleData: Omit<Sale, "id" | "receiptNumber" | "timestamp">,
  ): Sale => {
    if (!canAccessModule(activeStaff.role, "pos"))
      throw new Error("Sales access is required.");
    assertLocation(saleData.locationId);
    if (locations.find((l) => l.id === saleData.locationId)?.isWarehouse)
      throw new Error("Sales require a retail location.");
    validateDevices(stockUnits, saleData.locationId, saleData.lines);
    for (const line of saleData.lines) {
      const variant = variants.find((v) => v.id === line.variantId);
      if (!variant) throw new Error("Unknown item.");
      if (
        products.find((p) => p.id === variant.productId)?.trackingType ===
          "SERIALISED" &&
        !line.stockUnitId
      )
        throw new Error("Select a specific device IMEI.");
    }
    const nextLevels = changeStock(
      stockLevels,
      saleData.locationId,
      saleData.lines,
      -1,
    );
    const now = new Date().toISOString();
    const receiptNum = `HNR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newSaleId = `sale-${Date.now()}`;

    const newSale: Sale = {
      ...saleData,
      id: newSaleId,
      receiptNumber: receiptNum,
      timestamp: now,
    };

    // 1. Update Stock Units (status -> SOLD, customer, saleId)
    const unitIdsToSell = saleData.lines
      .filter((l) => l.stockUnitId)
      .map((l) => l.stockUnitId as string);
    if (unitIdsToSell.length > 0) {
      setStockUnits((prev) =>
        prev.map((u) => {
          if (unitIdsToSell.includes(u.id)) {
            return {
              ...u,
              status: "SOLD",
              customerId: saleData.customerId,
              saleId: newSaleId,
              warrantyEndDate: new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000,
              ).toISOString(), // 1 year standard warranty
            };
          }
          return u;
        }),
      );
    }

    setStockLevels(nextLevels);

    // 3. Write Stock Movements (Immutable Ledger!)
    const newMovements: StockMovement[] = saleData.lines.map((line) => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      referenceNumber: receiptNum,
      timestamp: now,
      movementType: "SALE",
      variantId: line.variantId,
      stockUnitId: line.stockUnitId,
      fromLocationId: saleData.locationId,
      quantityChange: -line.quantity,
      costPrice: line.costPrice,
      staffId: saleData.staffId,
      reason: `POS Sale #${receiptNum} to ${saleData.customerName || "Walk-in Customer"}${line.imei ? ` (IMEI: ${line.imei})` : ""}`,
    }));

    setStockMovements((prev) => [...newMovements, ...prev]);

    // 4. Update Customer record if attached
    if (saleData.customerId) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === saleData.customerId) {
            const deviceRecords = saleData.lines
              .filter((l) => l.stockUnitId && l.imei)
              .map((l) => ({
                id: `cd-${Date.now()}-${l.stockUnitId}`,
                stockUnitId: l.stockUnitId!,
                variantName: l.variantName,
                imei: l.imei!,
                purchaseDate: now,
                saleId: newSaleId,
                receiptNumber: receiptNum,
                warrantyExpiry: new Date(
                  Date.now() + 365 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              }));

            const newBalance =
              saleData.balanceDue > 0
                ? c.balance + saleData.balanceDue
                : c.balance;

            return {
              ...c,
              salesCount: c.salesCount + 1,
              totalSpent: c.totalSpent + saleData.grandTotal,
              balance: newBalance,
              devicesOwned: [...deviceRecords, ...c.devicesOwned],
            };
          }
          return c;
        }),
      );
    }

    // 5. Append Sale
    setSales((prev) => [newSale, ...prev]);

    // 6. Write Audit Log
    const audit: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: now,
      staffId: saleData.staffId,
      staffName: saleData.staffName,
      role: activeStaff.role,
      action: "SALE_COMPLETED",
      entityType: "Sale",
      entityId: newSaleId,
      details: `Completed Sale #${receiptNum} for ${saleData.grandTotal} NGN (${saleData.lines.length} items)`,
    };
    setAuditLogs((prev) => [audit, ...prev]);

    return newSale;
  };

  // 2. Void Sale
  const voidSale = (saleId: string, reason: string): boolean => {
    if (activeStaff.role !== "OWNER" && activeStaff.role !== "MANAGER")
      throw new Error("Manager approval is required to void a sale.");
    const saleToVoid = sales.find((s) => s.id === saleId);
    if (!saleToVoid || saleToVoid.paymentStatus === "VOIDED") return false;
    assertLocation(saleToVoid.locationId);

    const now = new Date().toISOString();

    // Revert Stock Units
    const unitIds = saleToVoid.lines
      .filter((l) => l.stockUnitId)
      .map((l) => l.stockUnitId as string);
    if (unitIds.length > 0) {
      setStockUnits((prev) =>
        prev.map((u) => {
          if (unitIds.includes(u.id)) {
            return {
              ...u,
              status: "IN_STOCK",
              customerId: undefined,
              saleId: undefined,
              warrantyEndDate: undefined,
            };
          }
          return u;
        }),
      );
    }

    setStockLevels((prev) =>
      changeStock(prev, saleToVoid.locationId, saleToVoid.lines, 1),
    );
    if (saleToVoid.customerId)
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === saleToVoid.customerId
            ? {
                ...c,
                totalSpent: Math.max(0, c.totalSpent - saleToVoid.grandTotal),
                balance: c.balance - saleToVoid.balanceDue,
                salesCount: Math.max(0, c.salesCount - 1),
                devicesOwned: c.devicesOwned.filter((d) => d.saleId !== saleId),
              }
            : c,
        ),
      );

    // Write Reversal Stock Movements
    const reversalMovements: StockMovement[] = saleToVoid.lines.map((line) => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      referenceNumber: `VOID-${saleToVoid.receiptNumber}`,
      timestamp: now,
      movementType: "RETURN",
      variantId: line.variantId,
      stockUnitId: line.stockUnitId,
      toLocationId: saleToVoid.locationId,
      quantityChange: line.quantity,
      costPrice: line.costPrice,
      staffId: activeStaff.id,
      reason: `Voided Sale #${saleToVoid.receiptNumber}: ${reason}`,
    }));
    setStockMovements((prev) => [...reversalMovements, ...prev]);

    // Update Sale status
    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId
          ? {
              ...s,
              paymentStatus: "VOIDED",
              voidReason: reason,
              voidedByStaffId: activeStaff.id,
              voidedAt: now,
            }
          : s,
      ),
    );

    // Audit Log
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: now,
        staffId: activeStaff.id,
        staffName: activeStaff.name,
        role: activeStaff.role,
        action: "SALE_VOIDED",
        entityType: "Sale",
        entityId: saleId,
        details: `Voided Sale #${saleToVoid.receiptNumber}. Reason: ${reason}`,
      },
      ...prev,
    ]);

    return true;
  };

  // 3. Receive Purchase Orders
  const receivePurchase = (
    purchaseId: string,
    unitsToReceive: { variantId: string; imeis: string[]; quantity: number }[],
  ) => {
    if (!canAccessModule(activeStaff.role, "add-stock"))
      throw new Error("Stock receiving access is required.");
    const po = purchases.find((p) => p.id === purchaseId);
    if (!po || po.status === "RECEIVED" || po.status === "CANCELLED")
      throw new Error("This order is not open for receiving.");
    assertLocation(po.locationId);
    if (!unitsToReceive.length) throw new Error("Select items to receive.");
    const imeis = new Set(stockUnits.map((u) => u.imei1));
    const seenVariants = new Set<string>();
    unitsToReceive.forEach((group) => {
      const line = po.lines.find((l) => l.variantId === group.variantId);
      if (seenVariants.has(group.variantId))
        throw new Error("Combine receipt quantities for the same item.");
      seenVariants.add(group.variantId);
      if (
        !line ||
        !Number.isSafeInteger(group.quantity) ||
        group.quantity <= 0 ||
        group.quantity > line.quantityOrdered - line.quantityReceived
      )
        throw new Error("Receipt exceeds the remaining ordered quantity.");
      const product = products.find(
        (p) =>
          p.id === variants.find((v) => v.id === group.variantId)?.productId,
      );
      if (
        product?.trackingType === "SERIALISED" &&
        group.imeis.length !== group.quantity
      )
        throw new Error("Record one IMEI for each received device.");
      group.imeis.forEach((imei) => {
        if (!/^\d{15}$/.test(imei) || imeis.has(imei))
          throw new Error("IMEIs must be unique 15-digit numbers.");
        imeis.add(imei);
      });
    });

    const now = new Date().toISOString();
    const newUnits: StockUnit[] = [];
    const newMovements: StockMovement[] = [];

    unitsToReceive.forEach((group) => {
      const variant = variants.find((v) => v.id === group.variantId);
      const cost =
        po.lines.find((l) => l.variantId === group.variantId)?.unitCost || 0;

      // If serialised (has IMEIs)
      if (group.imeis && group.imeis.length > 0) {
        group.imeis.forEach((imei) => {
          const unitId = `unit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const unit: StockUnit = {
            id: unitId,
            variantId: group.variantId,
            imei1: imei,
            costPrice: cost,
            condition: "BRAND_NEW",
            status: "IN_STOCK",
            locationId: po.locationId,
            supplierId: po.supplierId,
            receivedDate: now,
          };
          newUnits.push(unit);

          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            referenceNumber: po.purchaseNumber,
            timestamp: now,
            movementType: "PURCHASE_RECEIPT",
            variantId: group.variantId,
            stockUnitId: unitId,
            toLocationId: po.locationId,
            quantityChange: 1,
            costPrice: cost,
            staffId: activeStaff.id,
            reason: `PO Receipt #${po.purchaseNumber} (IMEI: ${imei})`,
          });
        });
      } else {
        // Quantity-based accessory
        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          referenceNumber: po.purchaseNumber,
          timestamp: now,
          movementType: "PURCHASE_RECEIPT",
          variantId: group.variantId,
          toLocationId: po.locationId,
          quantityChange: group.quantity,
          costPrice: cost,
          staffId: activeStaff.id,
          reason: `PO Receipt #${po.purchaseNumber} (${group.quantity} units)`,
        });
      }

      // Update Stock Levels
      setStockLevels((prev) => {
        const existing = prev.find(
          (sl) =>
            sl.variantId === group.variantId && sl.locationId === po.locationId,
        );
        if (existing) {
          return prev.map((sl) =>
            sl.id === existing.id
              ? { ...sl, onHand: sl.onHand + group.quantity }
              : sl,
          );
        } else {
          return [
            ...prev,
            {
              id: `sl-${Date.now()}-${group.variantId}`,
              variantId: group.variantId,
              locationId: po.locationId,
              onHand: group.quantity,
              reserved: 0,
              reorderLevel: 5,
            },
          ];
        }
      });
    });

    if (newUnits.length > 0) {
      setStockUnits((prev) => [...newUnits, ...prev]);
    }
    setStockMovements((prev) => [...newMovements, ...prev]);

    // Update Purchase status
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === purchaseId
          ? {
              ...p,
              status: p.lines.every(
                (l) =>
                  l.quantityReceived +
                    (unitsToReceive.find((g) => g.variantId === l.variantId)
                      ?.quantity || 0) >=
                  l.quantityOrdered,
              )
                ? "RECEIVED"
                : "PARTIALLY_RECEIVED",
              lines: p.lines.map((l) => ({
                ...l,
                quantityReceived:
                  l.quantityReceived +
                  (unitsToReceive.find((g) => g.variantId === l.variantId)
                    ?.quantity || 0),
              })),
            }
          : p,
      ),
    );
  };

  // 4. Dispatch Transfer
  const dispatchTransfer = (
    fromLocId: string,
    toLocId: string,
    lines: TransferLine[],
    notes?: string,
  ): Transfer => {
    if (!canAccessModule(activeStaff.role, "transfers"))
      throw new Error("Transfer access is required.");
    assertLocation(fromLocId);
    if (fromLocId === toLocId || !locations.some((l) => l.id === toLocId))
      throw new Error("Choose a different destination location.");
    const stockLines = lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantitySent,
    }));
    const nextLevels = changeStock(stockLevels, fromLocId, stockLines, -1);
    for (const line of lines) {
      const product = products.find(
        (p) =>
          p.id === variants.find((v) => v.id === line.variantId)?.productId,
      );
      if (
        product?.trackingType === "SERIALISED" &&
        line.stockUnitIds?.length !== line.quantitySent
      )
        throw new Error("Select one device IMEI per transferred unit.");
    }
    validateDevices(
      stockUnits,
      fromLocId,
      lines.flatMap((l) =>
        (l.stockUnitIds || []).map((id) => ({
          variantId: l.variantId,
          quantity: 1,
          stockUnitId: id,
        })),
      ),
    );
    const now = new Date().toISOString();
    const trfNum = `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTrfId = `trf-${Date.now()}`;

    const newTrf: Transfer = {
      id: newTrfId,
      transferNumber: trfNum,
      fromLocationId: fromLocId,
      toLocationId: toLocId,
      status: "DISPATCHED",
      dispatchDate: now,
      dispatchedByStaffId: activeStaff.id,
      lines,
      notes,
    };

    // Mark Serialised stock units as IN_TRANSIT
    const dispatchedUnitIds = lines.flatMap((l) => l.stockUnitIds || []);
    if (dispatchedUnitIds.length > 0) {
      setStockUnits((prev) =>
        prev.map((u) => {
          if (dispatchedUnitIds.includes(u.id)) {
            return {
              ...u,
              status: "IN_TRANSIT",
            };
          }
          return u;
        }),
      );
    }

    setStockLevels(nextLevels);

    // Stock Movement Ledger
    const movements: StockMovement[] = lines.map((line) => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      referenceNumber: trfNum,
      timestamp: now,
      movementType: "TRANSFER_DISPATCH",
      variantId: line.variantId,
      fromLocationId: fromLocId,
      toLocationId: toLocId,
      quantityChange: -line.quantitySent,
      staffId: activeStaff.id,
      reason: `Transfer dispatch #${trfNum}`,
    }));
    setStockMovements((prev) => [...movements, ...prev]);

    setTransfers((prev) => [newTrf, ...prev]);

    // Create notification for destination branch
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `Transfer #${trfNum} Dispatched`,
        message: `${lines.length} items in transit from ${locations.find((l) => l.id === fromLocId)?.name} to ${locations.find((l) => l.id === toLocId)?.name}`,
        type: "TRANSFER_PENDING",
        timestamp: now,
        read: false,
        linkModule: "transfers",
      },
      ...prev,
    ]);

    return newTrf;
  };

  // 5. Receive Transfer
  const receiveTransfer = (transferId: string) => {
    const trf = transfers.find((t) => t.id === transferId);
    if (!trf || trf.status !== "DISPATCHED")
      throw new Error("This transfer is not waiting to be received.");
    assertLocation(trf.toLocationId);

    const now = new Date().toISOString();

    // Mark Serialised stock units as IN_STOCK at destination
    const unitIds = trf.lines.flatMap((l) => l.stockUnitIds || []);
    if (unitIds.length > 0) {
      setStockUnits((prev) =>
        prev.map((u) => {
          if (unitIds.includes(u.id)) {
            return {
              ...u,
              status: "IN_STOCK",
              locationId: trf.toLocationId,
            };
          }
          return u;
        }),
      );
    }

    // Increment destination stock level
    setStockLevels((prev) => {
      let updated = [...prev];
      trf.lines.forEach((line) => {
        const existing = updated.find(
          (sl) =>
            sl.locationId === trf.toLocationId &&
            sl.variantId === line.variantId,
        );
        if (existing) {
          updated = updated.map((sl) =>
            sl.id === existing.id
              ? { ...sl, onHand: sl.onHand + line.quantitySent }
              : sl,
          );
        } else {
          updated.push({
            id: `sl-${Date.now()}-${line.variantId}`,
            variantId: line.variantId,
            locationId: trf.toLocationId,
            onHand: line.quantitySent,
            reserved: 0,
            reorderLevel: 3,
          });
        }
      });
      return updated;
    });

    // Write receive stock movements
    const movements: StockMovement[] = trf.lines.map((line) => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      referenceNumber: trf.transferNumber,
      timestamp: now,
      movementType: "TRANSFER_RECEIVE",
      variantId: line.variantId,
      toLocationId: trf.toLocationId,
      quantityChange: line.quantitySent,
      staffId: activeStaff.id,
      reason: `Transfer received #${trf.transferNumber}`,
    }));
    setStockMovements((prev) => [...movements, ...prev]);

    // Update Transfer
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === transferId
          ? {
              ...t,
              status: "RECEIVED",
              receiveDate: now,
              receivedByStaffId: activeStaff.id,
            }
          : t,
      ),
    );
  };

  // 6. Manual Stock Adjustment
  const createAdjustment = (
    variantId: string,
    locationId: string,
    quantityChange: number,
    reason: string,
    approverStaffId?: string,
    serialUnit?: { imei1: string; condition: any; costPrice: number },
  ) => {
    assertLocation(locationId);
    if (!canAccessModule(activeStaff.role, "add-stock"))
      throw new Error("Stock adjustment access is required.");
    if (
      !Number.isSafeInteger(quantityChange) ||
      quantityChange === 0 ||
      !reason.trim()
    )
      throw new Error("Enter a whole-number adjustment and a reason.");
    if (
      activeStaff.role === "INVENTORY" &&
      !staffList.some(
        (s) =>
          s.id === approverStaffId &&
          ["OWNER", "MANAGER"].includes(s.role) &&
          s.status === "ACTIVE" &&
          (s.assignedLocationIds.includes("*") ||
            s.assignedLocationIds.includes(locationId)),
      )
    )
      throw new Error("An assigned manager must approve this adjustment.");
    const tracked =
      products.find(
        (p) => p.id === variants.find((v) => v.id === variantId)?.productId,
      )?.trackingType === "SERIALISED";
    if (
      tracked &&
      (quantityChange !== 1 ||
        !serialUnit ||
        !/^\d{15}$/.test(serialUnit.imei1) ||
        stockUnits.some((u) => u.imei1 === serialUnit.imei1))
    )
      throw new Error(
        "Add one device at a time using a unique 15-digit IMEI. Use the sale reversal workflow for returns.",
      );
    const adjustedLevels = changeStock(
      stockLevels,
      locationId,
      [{ variantId, quantity: Math.abs(quantityChange) }],
      quantityChange > 0 ? 1 : -1,
    );
    const now = new Date().toISOString();
    const ref = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let newUnitId: string | undefined = undefined;

    if (serialUnit && quantityChange > 0) {
      newUnitId = `unit-${Date.now()}`;
      const newUnit: StockUnit = {
        id: newUnitId,
        variantId,
        imei1: serialUnit.imei1,
        costPrice: serialUnit.costPrice,
        condition: serialUnit.condition || "BRAND_NEW",
        status: "IN_STOCK",
        locationId,
        receivedDate: now,
      };
      setStockUnits((prev) => [newUnit, ...prev]);
    }

    setStockLevels(adjustedLevels);

    // Write Stock Movement
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      referenceNumber: ref,
      timestamp: now,
      movementType: "ADJUSTMENT",
      variantId,
      stockUnitId: newUnitId,
      toLocationId: locationId,
      quantityChange,
      staffId: activeStaff.id,
      approverStaffId,
      reason,
    };
    setStockMovements((prev) => [movement, ...prev]);

    // Audit Log
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: now,
        staffId: activeStaff.id,
        staffName: activeStaff.name,
        role: activeStaff.role,
        action: "STOCK_ADJUSTMENT",
        entityType: "Variant",
        entityId: variantId,
        details: `Stock adjustment of ${quantityChange > 0 ? `+${quantityChange}` : quantityChange} units at ${locations.find((l) => l.id === locationId)?.name}. Reason: ${reason}`,
      },
      ...prev,
    ]);
  };

  // 7. Add & Update Product / Variants
  const addProduct = (product: Product, newVariants: Variant[]) => {
    setProducts((prev) => [product, ...prev]);
    setVariants((prev) => [...newVariants, ...prev]);
    // Initialize stock levels across locations
    const newLevels: StockLevel[] = [];
    newVariants.forEach((v) => {
      locations.forEach((loc) => {
        newLevels.push({
          id: `sl-${Date.now()}-${v.id}-${loc.id}`,
          variantId: v.id,
          locationId: loc.id,
          onHand: 0,
          reserved: 0,
          reorderLevel: 3,
        });
      });
    });
    setStockLevels((prev) => [...newLevels, ...prev]);
  };

  const updateProduct = (product: Product, updatedVariants: Variant[]) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
    setVariants((prev) => {
      const filtered = prev.filter((v) => v.productId !== product.id);
      return [...filtered, ...updatedVariants];
    });
  };

  // 8. CRM Operations
  const addCustomer = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
  };

  const updateCustomer = (customer: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customer.id ? customer : c)),
    );
  };

  const addSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => [supplier, ...prev]);
  };

  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? supplier : s)),
    );
  };

  const addStaff = (staff: Staff) => {
    if (activeStaff.role !== "OWNER")
      throw new Error("Only the company administrator can manage access.");
    setStaffList((prev) => [...prev, staff]);
  };

  const updateStaff = (staff: Staff) => {
    if (activeStaff.role !== "OWNER")
      throw new Error("Only the company administrator can manage access.");
    setStaffList((prev) => prev.map((s) => (s.id === staff.id ? staff : s)));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const clearAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Reset to initial demo data
  const resetToDemoData = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
    setProducts(INITIAL_PRODUCTS);
    setVariants(INITIAL_VARIANTS);
    setStockUnits(INITIAL_STOCK_UNITS);
    setStockLevels(INITIAL_STOCK_LEVELS);
    setStockMovements(INITIAL_MOVEMENTS);
    setSales(INITIAL_SALES);
    setPurchases(INITIAL_PURCHASES);
    setTransfers(INITIAL_TRANSFERS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setStaffList(INITIAL_STAFF);
    setLocations(INITIAL_LOCATIONS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setActiveLocationIdState("loc-ikeja");
    setActiveStaff(INITIAL_STAFF[0]);
  };

  return (
    <AppContext.Provider
      value={{
        activeModule,
        setActiveModule,
        selectedProductId,
        setSelectedProductId,
        selectedCustomerId,
        setSelectedCustomerId,
        selectedSupplierId,
        setSelectedSupplierId,
        selectedSaleId,
        setSelectedSaleId,
        selectedTransferId,
        setSelectedTransferId,
        selectedPurchaseId,
        setSelectedPurchaseId,
        activeReportId,
        setActiveReportId,
        activeLocationId,
        setActiveLocationId,
        currentLocation,
        activeStaff,
        switchStaffRole,
        setActiveStaff: activateStaff,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
        locations,
        staffList,
        products,
        variants,
        stockUnits,
        stockLevels,
        stockMovements,
        sales,
        purchases,
        transfers,
        customers,
        suppliers,
        notifications,
        auditLogs,
        addPurchase,
        createSale,
        voidSale,
        receivePurchase,
        dispatchTransfer,
        receiveTransfer,
        createAdjustment,
        addProduct,
        updateProduct,
        addCustomer,
        updateCustomer,
        addSupplier,
        updateSupplier,
        addStaff,
        updateStaff,
        markNotificationRead,
        clearAllNotifications,
        verifyManagerPin,
        resetToDemoData,
        lowStockCount,
        pendingTransfersCount,
        unreadNotificationsCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
