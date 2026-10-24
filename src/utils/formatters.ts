/**
 * Honor — Formatting and Calculation Utilities
 * Locale: en-NG, Timezone: Africa/Lagos, Currency: NGN (₦)
 * VAT: 7.5% derived from VAT-inclusive totals
 */

import { UserRole } from "../types";

export const VAT_RATE = 0.075; // 7.5%

/**
 * Format currency in Nigerian Naira (₦)
 * e.g., ₦1,250,000 (no kobo unless decimal exists)
 */
export function formatNaira(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "₦0";
  }
  const hasKobo = amount % 1 !== 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("NGN", "₦");
}

/**
 * Calculate derived VAT from VAT-inclusive total
 * Since price is inclusive: Base = Total / 1.075, VAT = Total - Base
 */
export function calculateDerivedVat(inclusiveTotal: number): number {
  if (!inclusiveTotal || inclusiveTotal <= 0) return 0;
  const base = inclusiveTotal / (1 + VAT_RATE);
  return Math.round(inclusiveTotal - base);
}

/**
 * Calculate base amount before VAT
 */
export function calculateVatBase(inclusiveTotal: number): number {
  if (!inclusiveTotal || inclusiveTotal <= 0) return 0;
  return inclusiveTotal - calculateDerivedVat(inclusiveTotal);
}

/**
 * Format date in Africa/Lagos standard
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Lagos",
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Permission checks based on Section 3.2 Permission matrix:
 * ● full   ◐ limited   ○ none
 */
export function canViewCostPrice(role: UserRole): boolean {
  // Match the connected API: only company administrators and managers see costs.
  return role === "OWNER" || role === "MANAGER";
}

export function canViewMargins(role: UserRole): boolean {
  // Owner: full, Manager: full, Sales: none, Inventory: none
  return role === "OWNER" || role === "MANAGER";
}

export function canSellOrOpenPos(role: UserRole): boolean {
  // Owner: full, Manager: full, Sales: full, Inventory: none
  return role === "OWNER" || role === "MANAGER" || role === "SALES";
}

export function canVoidSale(role: UserRole): boolean {
  // Owner: full, Manager: same-day only, Sales: none, Inventory: none
  return role === "OWNER" || role === "MANAGER";
}

export function canManageSettings(role: UserRole): boolean {
  // Owner: full, Manager: limited, Sales: none, Inventory: none
  return role === "OWNER";
}

export function canViewAuditLog(role: UserRole): boolean {
  // Owner only!
  return role === "OWNER";
}

export function canManageStaff(role: UserRole): boolean {
  return role === "OWNER";
}

export function canAccessModule(role: UserRole, module: string): boolean {
  switch (module) {
    case "dashboard":
      return true; // All have role-aware dashboard
    case "inventory":
      return true; // All have inventory (sales without cost)
    case "add-stock":
      return role === "OWNER" || role === "MANAGER" || role === "INVENTORY";
    case "stock-movements":
      return true;
    case "transfers":
      return role === "OWNER" || role === "MANAGER" || role === "INVENTORY";
    case "pos":
    case "sales":
      return role === "OWNER" || role === "MANAGER" || role === "SALES";
    case "purchases":
      return role === "OWNER" || role === "MANAGER" || role === "INVENTORY";
    case "customers":
      return role === "OWNER" || role === "MANAGER" || role === "SALES";
    case "suppliers":
      return role === "OWNER" || role === "MANAGER" || role === "INVENTORY";
    case "reports":
      return true; // Scoped by role
    case "staff":
      return role === "OWNER";
    case "settings":
      return role === "OWNER";
    default:
      return false;
  }
}
