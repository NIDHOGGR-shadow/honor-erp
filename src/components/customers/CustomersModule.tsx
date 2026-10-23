/**
 * Honor — Customer Management Module
 * Comprehensive CRM with warranty lookup by IMEI, purchase history, and credit tracking.
 */

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { formatNaira, formatDateTime } from "../../utils/formatters";
import { Customer } from "../../types";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Smartphone,
  Receipt,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  X,
} from "lucide-react";

export const CustomersModule: React.FC = () => {
  const {
    customers,
    sales,
    stockUnits,
    selectedCustomerId,
    setSelectedCustomerId,
    addCustomer,
    updateCustomer,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "profile" | "purchases" | "devices" | "payments"
  >("devices");

  // Add Customer Form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("0");

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.devicesOwned.some((d) => d.imei.toLowerCase().includes(q))
    );
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      address: newAddress.trim() || undefined,
      creditLimit: Number(newCreditLimit) || 0,
      balance: 0,
      totalSpent: 0,
      salesCount: 0,
      devicesOwned: [],
      createdAt: new Date().toISOString(),
    };

    addCustomer(newCust);
    setIsAddModalOpen(false);
    setSelectedCustomerId(newCust.id);
  };

  // Detail View if customer selected
  if (selectedCustomerId) {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) {
      setSelectedCustomerId(null);
      return null;
    }

    const customerSales = sales.filter((s) => s.customerId === customer.id);

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
          <button
            onClick={() => setSelectedCustomerId(null)}
            className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900">
                {customer.name}
              </h1>
              {customer.balance > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800">
                  Owes {formatNaira(customer.balance)}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                  Account in Good Standing
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {customer.phone} {customer.email ? `· ${customer.email}` : ""}{" "}
              {customer.address ? `· ${customer.address}` : ""}
            </p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Lifetime Spend
            </span>
            <span className="text-lg font-bold text-zinc-900 mt-1 block tabular-nums">
              {formatNaira(customer.totalSpent)}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Devices Owned
            </span>
            <span className="text-lg font-bold text-emerald-800 mt-1 block tabular-nums">
              {customer.devicesOwned.length} devices
            </span>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Total Transactions
            </span>
            <span className="text-lg font-bold text-zinc-900 mt-1 block tabular-nums">
              {customer.salesCount}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs">
            <span className="text-[11px] text-zinc-500 font-medium">
              Credit Limit
            </span>
            <span className="text-lg font-bold text-zinc-700 mt-1 block tabular-nums">
              {formatNaira(customer.creditLimit)}
            </span>
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="flex border-b border-zinc-200 px-4 gap-4 overflow-x-auto">
            {[
              {
                id: "devices",
                label: `Devices Owned & Warranties (${customer.devicesOwned.length})`,
              },
              {
                id: "purchases",
                label: `Purchases History (${customerSales.length})`,
              },
              { id: "profile", label: "Customer Profile & Credit" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-emerald-700 text-emerald-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* TAB: DEVICES & WARRANTIES */}
            {activeTab === "devices" && (
              <div className="space-y-3">
                <div className="text-xs text-zinc-500 mb-2">
                  All physical serialised phones registered to this customer
                  with official IMEI and 1-year warranty coverage.
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Device & Variant</th>
                        <th className="py-2.5 px-3">IMEI 1</th>
                        <th className="py-2.5 px-3">Purchase Date</th>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Warranty Expiration</th>
                        <th className="py-2.5 px-3 text-right">
                          Coverage Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {customer.devicesOwned.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 text-center text-zinc-400"
                          >
                            No serialised devices recorded for this customer.
                          </td>
                        </tr>
                      ) : (
                        customer.devicesOwned.map((dev) => {
                          const isUnderWarranty =
                            new Date(dev.warrantyExpiry) > new Date();
                          return (
                            <tr key={dev.id} className="hover:bg-zinc-50">
                              <td className="py-2.5 px-3 font-bold text-zinc-900">
                                {dev.variantName}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-emerald-800 font-bold">
                                {dev.imei}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-500">
                                {formatDateTime(dev.purchaseDate)}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-zinc-700">
                                {dev.receiptNumber}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-600">
                                {new Date(
                                  dev.warrantyExpiry,
                                ).toLocaleDateString("en-NG")}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isUnderWarranty
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-zinc-100 text-zinc-500"
                                  }`}
                                >
                                  {isUnderWarranty
                                    ? "Active Warranty"
                                    : "Expired"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PURCHASES */}
            {activeTab === "purchases" && (
              <div className="space-y-3">
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Payment Method</th>
                        <th className="py-2.5 px-3">Items</th>
                        <th className="py-2.5 px-3">Total Amount</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {customerSales.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 text-center text-zinc-400"
                          >
                            No purchases recorded.
                          </td>
                        </tr>
                      ) : (
                        customerSales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                              {sale.receiptNumber}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500">
                              {formatDateTime(sale.timestamp)}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-700">
                              {sale.payments.map((p) => p.method).join(" + ")}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {sale.lines.length} items
                            </td>
                            <td className="py-2.5 px-3 font-bold text-zinc-900">
                              {formatNaira(sale.grandTotal)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {sale.paymentStatus}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-4 max-w-lg text-xs">
                <div className="p-4 bg-zinc-50 rounded-xl space-y-2 border border-zinc-100">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Phone:</span>
                    <span className="font-bold text-zinc-900">
                      {customer.phone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Email:</span>
                    <span className="font-medium text-zinc-900">
                      {customer.email || "None registered"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Delivery Address:</span>
                    <span className="text-zinc-800">
                      {customer.address || "Walk-in customer"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Current Balance (Owed):
                    </span>
                    <span className="font-bold text-rose-600">
                      {formatNaira(customer.balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Authorized Credit Limit:
                    </span>
                    <span className="font-bold text-zinc-900">
                      {formatNaira(customer.creditLimit)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: Customer Directory
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Customer CRM & Warranties
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Registered customer directory, serial device history, and credit
            accounts.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by customer name, phone number, or purchased device IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-700 text-zinc-900"
          />
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3 text-center">Devices Owned</th>
                <th className="py-3 px-3 text-center">Sales</th>
                <th className="py-3 px-3">Lifetime Spend</th>
                <th className="py-3 px-3">Balance (Owed)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      {c.name}
                      {c.email && (
                        <span className="block text-[10px] text-zinc-400 font-normal">
                          {c.email}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-zinc-700 font-medium">
                      {c.phone}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-800">
                      {c.devicesOwned.length}
                    </td>
                    <td className="py-3.5 px-3 text-center text-zinc-600">
                      {c.salesCount}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-zinc-900 tabular-nums">
                      {formatNaira(c.totalSpent)}
                    </td>
                    <td className="py-3.5 px-3">
                      {c.balance > 0 ? (
                        <span className="font-bold text-rose-600 tabular-nums">
                          {formatNaira(c.balance)}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-medium">₦0.00</span>
                      )}
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

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200/80 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Register New Customer
                </h3>
                <p className="text-xs text-zinc-500">
                  Track purchase history, device warranties & store credit
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
              onSubmit={handleCreateCustomer}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Full Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adebayo Ogunlesi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Phone Number (Nigeria)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0803 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. adebayo@example.ng"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Delivery / Residential Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Credit Limit (₦)
                </label>
                <input
                  type="number"
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-emerald-700"
                />
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
