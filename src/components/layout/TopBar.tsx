/**
 * Honor — Top Bar
 * Height 64px, sticky, hairline bottom border, white.
 * Features breadcrumbs, 420px global search, location switcher, notifications bell & user profile.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { formatDateTime } from "../../utils/formatters";
import {
  Search,
  MapPin,
  Bell,
  User,
  Keyboard,
  RotateCcw,
  Check,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
  Building,
  Menu,
} from "lucide-react";

export const TopBar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    selectedProductId,
    products,
    setSelectedProductId,
    selectedCustomerId,
    customers,
    selectedSupplierId,
    suppliers,
    activeLocationId,
    setActiveLocationId,
    locations,
    activeStaff,
    notifications,
    markNotificationRead,
    clearAllNotifications,
    unreadNotificationsCount,
    setIsGlobalSearchOpen,
    resetPreviewData,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Derive page title & breadcrumbs
  const getBreadcrumbs = () => {
    switch (activeModule) {
      case "dashboard":
        return <span>Inventory overview</span>;
      case "inventory":
        if (selectedProductId) {
          const prod = products.find((p) => p.id === selectedProductId);
          return (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <button
                onClick={() => {
                  setSelectedProductId(null);
                  setActiveModule("inventory");
                }}
                className="text-zinc-500 hover:text-zinc-800 font-medium"
              >
                Inventory
              </button>
              <span className="text-zinc-400">/</span>
              <span className="font-bold text-zinc-900">
                {prod?.name || "Product Detail"}
              </span>
            </div>
          );
        }
        return (
          <span className="font-bold text-zinc-900">Inventory Catalogue</span>
        );
      case "add-stock":
        return (
          <span className="font-bold text-zinc-900">Add Stock Wizard</span>
        );
      case "stock-movements":
        return (
          <span className="font-bold text-zinc-900">
            Stock Movements Ledger
          </span>
        );
      case "transfers":
        return <span className="font-bold text-zinc-900">Stock Transfers</span>;
      case "pos":
        return (
          <span className="font-bold text-emerald-800">
            Point of Sale (POS)
          </span>
        );
      case "sales":
        return <span className="font-bold text-zinc-900">Sales History</span>;
      case "purchases":
        return (
          <span className="font-bold text-zinc-900">
            Purchase Orders & Intake
          </span>
        );
      case "customers":
        if (selectedCustomerId) {
          const cust = customers.find((c) => c.id === selectedCustomerId);
          return (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-zinc-500">Customers</span>
              <span className="text-zinc-400">/</span>
              <span className="font-bold text-zinc-900">{cust?.name}</span>
            </div>
          );
        }
        return (
          <span className="font-bold text-zinc-900">
            Customer CRM & Warranties
          </span>
        );
      case "suppliers":
        if (selectedSupplierId) {
          const sup = suppliers.find((s) => s.id === selectedSupplierId);
          return (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-zinc-500">Suppliers</span>
              <span className="text-zinc-400">/</span>
              <span className="font-bold text-zinc-900">{sup?.name}</span>
            </div>
          );
        }
        return (
          <span className="font-bold text-zinc-900">Supplier Directory</span>
        );
      case "reports":
        return (
          <span className="font-bold text-zinc-900">
            Business Reports & Analytics
          </span>
        );
      case "staff":
        return <span className="font-bold text-zinc-900">People & access</span>;
      case "settings":
        return <span className="font-bold text-zinc-900">System Settings</span>;
      default:
        return <span className="font-bold text-zinc-900">Honor</span>;
    }
  };

  // Can the staff user switch locations?
  // Owner & Manager can switch; Sales restricted to assigned location
  const canSwitchLocation =
    activeStaff.assignedLocationIds.includes("*") ||
    activeStaff.assignedLocationIds.length > 1;

  return (
    <header className="h-16 sticky top-0 z-30 bg-white border-b border-zinc-200/80 px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-3 shadow-xs">
      {/* Mobile Menu Button + Page Title / Breadcrumb */}
      <div className="flex shrink-0 items-center min-w-0 md:shrink md:max-w-[28%]">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex h-11 w-11 shrink-0 items-center justify-center text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors"
          title="Toggle navigation menu"
          aria-label="Open menu"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block text-sm tracking-tight truncate">
          {getBreadcrumbs()}
        </div>
      </div>

      {/* Global Search (420px max) */}
      <div className="min-w-0 flex-1 max-w-[420px] hidden xl:block">
        <button
          onClick={() => setIsGlobalSearchOpen(true)}
          aria-label="Search Honor"
          className="w-full h-9 px-3 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl text-left text-xs text-zinc-400 flex items-center justify-between transition-colors shadow-2xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Search className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
            <span className="truncate">Search products, IMEI, receipts…</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white text-zinc-500 rounded border border-zinc-200">
            /
          </kbd>
        </button>
      </div>

      {/* Right Controls: Location Switcher, Notifications, User Profile */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2 xl:flex-none">
        {/* Mobile search trigger icon */}
        <button
          onClick={() => setIsGlobalSearchOpen(true)}
          className="xl:hidden flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-800 rounded-xl hover:bg-zinc-100"
          title="Search"
          aria-label="Search Honor"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Global Location Switcher */}
        <div className="relative min-w-0 flex-1 max-w-52">
          <div className="flex min-h-11 min-w-0 items-center bg-zinc-50 border border-zinc-200 rounded-xl px-2 text-xs text-zinc-700">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 mr-1.5 shrink-0" />
            <select
              value={activeLocationId}
              onChange={(e) => setActiveLocationId(e.target.value)}
              disabled={!canSwitchLocation}
              aria-label="Stock location"
              className="min-w-0 w-full truncate bg-transparent font-semibold focus:outline-none cursor-pointer py-2 disabled:cursor-not-allowed"
            >
              {canSwitchLocation &&
                activeStaff.assignedLocationIds.includes("*") && (
                  <option value="ALL">All locations</option>
                )}
              {locations
                .filter(
                  (l) =>
                    activeStaff.assignedLocationIds.includes("*") ||
                    activeStaff.assignedLocationIds.includes(l.id),
                )
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.isWarehouse ? "(Warehouse)" : ""}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Notifications Bell */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setIsNotifOpen(!isNotifOpen); setIsUserMenuOpen(false); }}
            className="flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors relative"
            title="Notifications Feed"
            aria-label={unreadNotificationsCount ? `Notifications, ${unreadNotificationsCount} unread` : "Notifications"}
            aria-expanded={isNotifOpen}
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown Feed */}
          {isNotifOpen && (
            <div className="fixed top-[68px] left-3 right-3 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-zinc-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-zinc-100 flex items-center justify-between">
                <div className="font-bold text-xs text-zinc-900">
                  Notifications
                </div>
                <button
                  onClick={clearAllNotifications}
                  className="text-[11px] text-emerald-800 hover:text-emerald-900 font-medium"
                >
                  Mark all as read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50 p-1">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400">
                    No active notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.linkModule) {
                          setActiveModule(n.linkModule as any);
                          setIsNotifOpen(false);
                        }
                      }}
                      className={`p-3 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors ${
                        !n.read ? "bg-amber-50/40 font-medium" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {formatDateTime(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsNotifOpen(false); }}
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 px-1 py-1 rounded-xl hover:bg-zinc-100 transition-colors"
            aria-label="Open account menu"
            aria-expanded={isUserMenuOpen}
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {activeStaff.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-zinc-900 leading-tight">
                {activeStaff.name}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase">
                {activeStaff.id === "preview-session" ? "Not signed in" : activeStaff.role}
              </div>
            </div>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* User Profile Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-zinc-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-zinc-100">
                <div className="font-bold text-xs text-zinc-900">
                  {activeStaff.name}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {activeStaff.email}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md">
                  <ShieldCheck className="w-3 h-3" />
                  Role: {activeStaff.id === "preview-session" ? "Not signed in" : activeStaff.role}
                </div>
              </div>

              <div className="p-1 space-y-0.5 text-xs">
                <button
                  onClick={() => {
                    setIsShortcutsOpen(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 hover:bg-zinc-100 text-left font-medium"
                >
                  <Keyboard className="w-4 h-4 text-zinc-400" />
                  <span>Keyboard Shortcuts</span>
                </button>

                <button
                  onClick={() => {
                    resetPreviewData();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-50 text-left font-medium"
                >
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Reset empty preview</span>
                </button>
              </div>


            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md p-5 animate-in fade-in duration-100">
            <h3 className="text-base font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-emerald-800" />
              Keyboard Shortcuts Specification
            </h3>
            <div className="divide-y divide-zinc-100 text-xs">
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">Focus Global Search</span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  /
                </kbd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">New Sale (POS Checkout)</span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  N
                </kbd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">
                  In POS: Focus Barcode / IMEI Scan Field
                </span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  F2
                </kbd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">
                  In POS: Open Payment Modal
                </span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  F4
                </kbd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">
                  Close modal, drawer, or picker
                </span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  Esc
                </kbd>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-zinc-600">
                  Submit form or complete sale
                </span>
                <kbd className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded font-mono font-bold">
                  Cmd / Ctrl + Enter
                </kbd>
              </div>
            </div>
            <button
              onClick={() => setIsShortcutsOpen(false)}
              className="mt-4 w-full py-2 bg-zinc-900 text-white font-semibold rounded-xl text-xs hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
