/**
 * Honor — Left Navigation Sidebar
 * Fixed 248px, collapsible to 64px.
 * Features 4 labelled groups, "+ New Sale" primary action, count badges, and role-based trimming.
 */

import React from "react";
import { useApp } from "../../context/AppContext";
import { canSellOrOpenPos, canAccessModule } from "../../utils/formatters";
import { UserRole, ModuleType } from "../../types";
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  Receipt,
  ShoppingBag,
  Users,
  Building2,
  BarChart3,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  Shield,
  Smartphone,
  X,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    activeStaff,
    currentLocation,
    activeLocationId,
    locations,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    lowStockCount,
    pendingTransfersCount,
  } = useApp();

  const role = activeStaff.role;

  // Format badge numbers: up to 99, then 99+
  const formatBadge = (num: number) => (num > 99 ? "99+" : num.toString());

  // Definition of the 4 labelled groups
  const navGroups: {
    label: string;
    items: {
      id: ModuleType;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string | number;
      badgeColor?: "amber" | "accent";
    }[];
  }[] = [
    {
      label: "OVERVIEW",
      items: [
        { id: "dashboard", label: "Inventory overview", icon: LayoutDashboard },
      ],
    },
    {
      label: "INVENTORY",
      items: [
        {
          id: "inventory",
          label: "Inventory",
          icon: Boxes,
          badge: lowStockCount > 0 ? formatBadge(lowStockCount) : undefined,
          badgeColor: "amber",
        },
        { id: "add-stock", label: "Receive stock", icon: PlusCircle },
        { id: "purchases", label: "Purchase orders", icon: ShoppingBag },
        {
          id: "stock-movements",
          label: "Movement history",
          icon: ArrowLeftRight,
        },
        {
          id: "transfers",
          label: "Transfers",
          icon: Truck,
          badge:
            pendingTransfersCount > 0
              ? formatBadge(pendingTransfersCount)
              : undefined,
          badgeColor: "accent",
        },
      ],
    },
    {
      label: "SALES & CONTACTS",
      items: [
        { id: "pos", label: "Sales / POS", icon: ShoppingCart },
        { id: "sales", label: "Sales History", icon: Receipt },
        { id: "customers", label: "Customers", icon: Users },
        { id: "suppliers", label: "Suppliers", icon: Building2 },
      ],
    },
    {
      label: "COMPANY",
      items: [
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "staff", label: "People & access", icon: UserCheck },
        { id: "settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  // Filter groups and items by role: absent, not disabled!
  const filteredGroups = navGroups
    .map((group) => {
      const visibleItems = group.items.filter((item) =>
        canAccessModule(role, item.id),
      );
      return {
        ...group,
        items: visibleItems,
      };
    })
    .filter((group) => group.items.length > 0);

  const canSell = canSellOrOpenPos(role);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 bg-zinc-900 text-zinc-300 border-r border-zinc-800 transition-all duration-200 flex flex-col ${
          // Mobile state: slide from left if open, offscreen if closed
          isMobileMenuOpen
            ? "translate-x-0 w-[260px]"
            : "-translate-x-full md:translate-x-0"
        } ${
          // Desktop collapsed or expanded
          isSidebarCollapsed ? "md:w-16" : "md:w-[248px]"
        }`}
      >
        {/* Brand Block - 56px tall */}
        <div className="h-14 px-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950/40">
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold shadow-xs">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-white text-base tracking-tight">
                  Honor
                </span>
                <span className="text-[10px] text-zinc-400 block -mt-1 font-medium">
                  Inventory workspace
                </span>
              </div>
            </div>
          )}
          {isSidebarCollapsed && !isMobileMenuOpen && (
            <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              title="Close menu"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`hidden md:block p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ${
                isSidebarCollapsed ? "hidden" : "block"
              }`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Action: + New Sale (hidden for inventory staff!) */}
        {(canSell || canAccessModule(role, "add-stock")) && (
          <div className="p-3 shrink-0">
            <button
              onClick={() => {
                setActiveModule(
                  canAccessModule(role, "add-stock") ? "add-stock" : "pos",
                );
                setIsMobileMenuOpen(false);
              }}
              className={`w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 ${
                isSidebarCollapsed && !isMobileMenuOpen
                  ? "p-2.5"
                  : "py-2.5 px-3"
              }`}
              title={
                canAccessModule(role, "add-stock")
                  ? "Receive stock"
                  : "New sale"
              }
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <span className="text-xs uppercase tracking-wider">
                  {canAccessModule(role, "add-stock")
                    ? "Receive stock"
                    : "New sale"}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Nav groups scroll area */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4 scrollbar-none">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <div className="px-2 mb-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${
                        isActive
                          ? "bg-emerald-950/80 text-white font-semibold shadow-xs"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                      } ${isSidebarCollapsed && !isMobileMenuOpen ? "justify-center" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      title={
                        isSidebarCollapsed && !isMobileMenuOpen
                          ? item.label
                          : undefined
                      }
                    >
                      {/* 3px accent bar on active state */}
                      {isActive && (
                        <span className="absolute left-0 top-1 bottom-1 w-1 bg-emerald-700 rounded-r-full" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-400"}`}
                      />

                      {(!isSidebarCollapsed || isMobileMenuOpen) && (
                        <span className="truncate flex-1 text-left">
                          {item.label}
                        </span>
                      )}

                      {/* Count Badge */}
                      {(!isSidebarCollapsed || isMobileMenuOpen) &&
                        item.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              item.badgeColor === "amber"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Block */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/50 shrink-0 space-y-2">
          {!isSidebarCollapsed && (
            <>
              {/* Active Location Info */}
              <div className="flex items-center gap-2 text-zinc-400 text-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate font-medium">
                  {activeLocationId === "ALL"
                    ? locations.length ? "All company locations" : "No locations configured"
                    : currentLocation?.name || "No location selected"}
                </span>
              </div>

              {/* Active Staff User Info */}
              <div className="flex items-center justify-between pt-1">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {activeStaff.name}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      <Shield className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                      {activeStaff.id === "preview-session" ? "Not signed in" : activeStaff.role}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-full py-1 flex items-center justify-center text-zinc-400 hover:text-white"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
