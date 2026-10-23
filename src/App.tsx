/**
 * Honor — Inventory, Sales & Customer Management
 * Main Application Orchestrator
 *
 * Tracks serialised devices and quantity-based accessories across Lagos branches & warehouse.
 * Normative specifications:
 * - Default currency: Nigerian Naira (₦), locale en-NG, Africa/Lagos
 * - VAT-inclusive at 7.5% derived line
 * - Immutable stock ledger
 * - Responsive layout adapted for desktop and small mobile phones
 */

import React, { useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { GlobalSearchModal } from "./components/common/GlobalSearchModal";

// Module Components
import { DashboardModule } from "./components/dashboard/DashboardModule";
import { InventoryModule } from "./components/inventory/InventoryModule";
import { AddStockWizard } from "./components/inventory/AddStockWizard";
import { StockMovementsModule } from "./components/inventory/StockMovementsModule";
import { TransfersModule } from "./components/inventory/TransfersModule";
import { PosModule } from "./components/pos/PosModule";
import { SalesHistoryModule } from "./components/sales/SalesHistoryModule";
import { PurchasesModule } from "./components/purchases/PurchasesModule";
import { CustomersModule } from "./components/customers/CustomersModule";
import { SuppliersModule } from "./components/suppliers/SuppliersModule";
import { ReportsModule } from "./components/reports/ReportsModule";
import { StaffModule } from "./components/staff/StaffModule";
import { SettingsModule } from "./components/settings/SettingsModule";
import { canSellOrOpenPos, canAccessModule } from "./utils/formatters";

const AppContent: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    isSidebarCollapsed,
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    activeStaff,
  } = useApp();

  // Global Keyboard Shortcuts (/, N, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea or select
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      } else if (
        (e.key === "n" || e.key === "N") &&
        !isInput &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (canSellOrOpenPos(activeStaff.role)) {
          e.preventDefault();
          setActiveModule("pos");
        }
      } else if (e.key === "Escape") {
        if (isGlobalSearchOpen) {
          setIsGlobalSearchOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeStaff.role,
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    setActiveModule,
  ]);

  // Render the active module view
  const renderActiveModule = () => {
    if (!canAccessModule(activeStaff.role, activeModule)) {
      return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-10 space-y-3">
          <h1 className="text-xl font-semibold">This area is restricted</h1>
          <p className="text-sm text-zinc-600">
            Your company administrator controls access to this area.
          </p>
          <button
            className="honor-button"
            onClick={() => setActiveModule("dashboard")}
          >
            Back to inventory overview
          </button>
        </section>
      );
    }
    switch (activeModule) {
      case "dashboard":
        return <DashboardModule />;
      case "inventory":
        return <InventoryModule />;
      case "add-stock":
        return <AddStockWizard />;
      case "stock-movements":
        return <StockMovementsModule />;
      case "transfers":
        return <TransfersModule />;
      case "pos":
        return <PosModule />;
      case "sales":
        return <SalesHistoryModule />;
      case "purchases":
        return <PurchasesModule />;
      case "customers":
        return <CustomersModule />;
      case "suppliers":
        return <SuppliersModule />;
      case "reports":
        return <ReportsModule />;
      case "staff":
        return <StaffModule />;
      case "settings":
        return <SettingsModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 font-sans flex antialiased selection:bg-emerald-700 selection:text-white">
      {/* Left Navigation Sidebar (Desktop fixed / Mobile slide-over drawer) */}
      <Sidebar />

      {/* Main Workspace Frame */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarCollapsed ? "md:ml-16" : "md:ml-[248px]"
        }`}
      >
        {/* Top Bar Navigation */}
        <TopBar />

        {/* Viewport Content Area with mobile bottom padding to prevent nav overlap */}
        <main className="flex-1 p-4 sm:p-7 lg:p-10 pb-24 md:pb-10 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            <div
              className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500"
              role="status"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Demo workspace · example records stored in this browser
              </span>
              <span>Company-controlled inventory</span>
            </div>
            {renderActiveModule()}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Visible on small phone screens) */}
      <MobileBottomNav />

      {/* Global Search Dialog Modal */}
      <GlobalSearchModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
