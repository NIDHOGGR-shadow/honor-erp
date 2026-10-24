"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { ApiError, money, type Catalogue, type Order } from "./api";
import {
  customerApi,
  checkoutLines,
  orderLabel,
  paymentLabel,
  readCart,
  readRoute,
  type Cart,
  type Customer,
  type ShopView,
} from "./customer";
import { Brand, Field } from "./ui";
import { readAuthCallback } from "./authCallback";
import { ConnectionNotice, SubmissionStatus, useAuthSubmission } from "./connection";

type Props = {
  slug: string;
  apiBase?: string;
  initial?: Catalogue;
  staffUrl?: string;
  initialSearch?: string;
  configured?: boolean;
  accountConfigured?: boolean;
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We could not complete this request. Please try again.";
const input = "online-input";

// Customer presentation adapted from the supplied Gemini storefront. Honor contracts and
// inventory/payment rules remain shared with the staff application.
export default function Storefront({
  slug,
  apiBase = "/api/v1",
  initial,
  staffUrl = "/workspace",
  initialSearch = "",
  configured = true,
  accountConfigured = configured,
}: Props) {
  const api = useMemo(() => customerApi(apiBase, slug), [apiBase, slug]);
  const [route, setRoute] = useState(() => readRoute(initialSearch));
  const [catalogue, setCatalogue] = useState(initial);
  const [loading, setLoading] = useState(!initial && configured);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueMissing, setCatalogueMissing] = useState(!configured);
  const profileGeneration = useRef(0);
  const [cart, setCart] = useState<Cart>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Order[] | null>(null);
  const [profileError, setProfileError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [orderKey, setOrderKey] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupKey, setLookupKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const pendingAuth = useAuthSubmission(apiBase, accountConfigured, route.view);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("name");
  const products = catalogue?.products || [];
  const currency = catalogue?.company.currency || "USD";
  const cartSlot = "honor:cart:" + slug;
  const tokenSlot = "honor:checkout-key:" + slug;
  const currentOrderSlot = "honor:current-order:" + slug;
  const items = products.filter((p) => cart[p.id] > 0);
  const missing = Object.keys(cart).filter(
    (id) => !products.some((p) => p.id === id),
  );
  const invalidCart =
    missing.length > 0 || items.some((p) => cart[p.id] > p.available);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = items.reduce((sum, p) => sum + p.price_minor * cart[p.id], 0);
  const selected = products.find((p) => p.id === route.product);

  const loadCatalogue = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setCatalogueError("");
    try {
      setCatalogue(await api.catalogue());
      setCatalogueMissing(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setCatalogue(undefined);
        setCatalogueMissing(true);
      } else setCatalogueError("The collection could not be loaded. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [api, configured]);
  const loadProfile = useCallback(async () => {
    if (!accountConfigured) return;
    const generation = ++profileGeneration.current;
    setProfileError("");
    try {
      const profile = await api.profile();
      if (generation === profileGeneration.current) { setCustomer(profile); return profile; }
    } catch (e) {
      if (generation !== profileGeneration.current) return;
      setCustomer(null);
      if (!(e instanceof ApiError && e.status === 401))
        setProfileError("Account services are unavailable. Please try again.");
    }
  }, [api, accountConfigured]);
  const applyOrder = useCallback(
    (next: Order) => {
      setOrder(next);
      if (
        next.payment_status === "PAID" &&
        sessionStorage.getItem(currentOrderSlot) === next.id &&
        sessionStorage.getItem("honor:cleared-order:" + slug) !== next.id
      ) {
        sessionStorage.setItem("honor:cleared-order:" + slug, next.id);
        setCart({});
        sessionStorage.removeItem(cartSlot);
        sessionStorage.removeItem(tokenSlot);
      }
    },
    [cartSlot, tokenSlot, currentOrderSlot, slug],
  );
  const loadOrder = useCallback(
    async (id: string, key = "") => {
      const next = await api.order(id, key);
      applyOrder(next);
      return next;
    },
    [api, applyOrder],
  );
  useEffect(() => {
    setRoute(readRoute(window.location.search));
    loadCatalogue();
    loadProfile();
    try {
      setCart(readCart(sessionStorage.getItem(cartSlot)));
      const id =
        new URLSearchParams(window.location.search).get("order") ||
        sessionStorage.getItem(currentOrderSlot);
      if (id && accountConfigured) {
        const key = sessionStorage.getItem("honor:order:" + id) || "";
        setOrderKey(key);
        loadOrder(id, key).catch((e) => setError(message(e)));
      }
    } catch {
      setError(
        "Your browser could not restore saved checkout details. You can use your private order access code to look up an order.",
      );
    }
  }, [
    loadCatalogue,
    loadProfile,
    cartSlot,
    currentOrderSlot,
    loadOrder,
    accountConfigured,
  ]);
  useEffect(() => {
    const sync = () => {
      setRoute(readRoute(window.location.search));
      setError("");
      setNotice("");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const callback = readAuthCallback(window.location.hash);
    if (!callback) return;
    // Remove credentials from the address bar even when the API is not yet
    // connected. They are never put in localStorage or sessionStorage.
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    if (callback.kind === "error") { setError(callback.message); return; }
    if (!accountConfigured) {
      setNotice("Your email link was received. Account services are temporarily unavailable; please try again later.");
      return;
    }
    api.exchange(callback.accessToken, callback.refreshToken)
      .then(async () => { if (!await loadProfile()) throw new Error("Your account could not be loaded. Please try again."); navigate("account"); })
      .catch((e) => setError(message(e)));
  }, [api, accountConfigured, loadProfile]);
  useEffect(() => {
    setHistory(null);
    if (route.view !== "account" || !customer) return;
    if (!slug) { setHistory([]); return; }
    let active = true;
    api
      .orders()
      .then((orders) => {
        if (active) setHistory(orders);
      })
      .catch((e) => {
        if (active) setProfileError(message(e));
      });
    return () => {
      active = false;
    };
  }, [api, route.view, customer, slug]);
  useEffect(() => {
    if (!order || !["RESERVED", "PAID"].includes(order.status)) return;
    const timer = setInterval(
      () => loadOrder(order.id, orderKey).catch((e) => setError(message(e))),
      5000,
    );
    return () => clearInterval(timer);
  }, [order?.id, order?.status, orderKey, loadOrder]);

  function href(view: ShopView, product = "") {
    const params = new URLSearchParams();
    if (view !== "shop") params.set("view", view);
    if (product) params.set("product", product);
    return "?" + params.toString();
  }
  function navigate(view: ShopView, product = "") {
    window.history.pushState({}, "", href(view, product));
    setRoute({ view, product });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function link(
    event: React.MouseEvent<HTMLAnchorElement>,
    view: ShopView,
    product = "",
  ) {
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(view, product);
  }
  function updateCart(id: string, quantity: number) {
    if (quantity > 0 && !cart[id] && Object.keys(cart).length >= 50) {
      setNotice(
        "Checkout supports up to 50 different items. Complete this cart before starting another.",
      );
      return;
    }
    const product = products.find((p) => p.id === id);
    const next = { ...cart };
    const q = Math.max(
      0,
      Math.min(100, product?.available || 0, Math.floor(quantity)),
    );
    if (q) next[id] = q;
    else delete next[id];
    setCart(next);
    try {
      sessionStorage.setItem(cartSlot, JSON.stringify(next));
    } catch {
      setNotice(
        "Your cart cannot be saved in this browser. Keep this page open while shopping.",
      );
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function pay(id: string, key: string) {
    const result = await api.pay(id, key);
    if (result.url) {
      const url = new URL(result.url);
      if (url.protocol !== "https:")
        throw new Error("The payment link is unavailable. Contact the store.");
      window.location.assign(url.href);
    } else {
      throw new Error("Online payment is unavailable. Your order status is shown below.");
    }
  }

  function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customer) {
      sessionStorage.setItem("honor:after-login:" + slug, "checkout");
      navigate("login");
      setNotice("Sign in to continue checkout. Your cart is saved.");
      return;
    }
    const form = new FormData(e.currentTarget);
    run(async () => {
      if (!catalogue?.checkout_enabled || invalidCart || !items.length)
        throw new Error("Refresh your cart before checking out.");
      // Resolve an existing hold before creating another one after a payment/network failure.
      const previousId = sessionStorage.getItem(currentOrderSlot);
      if (previousId) {
        const previousKey =
          sessionStorage.getItem("honor:order:" + previousId) || "";
        const previous = await api.order(previousId, previousKey);
        if (previous.status === "RESERVED") {
          applyOrder(previous);
          setOrderKey(previousKey);
          navigate("account");
          setNotice(
            "You already have an active order. Continue payment or cancel that reservation before starting another.",
          );
          return;
        }
      }
      let key = sessionStorage.getItem(tokenSlot);
      if (!key) {
        key = crypto.randomUUID() + crypto.randomUUID();
        sessionStorage.setItem(tokenSlot, key);
      }
      const created = await api.reserve(
        String(form.get("name")),
        customer.email,
        key,
        checkoutLines(cart, products),
      );
      // Save the private order access credential before fetching details or opening hosted payment.
      sessionStorage.setItem("honor:order:" + created.id, key);
      sessionStorage.setItem(currentOrderSlot, created.id);
      setOrderKey(key);
      navigate("account");
      await loadOrder(created.id, key);
      await pay(created.id, key);
    });
  }
  function auth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void pendingAuth.submit(() => run(async () => {
      const email = String(data.get("email"));
      if (route.view === "recover")
        setNotice((await api.recover(email)).message);
      else if (route.view === "signup") {
        const result = await api.register(
          String(data.get("name")),
          email,
          String(data.get("password")),
        );
        navigate("login");
        setNotice(result.message);
      } else {
        await api.login(email, String(data.get("password")));
        if (!await loadProfile()) throw new Error("Your account could not be loaded. Please try again.");
        const next = sessionStorage.getItem("honor:after-login:" + slug);
        sessionStorage.removeItem("honor:after-login:" + slug);
        navigate(next === "checkout" ? "checkout" : "account");
      }
      form.reset();
    }));
  }
  const shown = products
    .filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!inStock || p.available > 0) &&
        `${p.name} ${p.sku} ${p.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.price_minor - b.price_minor
        : sort === "price-desc"
          ? b.price_minor - a.price_minor
          : a.name.localeCompare(b.name),
    );
  const back = (
    <button className="honor-text-button mb-5" onClick={() => navigate("shop")}>
      <ArrowLeft size={16} /> Back to shop
    </button>
  );
  const activeView = route.view;
  const nav = (view: ShopView, label: string) => (
    <a
      href={href(view)}
      onClick={(e) => link(e, view)}
      aria-current={activeView === view ? "page" : undefined}
      className={`py-2 text-sm font-medium ${activeView === view ? "text-emerald-800 underline decoration-emerald-600 underline-offset-8" : "text-zinc-600 hover:text-zinc-900"}`}
    >
      {label}
    </a>
  );
  function quantity(id: string, value: number, max: number) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1">
        <button
          className="p-2"
          aria-label={
            "Decrease quantity of " +
            (products.find((p) => p.id === id)?.name || "item")
          }
          onClick={() => updateCart(id, value - 1)}
        >
          <Minus size={16} />
        </button>
        <span className="min-w-6 text-center tabular-nums">{value}</span>
        <button
          className="p-2 disabled:opacity-30"
          disabled={value >= max}
          aria-label={
            "Increase quantity of " +
            (products.find((p) => p.id === id)?.name || "item")
          }
          onClick={() => updateCart(id, value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }
  function empty(title: string, text: string) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
        <Package size={36} className="mx-auto mb-5 text-zinc-400" />
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-600">
          {text}
        </p>
      </div>
    );
  }
  function orderCard(value: Order) {
    return (
      <section
        className="honor-panel p-6 sm:p-8 space-y-6"
        aria-label="Order details"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="honor-eyebrow">Your order</p>
            <h2 className="mt-2 break-all font-mono text-sm">{value.id}</h2>
          </div>
          <strong className="text-xl">
            {money(value.total_minor, value.currency)}
          </strong>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">Order status</p>
            <p className="mt-1 font-semibold">{orderLabel(value.status)}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">Payment status</p>
            <p className="mt-1 font-semibold">
              {paymentLabel(value.payment_status)}
            </p>
          </div>
        </div>
        {value.status === "PAID" && (
          <p className="text-sm leading-6 text-emerald-800">
            Your payment is confirmed. Payment confirmation does not mean your
            items are ready for collection. Contact the store about collection.
          </p>
        )}
        {value.payment_status === "REFUND_REQUIRED" && (
          <p className="text-sm text-amber-900">
            The store needs to review this payment and stock allocation. A
            refund has not been completed.
          </p>
        )}
        {value.status === "RESERVED" && (
          <p className="text-sm text-zinc-600">
            Reservation expires {new Date(value.expires_at).toLocaleString()}.
            Payment is confirmed only after the payment service verifies it.
          </p>
        )}
        {value.collection_location && (
          <div className="flex gap-3 rounded-xl border border-zinc-200 p-4">
            <MapPin size={20} className="shrink-0 text-emerald-700" />
            <div>
              <h3 className="font-semibold">
                {value.collection_location.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                {value.collection_location.address}
              </p>
            </div>
          </div>
        )}
        <ul className="divide-y divide-zinc-100">
          {value.lines.map((line) => (
            <li
              key={line.product_id}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                {line.name} × {line.quantity}
                {line.sku && (
                  <span className="mt-1 block text-xs text-zinc-500">
                    SKU: {line.sku}
                  </span>
                )}
                {!!line.serials?.length && (
                  <span className="mt-2 block break-all text-xs text-emerald-800">
                    Serial / IMEI: {line.serials.join(", ")}
                  </span>
                )}
              </span>
              <strong>
                {money(line.price_minor * line.quantity, value.currency)}
              </strong>
            </li>
          ))}
        </ul>
        {value.receipt_ready && (
          <div className="space-y-3">
            <button
              className="online-secondary"
              disabled={busy}
              onClick={() => run(() => api.receipt(value.id, orderKey))}
            >
              Download purchase receipt (PDF)
            </button>
            {value.status !== "FULFILLED" && (
              <p className="text-xs leading-5 text-zinc-500">
                Your receipt confirms payment. The exact device serial / IMEI is
                added after staff confirm handover.
              </p>
            )}
          </div>
        )}
        {value.status === "RESERVED" && (
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              className="honor-button"
              onClick={() => run(() => pay(value.id, orderKey))}
            >
              Continue to payment <ArrowRight size={16} />
            </button>
            {
              <button
                className="online-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.verifyPayment(value.id, orderKey);
                    await loadOrder(value.id, orderKey);
                  })
                }
              >
                Check payment with provider
              </button>
            }
            <button
              disabled={busy}
              className="online-secondary"
              onClick={() =>
                run(async () => {
                  await api.cancel(value.id, orderKey);
                  await loadOrder(value.id, orderKey);
                  sessionStorage.removeItem(tokenSlot);
                  await loadCatalogue();
                })
              }
            >
              Cancel unpaid order
            </button>

          </div>
        )}
        <button
          className="honor-text-button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await loadOrder(value.id, orderKey);
            })
          }
        >
          <RefreshCw size={15} /> Refresh status
        </button>
      </section>
    );
  }

  return (
    <div className="online-app flex min-h-screen flex-col bg-[#fafafa] text-zinc-900">
      <ConnectionNotice />
      <a
        href="#shop-content"
        className="sr-only focus:not-sr-only focus:block focus:p-4"
      >
        Skip to content
      </a>
      <div className="bg-zinc-900 px-4 py-2.5 text-center text-xs text-zinc-200">
        {catalogueMissing ? "Honor · Inventory, in order" : "Collection from the store · Stock is held after a successful reservation"}
      </div>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 px-5 py-5 sm:px-8 lg:grid-cols-[auto_1fr_auto] lg:gap-x-8">
          <a
            href={href("shop")}
            onClick={(e) => link(e, "shop")}
            aria-label="Honor shop"
          >
            <Brand small />
          </a>
          <nav
            aria-label="Customer navigation"
            className="order-3 col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 sm:gap-x-6 lg:order-none lg:col-span-1 lg:border-0 lg:p-0"
          >
            {nav("shop", "Shop")}
            {nav("locations", "Collection")}
            {nav("account", "Your orders")}
            <a
              href={href("cart")}
              onClick={(e) => link(e, "cart")}
              className="online-secondary ml-auto"
              aria-label={`View cart, ${count} items`}
            >
              <ShoppingBag size={18} />
              <span>Cart</span>
              <span className="tabular-nums">{count}</span>
            </a>
          </nav>
          {!customer && (
            <div className="flex items-center justify-end gap-3 sm:gap-4">
              {nav("login", "Sign in")}
              <a
                href={href("signup")}
                onClick={(e) => link(e, "signup")}
                className="honor-button whitespace-nowrap"
                aria-current={activeView === "signup" ? "page" : undefined}
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </header>
      <main
        id="shop-content"
        className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
      >
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
          >
            {notice}
          </div>
        )}
        {activeView === "shop" && (
          <>
            {catalogueMissing ? (
              <section className="honor-panel p-6 sm:p-10" aria-labelledby="shop-status-title">
                <p className="honor-eyebrow">Honor</p>
                <h1 id="shop-status-title" className="mt-4 text-2xl font-semibold sm:text-3xl">The shop is temporarily unavailable</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">We cannot load current products or stock right now. Please try again later.</p>
                <a href={staffUrl} className="honor-text-button mt-5">Staff sign-in <ArrowRight size={16} /></a>
              </section>
            ) : <div className="mb-8">
              <p className="honor-eyebrow">
                {catalogue?.company.name || "Honor"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Shop the collection
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
                Find what you need, check availability and collect from the
                store.
              </p>
            </div>}
            {catalogueError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"
              >
                <p>{catalogueError}</p>
                {configured && (
                  <button
                    className="honor-text-button mt-2"
                    onClick={loadCatalogue}
                  >
                    <RefreshCw size={15} /> Try again
                  </button>
                )}
              </div>
            )}
            {((catalogue && products.length > 0) || loading) && (
              <div className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="min-w-48 flex-1">
                  <Field label="Search products">
                    <div className="relative">
                      <Search
                        size={17}
                        className="absolute left-3 top-3.5 text-zinc-400"
                      />
                      <input
                        className={input + " pl-10"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name, SKU or category"
                      />
                    </div>
                  </Field>
                </div>
                <Field label="Category">
                  <select
                    className={input}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {["All", ...new Set(products.map((p) => p.category))].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Sort by">
                  <select
                    className={input}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="name">Name: A–Z</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </select>
                </Field>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(e) => setInStock(e.target.checked)}
                  />{" "}
                  In stock only
                </label>
              </div>
            )}
            {loading && !catalogue ? (
              <p role="status" className="py-16 text-center text-zinc-500">
                Loading the collection…
              </p>
            ) : catalogue && products.length === 0 ? (
              empty(
                "No products available yet",
                "The store has not published any products. Check back soon.",
              )
            ) : catalogue && !shown.length ? (
              <>
                {empty(
                  "No matching products",
                  "Try another search or clear your filters.",
                )}
                <button
                  className="honor-text-button mt-4"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                    setInStock(false);
                  }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((p) => (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                  >
                    <a
                      href={href("product", p.id)}
                      onClick={(e) => link(e, "product", p.id)}
                      className="block"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package size={40} className="text-zinc-300" />
                        )}
                      </div>
                      <div className="p-5">
                        <p className="text-xs text-zinc-500">
                          {p.category} · {p.sku}
                        </p>
                        <h2 className="mt-2 text-base font-semibold leading-6">
                          {p.name}
                        </h2>
                        <p className="mt-3 text-sm text-zinc-600 line-clamp-2">
                          {p.description}
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                          <strong>{money(p.price_minor, currency)}</strong>
                          <span
                            className={`text-xs ${p.available > 0 ? "text-emerald-800" : "text-zinc-500"}`}
                          >
                            {p.available > 0
                              ? "Available for collection"
                              : "Out of stock"}
                          </span>
                        </div>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {activeView === "product" && (
          <>
            {back}
            {loading ? (
              <p role="status">Loading product…</p>
            ) : !selected ? (
              empty(
                "Product unavailable",
                catalogueError ||
                  "This product is not in the published collection.",
              )
            ) : (
              <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-zinc-100">
                  {selected.image_url ? (
                    <img
                      src={selected.image_url}
                      alt={selected.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Package size={70} className="text-zinc-300" />
                  )}
                </div>
                <section className="honor-panel p-6 sm:p-8">
                  <p className="honor-eyebrow">{selected.category}</p>
                  <h1 className="mt-3 text-3xl font-semibold leading-tight">
                    {selected.name}
                  </h1>
                  <p className="mt-3 font-mono text-xs text-zinc-500">
                    SKU {selected.sku}
                  </p>
                  <p className="mt-7 text-3xl font-semibold">
                    {money(selected.price_minor, currency)}
                  </p>
                  <p className="mt-5 whitespace-pre-line text-sm leading-7 text-zinc-600">
                    {selected.description}
                  </p>
                  <p className="mt-6 text-sm font-medium text-emerald-800">
                    {selected.available > 0
                      ? "Available for collection"
                      : "Out of stock"}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    {cart[selected.id] ? (
                      quantity(
                        selected.id,
                        cart[selected.id],
                        Math.min(100, selected.available),
                      )
                    ) : (
                      <button
                        disabled={selected.available <= 0}
                        className="honor-button"
                        onClick={() => updateCart(selected.id, 1)}
                      >
                        <Plus size={17} /> Add to cart
                      </button>
                    )}
                    <button
                      className="online-secondary"
                      onClick={() => navigate("cart")}
                    >
                      View cart <ArrowRight size={16} />
                    </button>
                  </div>
                  <p className="mt-6 border-t border-zinc-100 pt-5 text-sm leading-6 text-zinc-500">
                    Adding to your cart does not hold stock. Availability and
                    price are checked when you reserve.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
        {(activeView === "cart" || activeView === "checkout") && (
          <>
            {back}
            <h1 className="mb-8 text-3xl font-semibold">
              {activeView === "cart" ? "Your cart" : "Review & checkout"}
            </h1>
            {!count ? (
              <>
                {empty(
                  "Your cart is empty",
                  "Products you choose will appear here.",
                )}
                <button
                  className="honor-button mt-6"
                  onClick={() => navigate("shop")}
                >
                  Browse the collection
                </button>
              </>
            ) : (
              <div className="grid items-start gap-8 lg:grid-cols-3">
                <div className="space-y-5 lg:col-span-2">
                  {missing.map((id) => (
                    <div
                      key={id}
                      className="honor-panel flex items-center justify-between gap-4 p-5"
                    >
                      <p className="text-sm">An item is no longer available.</p>
                      <button
                        className="online-secondary"
                        onClick={() => updateCart(id, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="honor-panel flex flex-wrap items-center gap-5 p-5"
                    >
                      <div className="min-w-40 flex-1">
                        <h2 className="font-semibold">{p.name}</h2>
                        <p className="mt-1 text-xs text-zinc-500">{p.sku}</p>
                        <p className="mt-3 text-sm">
                          {money(p.price_minor, currency)} each
                        </p>
                        {cart[p.id] > p.available && (
                          <p className="mt-2 text-sm text-amber-900">
                            Availability changed. Reduce the quantity or remove
                            this item.
                          </p>
                        )}
                      </div>
                      {quantity(p.id, cart[p.id], Math.min(100, p.available))}
                      <strong className="min-w-20 text-right">
                        {money(cart[p.id] * p.price_minor, currency)}
                      </strong>
                      <button
                        className="p-2 text-zinc-500"
                        aria-label={"Remove " + p.name}
                        onClick={() => updateCart(p.id, 0)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {activeView === "checkout" && customer && (
                    <form
                      id="checkout-form"
                      onSubmit={checkout}
                      className="honor-panel space-y-5 p-6 sm:p-8"
                    >
                      <h2 className="text-xl font-semibold">Your details</h2>
                      <Field label="Full name">
                        <input
                          key={customer?.id + "-name"}
                          className={input}
                          name="name"
                          autoComplete="name"
                          required
                          minLength={2}
                          maxLength={120}
                          defaultValue={customer?.name || ""}
                        />
                      </Field>
                      <Field label="Email for your order">
                        <input
                          key={customer?.id + "-email"}
                          className={input}
                          type="email"
                          name="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          value={customer.email}
                          readOnly
                        />
                      </Field>
                      <p className="text-sm leading-6 text-zinc-500">
                        The store will allocate your complete order to one
                        collection location. Its address appears after your
                        reservation. No delivery is included.
                      </p>

                    </form>
                  )}
                </div>
                <aside className="honor-panel space-y-5 p-6">
                  <h2 className="text-lg font-semibold">Order summary</h2>
                  <div className="flex justify-between text-sm">
                    <span>Items ({count})</span>
                    <span>{money(total, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fulfilment</span>
                    <span>Collection</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-5 font-semibold">
                    <span>Estimated total</span>
                    <span>{money(total, currency)}</span>
                  </div>
                  <p className="text-sm leading-6 text-zinc-500">
                    Final prices and stock are confirmed by the store when your
                    order is reserved.
                  </p>
                  {invalidCart && (
                    <p role="alert" className="text-sm text-amber-900">
                      Update unavailable items before continuing.
                    </p>
                  )}
                  {!customer ? (
                    <button className="honor-button w-full" disabled={invalidCart || !catalogue || loading} onClick={() => {
                      sessionStorage.setItem("honor:after-login:" + slug, "checkout");
                      navigate("login");
                      setNotice("Sign in to continue checkout. Your cart is saved.");
                    }}>Sign in to checkout <ArrowRight size={16} /></button>
                  ) : activeView === "cart" ? (
                    <button
                      disabled={invalidCart || !catalogue || loading}
                      className="honor-button w-full"
                      onClick={() => navigate("checkout")}
                    >
                      Continue to checkout <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      form="checkout-form"
                      type="submit"
                      disabled={
                        busy ||
                        invalidCart ||
                        !catalogue?.checkout_enabled ||
                        !configured
                      }
                      className="honor-button w-full"
                    >
                      {busy ? "Checking availability…" : "Reserve & pay"}
                      <ArrowRight size={16} />
                    </button>
                  )}
                  {!catalogue?.checkout_enabled && (
                    <p className="text-sm text-amber-900">
                      This store is not accepting online payments yet.
                    </p>
                  )}
                  <p className="flex gap-2 text-xs leading-5 text-zinc-500">
                    <ShieldCheck size={16} className="shrink-0" />
                    Payment details are entered at hosted checkout.
                  </p>
                  {!!catalogue?.payment_methods?.length && (
                    <p className="mt-3 text-xs leading-6 text-zinc-500">
                      Checkout methods:{" "}
                      {catalogue.payment_methods
                        .map((x) => x.replaceAll("_", " "))
                        .join(", ")}
                      .
                      {catalogue.payment_methods.includes("bank_transfer") &&
                        " Transfer from your banking app to the account shown by the payment provider. No saved card is required."}
                    </p>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
        {["login", "signup", "recover"].includes(activeView) && (
          <div className="honor-auth mx-auto max-w-md">
            {back}
            <p className="honor-eyebrow mb-2">Customer account</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {activeView === "signup"
                ? "Create your account"
                : activeView === "recover"
                  ? "Reset your password"
                  : "Welcome back"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {activeView === "recover" ? "Enter your email and we’ll send a password recovery link." : activeView === "signup" ? "Create a customer account to keep your orders and receipts together." : "Sign in to view your orders and receipts."}
            </p>
            <form
              key={activeView}
              onSubmit={auth}
              onChange={pendingAuth.cancel}
              className="honor-panel mt-6 space-y-5 p-5 sm:p-7"
            >
              {!accountConfigured && (
                <p role="status" className="honor-auth-status">
                  Account services are temporarily unavailable. You can enter your details, but they will only be submitted when the service is available.
                </p>
              )}
              <fieldset disabled={busy} className="space-y-5">
              {activeView === "signup" && (
                <Field label="Your name">
                  <input
                    className={input}
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </Field>
              )}
              <Field label="Email address">
                <input
                  className={input}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </Field>
              {activeView !== "recover" && (
                <Field label="Password">
                  <div className="relative">
                    <input
                      name="password"
                      aria-label="Password"
                      className={input + " pr-12"}
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        activeView === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      required
                      minLength={activeView === "signup" ? 12 : 1}
                      maxLength={256}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 p-2"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {activeView === "signup" && (
                    <span className="block text-xs text-zinc-500">
                      Use at least 12 characters.
                    </span>
                  )}
                </Field>
              )}
              <button
                className="honor-button w-full"
                disabled={busy || pendingAuth.waiting}
              >
                {busy
                  ? "Please wait…"
                  : activeView === "signup"
                    ? "Create account"
                    : activeView === "recover"
                      ? "Send recovery link"
                      : "Sign in"}
              </button>
              </fieldset>
              <SubmissionStatus {...pendingAuth} />
            </form>
            <div className="honor-auth-links mt-4 flex flex-wrap justify-between gap-x-4 text-sm">
              {nav(
                activeView === "login" ? "signup" : "login",
                activeView === "signup"
                  ? "Already have an account? Sign in"
                  : activeView === "recover" ? "Back to customer sign-in" : "Create a customer account",
              )}
              {activeView !== "recover" && nav("recover", "Forgot password?")}
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-4 text-xs text-zinc-500">Honor staff or admin? <a href={staffUrl} className="honor-text-button">Open staff workspace <ArrowRight size={15} /></a></div>
          </div>
        )}
        {activeView === "account" && (
          <div className="mx-auto max-w-3xl">
            {back}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold">Your orders</h1>
                <p className="mt-3 text-sm text-zinc-500">
                  {customer
                    ? `Signed in as ${customer.name} · ${customer.email}`
                    : "Sign in for your order history, or use your private order access code."}
                </p>
              </div>
              {customer && (
                <button
                  className="online-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api.logout();
                      setCustomer(null);
                      setHistory(null);
                      setOrder(null);
                      setOrderKey("");
                      for (const key of Object.keys(sessionStorage))
                        if (key.startsWith("honor:order:"))
                          sessionStorage.removeItem(key);
                      sessionStorage.removeItem(currentOrderSlot);
                      sessionStorage.removeItem(tokenSlot);
                      setNotice("You are signed out.");
                    })
                  }
                >
                  Sign out
                </button>
              )}
            </div>
            {profileError && (
              <div role="alert" className="mb-6 text-sm text-amber-900">
                {profileError}{" "}
                <button className="underline" onClick={loadProfile}>
                  Try again
                </button>
              </div>
            )}
            {customer && (
              <section className="mb-8">
                <h2 className="mb-4 text-lg font-semibold">Account history</h2>
                {history === null ? (
                  <p role="status" className="text-sm text-zinc-500">
                    {profileError
                      ? "Order history could not be loaded."
                      : "Loading your orders…"}
                  </p>
                ) : !slug ? (
                  empty("Your account is ready", "Your order history will appear here once the shop opens and you place an order.")
                ) : !history.length ? (
                  empty(
                    "No orders yet",
                    "Orders you place while signed in will appear here. Guest orders stay private to their access code.",
                  )
                ) : (
                  <ul className="honor-panel divide-y divide-zinc-100">
                    {history.map((item) => (
                      <li key={item.id}>
                        <button
                          className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left"
                          onClick={() =>
                            run(async () => {
                              const key =
                                sessionStorage.getItem(
                                  "honor:order:" + item.id,
                                ) || "";
                              await loadOrder(item.id, key);
                              setOrderKey(key);
                            })
                          }
                        >
                          <span>
                            <span className="block text-sm font-semibold">
                              {orderLabel(item.status)}
                            </span>
                            <span className="mt-1 block font-mono text-xs text-zinc-500">
                              {item.id}
                            </span>
                          </span>
                          <span className="text-sm font-semibold">
                            {money(item.total_minor, item.currency)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {!customer && (
              <a
                href={href("login")}
                onClick={(e) => link(e, "login")}
                className="honor-button mb-8"
              >
                Sign in to your account <ArrowRight size={16} />
              </a>
            )}
            {order && orderCard(order)}
            <details className="honor-panel mt-8 p-6" open={!order}>
              <summary className="cursor-pointer font-semibold">
                Look up a private order
              </summary>
              <form
                className="mt-6 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await loadOrder(lookupId.trim(), lookupKey.trim());
                    setOrderKey(lookupKey.trim());
                  });
                }}
              >
                <fieldset disabled={!accountConfigured || busy} className="space-y-5">
                <Field label="Order reference">
                  <input
                    className={input}
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value)}
                    required
                    maxLength={36}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Private order access code">
                  <input
                    className={input}
                    type="password"
                    value={lookupKey}
                    onChange={(e) => setLookupKey(e.target.value)}
                    required
                    minLength={32}
                    maxLength={128}
                    autoComplete="off"
                  />
                </Field>
                <p className="text-sm leading-6 text-zinc-500">
                  Keep this code private. Your email and order reference alone
                  cannot open a guest order.
                </p>
                <button
                  className="online-secondary"
                  disabled={busy || !accountConfigured}
                >
                  Check order
                </button>
                </fieldset>
              </form>
            </details>
            {order && orderKey && (
              <details className="mt-5 rounded-xl border border-zinc-200 p-4 text-sm">
                <summary className="cursor-pointer">
                  Save your private order access code
                </summary>
                <p className="mt-3 leading-6 text-zinc-500">
                  This browser remembers the code for this session. Save it
                  securely if you need to open your guest order elsewhere.
                </p>
                <code className="mt-3 block break-all rounded bg-white p-3">
                  {orderKey}
                </code>
              </details>
            )}
          </div>
        )}
        {activeView === "locations" && (
          <>
            {back}
            <h1 className="text-3xl font-semibold">Collection locations</h1>
            <p className="mt-4 mb-8 max-w-xl text-sm leading-7 text-zinc-600">
              Your order is assigned to a location that can supply every item.
              Confirm the address on your order before travelling.
            </p>
            {catalogueMissing ? (
              empty("Collection details unavailable", "We cannot load the store’s collection locations right now. Please try again later.")
            ) : catalogueError ? (
              <p role="alert" className="text-sm text-amber-900">
                Collection details are unavailable right now.
              </p>
            ) : !catalogue ? (
              <p role="status">Loading collection details…</p>
            ) : !catalogue.locations?.length ? (
              empty(
                "Collection details unavailable",
                "Collection addresses will appear when the store makes them available.",
              )
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {catalogue.locations.map((loc) => (
                  <section key={loc.id} className="honor-panel p-6">
                    <MapPin className="mb-4 text-emerald-700" size={22} />
                    <h2 className="font-semibold">{loc.name}</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-500">
                      {loc.address}
                    </p>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="mt-12 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 text-sm text-zinc-500 sm:px-8">
          <p>{catalogue?.company.name && catalogue.company.name !== "Honor" ? `${catalogue.company.name} · Powered by Honor` : "Honor · Inventory, in order"}</p>
          <a
            className="underline underline-offset-4 hover:text-zinc-900"
            href={staffUrl}
          >
            Staff sign-in
          </a>
        </div>
      </footer>
    </div>
  );
}
