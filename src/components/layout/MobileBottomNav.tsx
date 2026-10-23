/**
 * Honor — Mobile Bottom Navigation
 * Designed specifically for small phone screens (e.g., iPhone SE, 360px - 414px Android devices)
 * Provides instant single-thumb access to core retail operations.
 */

import React from "react";
import { useApp } from "../../context/AppContext";
import { canSellOrOpenPos, canAccessModule } from "../../utils/formatters";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Receipt,
  Menu,
} from "lucide-react";

export const MobileBottomNav: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    activeStaff,
    setIsMobileMenuOpen,
    lowStockCount,
  } = useApp();

  const canSell = canSellOrOpenPos(activeStaff.role);

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 px-2 py-1 flex items-center justify-around shadow-lg"
    >
      {/* Dashboard */}
      <button
        onClick={() => setActiveModule("dashboard")}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] ${
          activeModule === "dashboard"
            ? "text-emerald-800 font-bold"
            : "text-zinc-500 hover:text-zinc-800"
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Overview</span>
      </button>

      {/* Inventory */}
      <button
        onClick={() => setActiveModule("inventory")}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors relative min-w-[56px] min-h-[44px] ${
          activeModule === "inventory" ||
          activeModule === "add-stock" ||
          activeModule === "stock-movements"
            ? "text-emerald-800 font-bold"
            : "text-zinc-500 hover:text-zinc-800"
        }`}
      >
        <div className="relative">
          <Boxes className="w-5 h-5 mb-0.5" />
          {lowStockCount > 0 && (
            <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </div>
        <span>Stock</span>
      </button>

      {/* POS (High-visibility Center Action for roles that can sell) */}
      {canSell && (
        <button
          onClick={() => setActiveModule("pos")}
          className={`flex flex-col items-center justify-center px-3 py-1 rounded-2xl transition-all min-h-[44px] ${
            activeModule === "pos"
              ? "bg-emerald-800 text-white shadow-xs scale-105"
              : "bg-emerald-700 text-white shadow-2xs hover:bg-emerald-600"
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-extrabold uppercase tracking-tight">
            POS
          </span>
        </button>
      )}

      {/* Movement history keeps inventory central on mobile. */}
      <button
        onClick={() => setActiveModule("stock-movements")}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] ${
          activeModule === "stock-movements"
            ? "text-emerald-800 font-bold"
            : "text-zinc-500 hover:text-zinc-800"
        }`}
      >
        <Receipt className="w-5 h-5 mb-0.5" />
        <span>History</span>
      </button>

      {/* More / Menu Drawer Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors min-w-[56px] min-h-[44px]"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>More</span>
      </button>
    </nav>
  );
};
