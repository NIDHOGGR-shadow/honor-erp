/**
 * Honor — Suppliers Module
 * Vendor directory, procurement accounts, bank settlement details, and payables.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { formatNaira, formatDateTime } from "../../utils/formatters";
import { Supplier } from "../../types";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  CreditCard,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
  X,
} from "lucide-react";

export const SuppliersModule: React.FC = () => {
  const {
    suppliers,
    purchases,
    selectedSupplierId,
    setSelectedSupplierId,
    addSupplier,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bankName, setBankName] = useState("Zenith Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.contactPerson.toLowerCase().includes(q)
    );
  });

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newSup: Supplier = {
      id: `sup-${Date.now()}`,
      name: name.trim(),
      contactPerson: contactPerson.trim() || name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: "",
      purchasesCount: 0,
      createdAt: new Date().toISOString(),
      bankDetails: [bankName, accountNumber, accountName]
        .filter(Boolean)
        .join(" · "),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      balance: 0,
      totalPurchased: 0,
    };

    addSupplier(newSup);
    setIsAddModalOpen(false);
    setSelectedSupplierId(newSup.id);
  };

  // Detail View
  if (selectedSupplierId) {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      setSelectedSupplierId(null);
      return null;
    }

    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplier.id,
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
          <button
            onClick={() => setSelectedSupplierId(null)}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{supplier.name}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Contact: {supplier.contactPerson} · {supplier.phone}{" "}
              {supplier.email ? `· ${supplier.email}` : ""}
            </p>
          </div>
        </div>

        {/* Bank & Payment Information Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-zinc-200/80 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Bank Settlement Details
            </span>
            <div className="mt-1">
              <div className="font-bold text-zinc-900 text-xs">
                {supplier.bankName || "Access Bank"}
              </div>
              <div className="font-mono text-zinc-700 font-semibold text-xs mt-0.5">
                {supplier.accountNumber || "—"}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {supplier.accountName || supplier.name}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-zinc-200/80 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Outstanding Payables
            </span>
            <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
              {formatNaira(supplier.balance)}
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-zinc-200/80 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Lifetime Procurement Value
            </span>
            <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
              {formatNaira(supplier.totalPurchased)}
            </div>
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Purchase Orders Issued to {supplier.name} (
              {supplierPurchases.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">PO #</th>
                  <th className="py-2.5 px-3">Order Date</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {supplierPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-zinc-400">
                      No purchase orders recorded for this supplier.
                    </td>
                  </tr>
                ) : (
                  supplierPurchases.map((po) => (
                    <tr key={po.id} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                        {po.purchaseNumber}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500">
                        {formatDateTime(po.orderDate)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">
                        {formatNaira(po.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-800">
                        {po.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: Supplier Directory
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Suppliers & Vendor Accounts
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Authorized device distributors, accessory manufacturers, and
            procurement ledger.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Supplier</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search supplier name, contact person, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Bank Settlement Account</th>
                <th className="py-3 px-3">Outstanding Payables</th>
                <th className="py-3 px-3">Total Procured</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No suppliers found matching search.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSupplierId(s.id)}
                    className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      {s.name}
                    </td>
                    <td className="py-3.5 px-3 text-zinc-700 font-medium">
                      {s.contactPerson}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-zinc-700">
                      {s.phone}
                    </td>
                    <td className="py-3.5 px-3 text-zinc-600 font-mono text-[11px]">
                      {s.bankName} · {s.accountNumber}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-zinc-900 tabular-nums">
                      {formatNaira(s.balance)}
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-emerald-800 tabular-nums">
                      {formatNaira(s.totalPurchased)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="p-1.5 text-zinc-400 hover:text-emerald-700 hover:bg-zinc-100 rounded-lg">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Add New Supplier
                </h3>
                <p className="text-xs text-zinc-500">
                  Register vendor details and bank information
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSupplier}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Company / Supplier Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Redington Middle East & Africa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tunde Balogun"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0802 345 6789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. orders@redington.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="border-t border-zinc-200 pt-3 space-y-2">
                <div className="font-bold text-zinc-900">
                  Bank Settlement Details
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Stanbic IBTC"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
