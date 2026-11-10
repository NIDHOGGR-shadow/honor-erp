import React from "react";
import { money, type Order, type Product, type Balance, type Location } from "./api";

type ReportsProps = {
  products: Product[];
  balances: Balance[];
  orders: Order[];
  locations: Location[];
  currency: string;
  location: string;
  onProducts: () => void;
  onOrders: () => void;
};

function figures(orders: Order[]) {
  const paid = orders.filter(o => o.payment_status === "PAID");
  return { paidCount: paid.length, paidTotal: paid.reduce((sum, order) => sum + order.total_minor, 0) };
}

/** All figures come from the active, authorized workspace response.
 * Do not present these client-side snapshots as a reconciled general ledger. */
export function HonorOperationsReports({ products, balances, orders, locations, currency, location, onProducts, onOrders }: ReportsProps) {
  const { paidCount, paidTotal } = figures(orders);
  const available = balances.reduce((sum, b) => sum + b.available, 0);
  const reserved = balances.reduce((sum, b) => sum + b.reserved, 0);
  const published = products.filter(p => p.published).length;
  const low = products.filter(p => {
    const remaining = balances.filter(b => b.product_id === p.id).reduce((sum, b) => sum + b.available, 0);
    return remaining <= p.reorder_point;
  });

  return <div className="honor-reports">
    <div className="honor-reports-filters">
      <p>Showing records you have permission to view{location === "ALL" ? " across your locations" : ` for ${locations.find(l => l.id === location)?.name || "your selected location"}`}.</p>
      <span>From currently loaded records · not an accounting statement</span>
    </div>
    <div className="honor-reports-metrics" aria-label="Business totals">
      {[
        ["Products", products.length, "Products registered"],
        ["Published", published, "Visible listings"],
        ["Available stock", available, "Units available to sell"],
        ["Reserved stock", reserved, "Units held for orders"],
        ["Paid orders", paidCount, "Confirmed in order records"],
      ].map(([label, number, hint]) =>
        <div key={String(label)}><span>{label}</span><strong>{number}</strong><small>{hint}</small></div>
      )}
    </div>
    <div className="honor-reports-summary">
      <div>
        <span>Recorded paid-order value</span>
        <strong>{money(paidTotal, currency)}</strong>
      </div>
      <p>This is the sum of orders marked paid in the current workspace records. It is not verified bank settlement, net revenue, or profit. Refunds and cost accounting need their own ledgers.</p>
    </div>
    <section className="online-panel honor-reports-section">
      <div className="honor-reports-section-title">
        <div><h2>Stock needing attention</h2><p>Products at or below their own reorder level.</p></div>
        <button type="button" className="online-secondary" onClick={onProducts}>View products</button>
      </div>
      <div className="overflow-x-auto">
        <table className="online-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Available</th><th>Reorder level</th><th>Listing</th></tr></thead>
          <tbody>{low.map(p => <tr key={p.id}>
            <td className="font-medium">{p.name}</td>
            <td>{p.sku}</td>
            <td>{balances.filter(b => b.product_id === p.id).reduce((sum, b) => sum + b.available, 0)}</td>
            <td>{p.reorder_point}</td>
            <td>{p.published ? "Published" : "Draft"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!low.length && <p className="honor-reports-empty">No products are below their reorder levels in these records.</p>}
    </section>
    <section className="online-panel honor-reports-section">
      <div className="honor-reports-section-title">
        <div><h2>Recent orders</h2><p>Actual online orders in the selected workspace.</p></div>
        <button type="button" className="online-secondary" onClick={onOrders}>View orders</button>
      </div>
      <div className="overflow-x-auto">
        <table className="online-table">
          <thead><tr><th>Order</th><th>Date</th><th>Location</th><th>Amount</th><th>Payment</th><th>Collection</th></tr></thead>
          <tbody>{orders.slice().sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,20).map(o =>
            <tr key={o.id}><td className="font-medium">{o.id.slice(0,12)}</td>
              <td>{new Date(o.created_at).toLocaleDateString("en-NG")}</td>
              <td>{locations.find(l => l.id === o.location_id)?.name || "—"}</td>
              <td>{money(o.total_minor, currency)}</td>
              <td>{o.payment_status.replaceAll("_"," ").toLowerCase()}</td>
              <td>{o.status.replaceAll("_"," ").toLowerCase()}</td></tr>
          )}</tbody>
        </table>
      </div>
      {!orders.length && <p className="honor-reports-empty">No customer orders in these records yet.</p>}
    </section>
  </div>;
}
