/**
 * Honor — Settings & System Configuration Module
 * Business legal identity, branch locations, receipt template, and local storage management.
 */

import React, { useState } from "react";
import {
  loadBusinessProfile,
  saveBusinessProfile,
} from "../../config/business";
import { useApp } from "../../context/AppContext";
import { Location } from "../../types";
import {
  Building2,
  MapPin,
  Receipt,
  Database,
  RotateCcw,
  Plus,
  Check,
  X,
  Smartphone,
  ShieldCheck,
} from "lucide-react";

export const SettingsModule: React.FC = () => {
  const { locations, resetToDemoData } = useApp();

  const [activeTab, setActiveTab] = useState<
    "business" | "locations" | "receipt" | "data"
  >("business");

  const [profile] = useState(loadBusinessProfile);
  const [saveError, setSaveError] = useState("");
  // Business Profile Form
  const [bizName, setBizName] = useState(profile.name);
  const [rcNumber, setRcNumber] = useState(profile.rcNumber);
  const [tin, setTin] = useState(profile.tin);
  const [vatRate, setVatRate] = useState("7.5% (example demo setting)");
  const [hqAddress, setHqAddress] = useState(profile.address);

  // Receipt Template
  const [receiptHeader, setReceiptHeader] = useState(profile.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState(profile.receiptFooter);
  const [warrantyNotice, setWarrantyNotice] = useState(profile.warrantyNotice);

  const [isSavedBanner, setIsSavedBanner] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      saveBusinessProfile({
        name: bizName,
        rcNumber,
        tin,
        address: hqAddress,
        receiptHeader,
        receiptFooter,
        warrantyNotice,
      });
      setSaveError("");
    } catch {
      setSaveError("This browser could not save the demo settings.");
      return;
    }
    setIsSavedBanner(true);
    setTimeout(() => setIsSavedBanner(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {saveError && (
        <p role="alert" className="text-sm text-rose-700">
          {saveError}
        </p>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            System Settings & Configuration
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Company details, locations and receipt preferences for the demo
            workspace.
          </p>
        </div>

        {isSavedBanner && (
          <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Demo settings saved in this browser</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="flex border-b border-zinc-200 px-4 gap-4 overflow-x-auto">
          {[
            { id: "business", label: "Business Profile & Tax" },
            {
              id: "locations",
              label: `Branches & Warehouse (${locations.length})`,
            },
            { id: "receipt", label: "Thermal Receipt Customizer" },
            { id: "data", label: "Storage & System Reset" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-emerald-700 text-emerald-950"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TAB 1: BUSINESS PROFILE */}
          {activeTab === "business" && (
            <form onSubmit={handleSave} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Company Registered Name
                </label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-bold text-zinc-900 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Corporate Affairs Commission (RC)
                  </label>
                  <input
                    type="text"
                    value={rcNumber}
                    onChange={(e) => setRcNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-mono text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Tax Identification Number (TIN)
                  </label>
                  <input
                    type="text"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-mono text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    VAT Standard
                  </label>
                  <input
                    type="text"
                    disabled
                    value={vatRate}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-500 font-semibold"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Demo default; configure and verify company tax rules before
                    launch.
                  </span>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Operating Currency
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Nigerian Naira (₦) · en-NG"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 text-zinc-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Headquarters Address
                </label>
                <input
                  type="text"
                  value={hqAddress}
                  onChange={(e) => setHqAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-zinc-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs transition-all"
                >
                  Save Business Details
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: BRANCH LOCATIONS */}
          {activeTab === "locations" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-900">
                    Branch & Warehouse Network
                  </h3>
                  <p className="text-zinc-500 text-[11px]">
                    Manage physical retail locations and the central hub.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-zinc-900 text-sm">
                        {loc.name}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          loc.isWarehouse
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {loc.isWarehouse
                          ? "Central Warehouse"
                          : "Retail Branch"}
                      </span>
                    </div>
                    <p className="text-zinc-600 text-xs">{loc.address}</p>
                    <div className="text-zinc-500 font-mono text-[11px]">
                      Phone: {loc.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: RECEIPT CUSTOMIZER */}
          {activeTab === "receipt" && (
            <form onSubmit={handleSave} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Receipt Header Banner
                </label>
                <input
                  type="text"
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-mono text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Warranty Terms Notice
                </label>
                <input
                  type="text"
                  value={warrantyNotice}
                  onChange={(e) => setWarrantyNotice(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Footer Message
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-zinc-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Update Receipt Layout
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: DATA RESET */}
          {activeTab === "data" && (
            <div className="space-y-4 max-w-lg text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="font-bold text-amber-900 text-sm">
                  Demo Data & State Persistence
                </div>
                <p className="text-amber-800 leading-relaxed">
                  All inventory transactions, customer files, IMEI tracking, and
                  POS receipts are stored locally in your browser session. If
                  you wish to wipe current changes and reset to the pristine
                  Nigerian retail test dataset:
                </p>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Reset all inventory, sales, and customer data to initial sample state?",
                      )
                    ) {
                      resetToDemoData();
                    }
                  }}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 mt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Initial Mock State</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
