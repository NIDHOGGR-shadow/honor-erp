/**
 * Honor — Inventory, Sales & Customer Management
 * Normative TypeScript Definitions v1.0
 */

export type UserRole = "OWNER" | "MANAGER" | "SALES" | "INVENTORY";

export type TrackingType = "SERIALISED" | "QUANTITY";

export type DeviceCondition =
  | "BRAND_NEW"
  | "OPEN_BOX"
  | "REFURBISHED"
  | "PRE_OWNED";

export type UnitStatus =
  | "IN_STOCK"
  | "SOLD"
  | "IN_TRANSIT"
  | "RESERVED"
  | "DEFECTIVE";

export type MovementType =
  | "PURCHASE_RECEIPT"
  | "SALE"
  | "TRANSFER_DISPATCH"
  | "TRANSFER_RECEIVE"
  | "ADJUSTMENT"
  | "RETURN";

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT";

export type SaleStatus = "PAID" | "PARTIALLY_PAID" | "VOIDED";

export type PurchaseStatus =
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type TransferStatus =
  | "DRAFT"
  | "DISPATCHED"
  | "RECEIVED"
  | "DISCREPANCY";

export type LocationType = "BRANCH" | "WAREHOUSE";

// --- Domain Models ---

export interface Location {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  address: string;
  phone: string;
  isWarehouse: boolean; // Warehouse locations cannot sell; branches can!
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  assignedLocationIds: string[]; // ['*'] for all, or specific location IDs
  pin: string; // 4-digit manager PIN for elevations
  status: "ACTIVE" | "INACTIVE";
  salesTarget?: number;
  totalSales?: number;
  avatarUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  trackingType: TrackingType; // Set once at creation, never switched
  description?: string;
  image?: string;
  createdAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  colour?: string;
  storage?: string;
  ram?: string;
  costPrice: number;
  sellingPrice: number; // VAT-inclusive
  barcode?: string;
  isDefault?: boolean;
}

export interface StockUnit {
  id: string;
  variantId: string;
  imei1: string; // 15 digits
  imei2?: string;
  serialNumber?: string;
  costPrice: number;
  condition: DeviceCondition;
  status: UnitStatus;
  locationId: string;
  supplierId?: string;
  customerId?: string; // Set when sold
  saleId?: string;
  warrantyEndDate?: string;
  receivedDate: string;
}

export interface StockLevel {
  id: string;
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  reorderLevel: number;
}

export interface StockMovement {
  id: string;
  referenceNumber: string;
  timestamp: string;
  movementType: MovementType;
  variantId: string;
  stockUnitId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantityChange: number;
  costPrice?: number;
  staffId: string;
  approverStaffId?: string; // Manager who approved elevation
  reason: string;
  notes?: string;
}

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  timestamp: string;
}

export interface SaleLine {
  id: string;
  variantId: string;
  stockUnitId?: string;
  imei?: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number; // VAT-inclusive
  costPrice: number; // Kept internal for owner/manager profit metrics
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  receiptNumber: string; // e.g. HNR-2026-00812
  timestamp: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  locationId: string;
  staffId: string;
  staffName: string;
  lines: SaleLine[];
  subtotal: number;
  discountTotal: number;
  vatAmount: number; // Derived 7.5% from VAT-inclusive total
  grandTotal: number;
  paymentStatus: SaleStatus;
  payments: SalePayment[];
  amountPaid: number;
  balanceDue: number;
  managerApprovedDiscount?: boolean;
  managerApproverName?: string;
  voidReason?: string;
  voidedByStaffId?: string;
  voidedAt?: string;
  notes?: string;
}

export interface PurchaseLine {
  id: string;
  variantId: string;
  variantName: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  imeisRecorded?: string[];
}

export interface Purchase {
  id: string;
  purchaseNumber: string; // e.g. PO-2026-0045
  supplierId: string;
  supplierName: string;
  locationId: string;
  orderDate: string;
  status: PurchaseStatus;
  lines: PurchaseLine[];
  totalAmount: number;
  paidAmount: number;
  expectedDate?: string;
  notes?: string;
}

export interface TransferLine {
  id: string;
  variantId: string;
  variantName: string;
  sku: string;
  stockUnitIds?: string[];
  imeis?: string[];
  quantitySent: number;
  quantityReceived?: number;
}

export interface Transfer {
  id: string;
  transferNumber: string; // e.g. TRF-2026-0012
  fromLocationId: string;
  toLocationId: string;
  status: TransferStatus;
  dispatchDate: string;
  receiveDate?: string;
  dispatchedByStaffId: string;
  receivedByStaffId?: string;
  lines: TransferLine[];
  notes?: string;
}

export interface CustomerDeviceRecord {
  id: string;
  stockUnitId: string;
  variantName: string;
  imei: string;
  serialNumber?: string;
  purchaseDate: string;
  saleId: string;
  receiptNumber: string;
  warrantyExpiry: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  ninOrBvn?: string;
  balance: number; // Positive = credit debt owed to store, Negative = advance payment
  creditLimit: number;
  devicesOwned: CustomerDeviceRecord[];
  notes?: string;
  salesCount: number;
  totalSpent: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankDetails?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  balance: number; // Outstanding balance owed to supplier
  notes?: string;
  purchasesCount: number;
  totalPurchased: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type:
    | "LOW_STOCK"
    | "OUT_OF_STOCK"
    | "TRANSFER_PENDING"
    | "PAYMENT_DUE"
    | "CUSTOMER_OVERDUE"
    | "SALE_VOIDED";
  timestamp: string;
  read: boolean;
  linkModule?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  role: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
}

export type ModuleType =
  | "dashboard"
  | "inventory"
  | "add-stock"
  | "stock-movements"
  | "transfers"
  | "pos"
  | "sales"
  | "purchases"
  | "customers"
  | "suppliers"
  | "reports"
  | "staff"
  | "settings";

export type ReportId =
  | "gross-profit"
  | "sales-by-staff"
  | "sales-by-category"
  | "sales-by-branch"
  | "stock-valuation"
  | "low-stock-aging"
  | "movement-ledger"
  | "customer-balances"
  | "supplier-payables"
  | "tax-vat-summary"
  | "discounts-margins";
