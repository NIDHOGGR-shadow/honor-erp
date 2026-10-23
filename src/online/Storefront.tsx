"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Headphones,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { Catalogue, client, money, Order } from "./api";
import { Badge, Brand, Field } from "./ui";

export default function Storefront({
  slug,
  apiBase = "/api/v1",
  initial,
  staffUrl = "/workspace",
}: {
  slug: string;
  apiBase?: string;
  initial?: Catalogue;
  staffUrl?: string;
}) {
  const api = useMemo(() => client(apiBase), [apiBase]);
  const [catalogue, setCatalogue] = useState<Catalogue | undefined>(initial);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [order, setOrder] = useState<Order | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [simulation, setSimulation] = useState(false);
  const applyOrder = useCallback(
    (next: Order) => {
      setOrder(next);
      if (next.payment_status === "PAID") {
        setCart({});
        sessionStorage.removeItem("honor:cart:" + slug);
      }
    },
    [slug],
  );
  const load = useCallback(async () => {
    const data = await api.request<Catalogue>(
      "/storefront/" + encodeURIComponent(slug),
    );
    setCatalogue(data);
  }, [api, slug]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    try {
      setCart(JSON.parse(sessionStorage.getItem("honor:cart:" + slug) || "{}"));
    } catch {
      /* Invalid local cart starts empty. */
    }
    const id =
      new URLSearchParams(window.location.search).get("order") ||
      sessionStorage.getItem("honor:current-order:" + slug);
    if (id) {
      const key = sessionStorage.getItem("honor:order:" + id);
      if (key) {
        setSecret(key);
        api
          .request<Order>("/customer/orders/" + id, {
            headers: { "X-Order-Key": key },
          })
          .then(applyOrder)
          .catch((e) => setError(e.message));
      } else
        setNotice(
          "To view a private order, return using the browser where you checked out or contact the store with your reference.",
        );
    }
  }, [load, api, slug, applyOrder]);
  useEffect(() => {
    if (!order || !["RESERVED", "PAID"].includes(order.status)) return;
    const timer = setInterval(() => {
      api
        .request<Order>("/customer/orders/" + order.id, {
          headers: { "X-Order-Key": secret },
        })
        .then(applyOrder)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [order?.id, order?.status, secret, api, applyOrder]);
  const currency = catalogue?.company.currency || "USD";
  const products = catalogue?.products || [];
  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const shown = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
  );
  const items = products.filter((p) => cart[p.id] > 0);
  const count = items.reduce((sum, p) => sum + cart[p.id], 0);
  const total = items.reduce((sum, p) => sum + cart[p.id] * p.price_minor, 0);
  function change(id: string, delta: number) {
    setError("");
    setCart((previous) => {
      const product = products.find((p) => p.id === id);
      const next = {
        ...previous,
        [id]: Math.max(
          0,
          Math.min(product?.available || 0, (previous[id] || 0) + delta),
        ),
      };
      sessionStorage.setItem("honor:cart:" + slug, JSON.stringify(next));
      return next;
    });
  }
  async function pay(id: string, key: string) {
    const result = await api.send(
      "/checkouts/" + id + "/payment",
      undefined,
      "POST",
      { "X-Order-Key": key },
    );
    if (result.url) window.location.assign(result.url);
    else setSimulation(result.simulation === true);
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      let key = sessionStorage.getItem("honor:checkout-key:" + slug);
      if (!key) {
        key = crypto.randomUUID() + crypto.randomUUID();
        sessionStorage.setItem("honor:checkout-key:" + slug, key);
      }
      const created = await api.command<Order>(
        "/storefront/" + slug + "/checkouts",
        {
          customer_name: form.get("name"),
          email: form.get("email"),
          client_token: key,
          lines: items.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
        },
      );
      sessionStorage.setItem("honor:order:" + created.id, key);
      sessionStorage.setItem("honor:current-order:" + slug, created.id);
      setSecret(key);
      const full = await api.request<Order>("/customer/orders/" + created.id, {
        headers: { "X-Order-Key": key },
      });
      setOrder(full);
      await pay(created.id, key);
    } catch (e) {
      setError((e as Error).message);
      load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function orderAction(action: "pay" | "simulate" | "cancel") {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      if (action === "pay") await pay(order.id, secret);
      else
        await api.send(
          (action === "simulate" ? "/checkouts/" : "/customer/orders/") +
            order.id +
            "/" +
            action,
          undefined,
          "POST",
          { "X-Order-Key": secret },
        );
      applyOrder(
        await api.request<Order>("/customer/orders/" + order.id, {
          headers: { "X-Order-Key": secret },
        }),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newOrder() {
    setOrder(null);
    setSimulation(false);
    sessionStorage.removeItem("honor:current-order:" + slug);
    sessionStorage.removeItem("honor:checkout-key:" + slug);
    window.history.replaceState({}, "", window.location.pathname);
    load().catch((e) => setError(e.message));
  }
  return (
    <div className="online-app min-h-screen bg-[#f8f9f7] text-zinc-900">
      <header className="border-b border-zinc-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Brand small />
          <div className="flex items-center gap-5">
            <a
              className="hidden text-xs text-zinc-500 sm:block"
              href={staffUrl}
            >
              Staff sign in
            </a>
            <button
              onClick={() =>
                document
                  .getElementById("your-bag")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs"
            >
              <ShoppingBag size={16} />
              Your bag
              <span className="rounded-full bg-emerald-700 px-1.5 text-white">
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {catalogue?.simulation && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">
            Demonstration store · fictional products · payments are simulated.
            No money is collected.
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}
        <section className="mb-10 grid gap-6 rounded-3xl border border-emerald-900/10 bg-[#eaf0e8] p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-800">
              {catalogue?.company.name || "Honor store"}
            </p>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Find your next everyday essential.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-zinc-600">
              Browse the collection, pay securely online and collect your order
              from the store.
            </p>
            <a
              href="#collection"
              className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-emerald-900"
            >
              Explore the collection
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="hidden h-36 w-36 items-center justify-center rounded-[2rem] bg-white/60 text-emerald-800 md:flex">
            <ShoppingBag size={62} strokeWidth={1.1} />
          </div>
        </section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section id="collection">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  The collection
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {products.length} products, ready to discover
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                <Search size={15} className="text-zinc-400" />
                <input
                  className="w-36 bg-transparent text-xs outline-none"
                  aria-label="Search products"
                  placeholder="Search products"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs ${category === c ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-600"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => {
                const Icon =
                  p.category === "Phones"
                    ? Smartphone
                    : p.category === "Audio"
                      ? Headphones
                      : Zap;
                return (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white"
                  >
                    <div className="relative flex aspect-[1.2] items-center justify-center bg-[#f0f2ee] text-zinc-500">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-contain p-6"
                        />
                      ) : (
                        <Icon size={68} strokeWidth={1} />
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] text-zinc-600">
                        {p.category}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="min-h-10 text-sm font-semibold leading-5">
                        {p.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {p.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {money(p.price_minor, currency)}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${p.available ? "text-emerald-700" : "text-zinc-400"}`}
                          >
                            {p.available
                              ? "Available for collection"
                              : "Out of stock"}
                          </p>
                        </div>
                        <button
                          aria-label={"Add " + p.name + " to bag"}
                          onClick={() => change(p.id, 1)}
                          disabled={
                            !p.available ||
                            (cart[p.id] || 0) >= p.available ||
                            !!order
                          }
                          className="rounded-xl bg-emerald-800 p-2.5 text-white disabled:bg-zinc-200 disabled:text-zinc-400"
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!catalogue && !error && (
              <p className="py-16 text-center text-sm text-zinc-500">
                Opening the collection…
              </p>
            )}
            {catalogue && !shown.length && (
              <p className="py-16 text-center text-sm text-zinc-500">
                No products match your search.
              </p>
            )}
          </section>
          <aside
            id="your-bag"
            className="h-fit scroll-mt-6 rounded-2xl border border-zinc-200/70 bg-white p-6 lg:sticky lg:top-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-semibold">
                {order ? "Your order" : "Your bag"}
              </h2>
              <ShoppingBag className="text-zinc-400" size={18} />
            </div>
            {order ? (
              <div className="space-y-5">
                <Badge
                  warning={["EXPIRED", "EXCEPTION", "CANCELLED"].includes(
                    order.status,
                  )}
                >
                  {order.status.replaceAll("_", " ")}
                </Badge>
                <p className="text-xs text-zinc-500">
                  Reference {order.id.slice(0, 8).toUpperCase()}
                </p>
                {order.lines?.map((line) => (
                  <div
                    key={line.product_id}
                    className="flex justify-between gap-3 text-xs"
                  >
                    <span>
                      {line.name} × {line.quantity}
                    </span>
                    <span>
                      {money(line.price_minor * line.quantity, order.currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-zinc-100 pt-4 text-sm font-semibold">
                  <span>Total</span>
                  <span>{money(order.total_minor, order.currency)}</span>
                </div>
                {order.collection_location && (
                  <div className="rounded-lg bg-zinc-50 p-3 text-xs leading-6">
                    <p className="font-medium">
                      Collect from {order.collection_location.name}
                    </p>
                    <p className="text-zinc-500">
                      {order.collection_location.address}
                    </p>
                  </div>
                )}
                {order.payment_status === "PAID" && (
                  <p
                    role="status"
                    className="flex items-start gap-2 text-xs leading-6 text-emerald-800"
                  >
                    <Check size={16} className="mt-1 shrink-0" />
                    {order.status === "FULFILLED"
                      ? "Your order has been handed over. Thank you."
                      : "Payment received. The store is preparing your order for collection."}
                  </p>
                )}
                {order.payment_status === "REFUND_REQUIRED" && (
                  <p role="status" className="text-xs leading-6 text-amber-800">
                    Your payment needs the store's attention because the order
                    could not be allocated. Contact the store with your
                    reference for resolution or refund.
                  </p>
                )}
                {order.status === "RESERVED" && (
                  <>
                    <p className="text-xs leading-6 text-zinc-500">
                      Stock reserved until{" "}
                      {new Date(order.expires_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      . Payment is confirmed by the store's payment service.
                    </p>
                    {simulation ? (
                      <button
                        disabled={busy}
                        onClick={() => orderAction("simulate")}
                        className="honor-button w-full"
                      >
                        Simulate successful payment
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => orderAction("pay")}
                        className="honor-button w-full"
                      >
                        {busy ? "Opening checkout…" : "Continue to payment"}
                        <ArrowRight size={15} />
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => orderAction("cancel")}
                      className="w-full text-xs text-zinc-500"
                    >
                      Cancel unpaid order
                    </button>
                  </>
                )}
                {order.status !== "RESERVED" && (
                  <button onClick={newOrder} className="honor-button w-full">
                    Continue shopping
                  </button>
                )}
              </div>
            ) : (
              <>
                {!items.length ? (
                  <div className="py-6 text-center">
                    <Package size={30} className="mx-auto text-zinc-300" />
                    <p className="mt-4 text-sm text-zinc-500">
                      A little space for something good.
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Add a product to get started.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-5">
                      {items.map((p) => (
                        <div key={p.id}>
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="font-medium">{p.name}</span>
                            <button
                              aria-label={"Remove " + p.name}
                              onClick={() => change(p.id, -cart[p.id])}
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-4 rounded-lg border border-zinc-200 p-1.5">
                              <button
                                aria-label={"Decrease " + p.name}
                                onClick={() => change(p.id, -1)}
                              >
                                <Minus size={13} />
                              </button>
                              <span className="text-xs">{cart[p.id]}</span>
                              <button
                                aria-label={"Increase " + p.name}
                                onClick={() => change(p.id, 1)}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <span className="text-xs">
                              {money(p.price_minor * cart[p.id], currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-between border-t border-zinc-100 pt-5 text-sm font-semibold">
                      <span>Total</span>
                      <span>{money(total, currency)}</span>
                    </div>
                    <p className="mt-2 text-[10px] leading-5 text-zinc-400">
                      Collection only. Stock and final prices are checked at
                      checkout.
                    </p>
                    <form onSubmit={checkout} className="mt-6 space-y-4">
                      <Field label="Your name">
                        <input
                          required
                          name="name"
                          minLength={2}
                          maxLength={120}
                          autoComplete="name"
                          className="online-input"
                        />
                      </Field>
                      <Field label="Email for your order">
                        <input
                          required
                          type="email"
                          name="email"
                          maxLength={254}
                          autoComplete="email"
                          className="online-input"
                        />
                      </Field>
                      <button
                        disabled={busy || !catalogue?.checkout_enabled}
                        className="honor-button w-full"
                      >
                        {busy ? "Reserving your items…" : "Reserve & checkout"}
                        <ArrowRight size={15} />
                      </button>
                    </form>
                    {!catalogue?.checkout_enabled && (
                      <p className="mt-3 text-xs text-amber-800">
                        This store is not accepting online payments yet.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5 text-[10px] text-zinc-500">
              <p className="flex items-center gap-2">
                <ShieldCheck size={14} />
                Payment handled through secure checkout
              </p>
              <p className="flex items-center gap-2">
                <Truck size={14} />
                Collect directly from the store
              </p>
            </div>
          </aside>
        </div>
      </main>
      <footer className="mx-auto mt-6 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-zinc-200 px-5 py-7 text-[10px] text-zinc-400 sm:px-8">
        <span>{catalogue?.company.name || "Honor"}</span>
        <span>Powered by Honor · Inventory, in order.</span>
      </footer>
    </div>
  );
}
