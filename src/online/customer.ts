import { client, type Catalogue, type Order } from "./api";

export type Customer = { id: string; name: string; email: string };
export type Cart = Record<string, number>;
export type ShopView =
  | "shop"
  | "product"
  | "cart"
  | "checkout"
  | "login"
  | "signup"
  | "recover"
  | "account"
  | "locations";
const views = new Set([
  "shop",
  "product",
  "cart",
  "checkout",
  "login",
  "signup",
  "recover",
  "account",
  "locations",
]);
export function readRoute(search: string): { view: ShopView; product: string } {
  const params = new URLSearchParams(search);
  const value =
    params.get("view") || (params.has("order") ? "account" : "shop");
  return {
    view: (views.has(value) ? value : "shop") as ShopView,
    product: params.get("product") || "",
  };
}
export function readCart(raw: string | null): Cart {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([id, q]) =>
            id.length > 0 &&
            Number.isInteger(q) &&
            Number(q) > 0 &&
            Number(q) <= 100,
        )
        .map(([id, q]) => [id, Number(q)]),
    );
  } catch {
    return {};
  }
}
export function checkoutLines(cart: Cart, products: Catalogue["products"]) {
  return products
    .filter((p) => cart[p.id] > 0)
    .map((p) => ({ product_id: p.id, quantity: cart[p.id] }));
}
export const orderLabel = (status: string) =>
  ({
    RESERVED: "Awaiting payment",
    PAID: "Payment confirmed",
    FULFILLED: "Collected",
    EXPIRED: "Reservation expired",
    CANCELLED: "Cancelled",
    EXCEPTION: "Needs store review",
  })[status] || "Status being updated";
export const paymentLabel = (status: string) =>
  ({
    UNPAID: "Unpaid",
    PAID: "Paid",
    REFUND_REQUIRED: "Refund review required",
    REFUNDED: "Refunded",
  })[status] || "Payment being checked";

export function customerApi(base: string, slug: string) {
  const api = client(base);
  const headers = (key = "") => (key ? { "X-Order-Key": key } : {});
  return {
    catalogue: () =>
      api.request<Catalogue>("/storefront/" + encodeURIComponent(slug)),
    profile: () => api.request<Customer>("/customer/me"),
    orders: () =>
      api.request<Order[]>("/customer/orders?shop=" + encodeURIComponent(slug)),
    order: (id: string, key = "") =>
      api.request<Order>("/customer/orders/" + encodeURIComponent(id), {
        headers: headers(key),
      }),
    reserve: (
      name: string,
      email: string,
      token: string,
      lines: { product_id: string; quantity: number }[],
    ) =>
      api.command<
        Pick<
          Order,
          | "id"
          | "status"
          | "payment_status"
          | "total_minor"
          | "currency"
          | "expires_at"
        >
      >("/storefront/" + encodeURIComponent(slug) + "/checkouts", {
        customer_name: name,
        email,
        client_token: token,
        lines,
      }),
    pay: (id: string, key = "") =>
      api.send<{ url?: string; simulation?: boolean }>(
        "/checkouts/" + encodeURIComponent(id) + "/payment",
        undefined,
        "POST",
        headers(key),
      ),
    verifyPayment: (id: string, key = "") =>
      api.send<Order>(
        "/customer/orders/" + encodeURIComponent(id) + "/verify-payment",
        undefined,
        "POST",
        headers(key),
      ),
    receipt: (id: string, key = "") =>
      api.download(
        "/customer/orders/" + encodeURIComponent(id) + "/receipt.pdf",
        "honor-receipt-" + id + ".pdf",
        headers(key),
      ),
    cancel: (id: string, key = "") =>
      api.send(
        "/customer/orders/" + encodeURIComponent(id) + "/cancel",
        undefined,
        "POST",
        headers(key),
      ),
    simulate: (id: string, key: string) =>
      api.send(
        "/checkouts/" + encodeURIComponent(id) + "/simulate",
        undefined,
        "POST",
        headers(key),
      ),
    login: (email: string, password: string) =>
      api.send<Customer>("/auth/login", { email, password }),
    register: (name: string, email: string, password: string) =>
      api.send<{ message: string }>("/auth/register", {
        name,
        email,
        password,
      }),
    recover: (email: string) =>
      api.send<{ message: string }>("/auth/recover", { email }),
    logout: () => api.send("/auth/logout"),
  };
}
