import type {
  Location, Staff, Product, Variant, StockUnit, StockLevel, StockMovement,
  Sale, Purchase, Transfer, Customer, Supplier, NotificationItem, AuditLogEntry,
} from "../types";

export interface PreviewData {
  locations: Location[];
  staff: Staff[];
  products: Product[];
  variants: Variant[];
  stockUnits: StockUnit[];
  stockLevels: StockLevel[];
  movements: StockMovement[];
  sales: Sale[];
  purchases: Purchase[];
  transfers: Transfer[];
  customers: Customer[];
  suppliers: Supplier[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
}

// Display context only. This is not an identity, account, or authentication credential.
export const PREVIEW_SESSION: Staff = {
  id: "preview-session",
  name: "Preview session",
  email: "",
  phone: "",
  role: "OWNER",
  assignedLocationIds: ["*"],
  pin: "",
  status: "ACTIVE",
};

export function emptyPreviewData(): PreviewData {
  return {
    locations: [], staff: [], products: [], variants: [], stockUnits: [],
    stockLevels: [], movements: [], sales: [], purchases: [], transfers: [],
    customers: [], suppliers: [], notifications: [], auditLogs: [],
  };
}
