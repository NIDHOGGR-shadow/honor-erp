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
import { Field } from "./ui";
import { readAuthCallback } from "./authCallback";
import { ConnectionNotice, SubmissionStatus, useAuthSubmission } from "./connection";
import { catalogueSelection, productVariants, readShopFilters, variantLabel } from "./catalogue";
import { AddedToCart, CategoryShortcuts, CollectionBanner, ProductImage, StoreFooter, StoreHeader, StoreHero, StoreProductCard } from "./StorefrontDesign";

type Props = {
  slug: string;
  apiBase?: string;
  initial?: Catalogue;
  staffUrl?: string;
  initialSearch?: string;
  configured?: boolean;
  accountConfigured?: boolean;
  preview?: boolean;
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We could not complete this request. Please try again.";
const input = "online-input";

// Reference-based shopping presentation. Inventory and payment state stay API-owned.
export default function Storefront({
  slug,
  apiBase = "/api/v1",
  initial,
  initialSearch = "",
  configured = true,
  accountConfigured = configured,
  preview = false,
}: Props) {
  const api = useMemo(() => customerApi(apiBase, slug), [apiBase, slug]);
  const [route, setRoute] = useState(() => readRoute(initialSearch));
  const [catalogue, setCatalogue] = useState(initial);
  const [loading, setLoading] = useState(!initial && configured);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueMissing, setCatalogueMissing] = useState(!configured);
  const [catalogueFailure, setCatalogueFailure] = useState<"not-configured" | "not-found" | "unreachable" | null>(configured ? null : "not-configured");
  const connectionRetries = useRef(0);
  const profileGeneration = useRef(0);
  const [cart, setCart] = useState<Cart>({});
  const [addedProductId, setAddedProductId] = useState("");
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
  const [query, setQuery] = useState(() => readShopFilters(initialSearch).query);
  const [category, setCategory] = useState(() => readShopFilters(initialSearch).category);
  const [inStock, setInStock] = useState(() => readShopFilters(initialSearch).inStock);
  const [sort, setSort] = useState(() => readShopFilters(initialSearch).sort);
  const [shelf, setShelf] = useState(() => readShopFilters(initialSearch).shelf);
  const products = catalogue?.products || [];
  const currency = catalogue?.company.currency || "NGN";
  const cartSlot = "honor:cart:" + slug;
  const tokenSlot = "honor:checkout-key:" + slug;
  const currentOrderSlot = "honor:current-order:" + slug;
  const items = products.filter((p) => cart[p.id] > 0);
  const missing = Object.keys(cart).filter(
    (id) => !products.some((p) => p.id === id),
  );
  const invalidCart =
    missing.length > 0 || items.some((p) => cart[p.id] > p.available || p.price_minor <= 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = items.reduce((sum, p) => sum + p.price_minor * cart[p.id], 0);
  const selected = products.find((p) => p.id === route.product);

  const loadCatalogue = useCallback(async () => {
    if (!configured || preview) return;
    setLoading(true);
    setCatalogueError("");
    try {
      setCatalogue(await api.catalogue());
      setCatalogueMissing(false);
      setCatalogueFailure(null);
      connectionRetries.current = 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setCatalogue(undefined);
        setCatalogueMissing(true);
        setCatalogueFailure("not-found");
      } else {
        setCatalogueFailure("unreachable");
        setCatalogueError("We couldn't connect to the HONOR product catalogue. Check your connection or try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [api, configured, preview]);
  // A free-tier backend can take time to wake. Retry interrupted requests
  // briefly, without inventing products, payment confirmations or inventory.
  useEffect(() => {
    if (!configured || preview || !catalogueError || connectionRetries.current >= 2) return;
    const retry = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        connectionRetries.current += 1;
        void loadCatalogue();
      }
    }, 12000);
    return () => window.clearTimeout(retry);
  }, [configured, preview, catalogueError, loadCatalogue]);
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
    restoreFilters(window.location.search);
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
      setAddedProductId("");
      restoreFilters(window.location.search);
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
  useEffect(() => {
    if (!configured || preview || route.view !== "shop") return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void loadCatalogue(); }, 60000);
    return () => clearInterval(timer);
  }, [configured, preview, route.view, loadCatalogue]);

  function href(view: ShopView, product = "") {
    const params = new URLSearchParams();
    if (view !== "shop") params.set("view", view);
    if (product) params.set("product", product);
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);
    if (sort !== "featured") params.set("sort", sort);
    if (shelf !== "featured") params.set("shelf", shelf);
    if (inStock) params.set("stock", "1");
    return "?" + params.toString();
  }
  function restoreFilters(search: string) {
    const filters = readShopFilters(search);
    setQuery(filters.query); setCategory(filters.category); setSort(filters.sort); setShelf(filters.shelf); setInStock(filters.inStock);
  }
  function browse(nextCategory = category, nextQuery = query, nextSort = sort, nextStock = inStock, nextShelf = "featured") {
    const params = new URLSearchParams();
    if (nextCategory !== "All") params.set("category", nextCategory);
    if (nextQuery) params.set("q", nextQuery);
    if (nextSort !== "featured") params.set("sort", nextSort);
    if (nextStock) params.set("stock", "1");
    if (nextShelf !== "featured") params.set("shelf", nextShelf);
    window.history.pushState({}, "", "?" + params.toString() + "#catalogue");
    restoreFilters(params.toString()); setAddedProductId(""); setRoute({ view: "shop", product: "" }); setError(""); setNotice("");
    requestAnimationFrame(() => document.getElementById("catalogue")?.scrollIntoView({ block: "start" }));
  }
  function navigate(view: ShopView, product = "") {
    window.history.pushState({}, "", href(view, product));
    setRoute({ view, product });
    setAddedProductId("");
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
      return false;
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
    return q > 0;
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
      let created;
      try {
        created = await api.reserve(
          String(form.get("name")), customer.email, key,
          checkoutLines(cart, products), total,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) await loadCatalogue();
        throw error;
      }
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
    if (preview) { setNotice("Sign-in is unavailable on this review page."); return; }
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
  const shown = catalogueSelection(products, { query, category, sort, shelf, inStock }, catalogue?.recommendations);
  const featured = catalogueSelection(products, { query: "", category: "All", sort: "featured", shelf: "featured", inStock: true }, catalogue?.recommendations);
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

  const addedProduct = products.find(product => product.id === addedProductId);
  return (
    <div className="online-app storefront flex min-h-screen flex-col">
      <ConnectionNotice />
      {preview ? <aside className="store-review-note" aria-label="Storefront review">Prices and availability are illustrative. Purchases are disabled.</aside> : catalogue?.simulation && <div className="store-preview-label" role="status">Test checkout · No real purchases</div>}
      <a
        href="#shop-content"
        className="sr-only focus:not-sr-only focus:block focus:p-4"
      >
        Skip to content
      </a>
      <StoreHeader searchKey={`honor:recent-searches:${preview ? "review:" : ""}${slug}`} products={products} view={activeView} category={category} query={query} count={count} signedIn={Boolean(customer)} href={href} onNavigate={navigate} onBrowse={browse} onQuery={setQuery} />
      <main
        id="shop-content"
        className={`store-main ${activeView === "shop" ? "" : "store-page"} ${["login", "signup", "recover"].includes(activeView) ? "store-customer-auth" : ""}`}
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
            {!catalogueMissing && !loading && featured.some((p) => p.available > 0) && <StoreHero products={featured} currency={currency} heading={catalogue?.company.storefront_content?.heading} introduction={catalogue?.company.storefront_content?.introduction} href={href} onNavigate={navigate} />}
            <div className="store-page">
              {catalogueMissing ? <section className="honor-panel p-6 sm:p-10" aria-labelledby="shop-status-title">
                <p className="honor-eyebrow">HONOR</p>
                <h1 id="shop-status-title" className="mt-4 text-2xl font-semibold sm:text-3xl">The shop is temporarily unavailable</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
                  {catalogueFailure === "not-configured"
                    ? "The online product catalogue hasn't been connected to this website yet. Staff sign-in may still work separately."
                    : catalogueFailure === "not-found"
                      ? "We couldn't find the store catalogue at this address. The store owner may need to confirm the website's shop connection."
                      : "We cannot load current products or stock right now. Please try again later."}
                </p>
                {configured && <button type="button" className="online-secondary mt-5" onClick={() => { connectionRetries.current = 0; void loadCatalogue(); }} disabled={loading}><RefreshCw size={15} /> {loading ? "Connecting…" : "Try loading products again"}</button>}
                <p className="mt-5 text-xs text-zinc-500">We won't display unverified stock or prices while the catalogue is unavailable.</p>
              </section> : <>
              <CategoryShortcuts products={products} onBrowse={browse} onLocations={() => navigate("locations")} />
              <section id="catalogue" className="store-catalogue" aria-labelledby="catalogue-title">
                <div className="store-section-heading"><div><p className="store-kicker">HONOR Nigeria</p><h2 id="catalogue-title">{catalogue?.company.storefront_content?.heading || "Featured products"}</h2></div>{products.length > 0 && <button className="honor-text-button" onClick={() => browse("All", "", "featured", false)}>View all products <ArrowRight size={16} /></button>}</div>
                {catalogue?.company.storefront_content?.introduction && <p className="store-reference-explainer">{catalogue.company.storefront_content.introduction}</p>}
                {catalogueError && <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><p>{catalogueError}</p><button className="honor-text-button mt-2" onClick={loadCatalogue}><RefreshCw size={15} /> Try again</button></div>}
                {products.length > 0 && <>
                  <div className="store-filter-tabs" aria-label="Product collections">{[["featured", "All products"], ...(catalogue?.recommendations?.trending_product_ids.length ? [["trending", "Selling fast"]] : []), ...(catalogue?.recommendations?.popular_product_ids.length ? [["popular", "Popular this week"]] : []), ["budget", "Budget picks"]].map(([value, label]) => <button key={value} aria-pressed={shelf === value} onClick={() => browse(category, query, "featured", inStock, value)}>{label}</button>)}</div>
                  <div className="store-filters"><div className="store-filter-search"><Field label="Search products"><input className={input} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") browse(category, query, sort, inStock, shelf); }} placeholder="Name, model, colour or memory" /></Field></div><Field label="Category"><select aria-label="Category" className={input} value={category} onChange={e => browse(e.target.value, query, sort, inStock, shelf)}>{["All", ...new Set(products.map(p => p.category))].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Sort by"><select aria-label="Sort by" className={input} value={sort} onChange={e => browse(category, query, e.target.value, inStock, shelf)}><option value="featured">Recommended order</option><option value="name">Name: A–Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></Field><label className="store-stock-filter"><input type="checkbox" checked={inStock} onChange={e => browse(category, query, sort, e.target.checked, shelf)} /> In stock only</label></div>
                  <p className="store-result-count" role="status">{shown.length} {shown.length === 1 ? "product" : "products"}{shelf === "trending" ? " · Growing demand over the last 7 days" : shelf === "popular" ? " · Based on verified purchases in the last 7 days" : shelf === "budget" ? " · Lower-priced available choices in each category" : ""}</p>
                </>}
                {loading && !catalogue ? <p role="status" className="py-16 text-center text-zinc-500">Loading the collection…</p> : catalogue && !products.length ? empty("No products available right now", "Products and prices will appear after they are published by HONOR.") : catalogue && !shown.length ? <>{empty("No matching products", "Try another search or clear your filters.")}<button className="honor-text-button mt-4" onClick={() => browse("All", "", "featured", false)}>Clear filters</button></> : <div className="store-product-grid">{shown.map(p => <StoreProductCard key={p.id} product={p} currency={currency} trending={catalogue?.recommendations?.trending_product_ids.includes(p.id)} popular={catalogue?.recommendations?.popular_product_ids.includes(p.id)} href={href} onNavigate={navigate} />)}</div>}
              </section>
              </>}
              <CollectionBanner href={href} onNavigate={navigate} />
            </div>
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
                <div className="store-product-image"><ProductImage src={selected.image_url} name={selected.name} eager /></div>
                <section className="honor-panel p-6 sm:p-8">
                  <p className="honor-eyebrow">{selected.category}</p>
                  <h1 className="mt-3 text-3xl font-semibold leading-tight">
                    {selected.name}
                  </h1>
                  {!preview && <p className="mt-3 font-mono text-xs text-zinc-500">SKU {selected.sku}</p>}
                  {productVariants(products, selected).length > 1 && <div className="mt-5"><Field label="Colour and memory"><select aria-label="Colour and memory" className="online-input" value={selected.id} onChange={event => navigate("product", event.target.value)}>{productVariants(products, selected).map(variant => <option key={variant.id} value={variant.id}>{variantLabel(variant)} · {money(variant.price_minor, currency)}{variant.available <= 0 ? " · Out of stock" : ""}</option>)}</select></Field></div>}
                  {(selected.colour || selected.memory || selected.market) && <p className="mt-4 text-sm text-zinc-500">{variantLabel(selected)}</p>}
                  <p className="mt-7 text-3xl font-semibold">
                    {selected.price_minor > 0 ? money(selected.price_minor, currency) : "Price to be added"}
                  </p>
                  <p className="mt-5 whitespace-pre-line text-sm leading-7 text-zinc-600">
                    {selected.description}
                  </p>
                  {selected.source_url && <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-emerald-800 underline">Full specifications</a>}
                  <p className="mt-6 text-sm font-medium text-emerald-800">
                    {selected.available > 0
                      ? "Available for collection"
                      : "Out of stock"}
                  </p>
                  {!!selected.location_availability?.length && <div className="mt-5 space-y-2 text-sm"><p className="font-medium">Availability by collection location</p>{selected.location_availability.map(stock => <p key={stock.location_id} className="flex justify-between gap-4 text-zinc-500"><span>{catalogue?.locations?.find(location => location.id === stock.location_id)?.name || "Collection location"}</span><span>{stock.available > 0 ? stock.available + " available" : "Out of stock"}</span></p>)}</div>}
                  <div className="mt-7 flex flex-wrap gap-3">
                    {cart[selected.id] ? (
                      quantity(
                        selected.id,
                        cart[selected.id],
                        Math.min(100, selected.available),
                      )
                    ) : (
                      <button
                        disabled={selected.available <= 0 || selected.price_minor <= 0}
                        className="honor-button"
                        onClick={() => { if (updateCart(selected.id, 1)) setAddedProductId(selected.id); }}
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
            <nav aria-label="Checkout progress" className="store-steps"><span aria-current={activeView === "cart" ? "step" : undefined}>1. Your cart</span><ArrowRight size={14} /><span aria-current={activeView === "checkout" ? "step" : undefined}>2. Review</span><ArrowRight size={14} /><span>3. Secure payment</span></nav>
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
                      <ProductImage src={p.image_url} name={p.name} className="store-cart-photo" /><div className="min-w-40 flex-1">
                        <h2 className="font-semibold">{p.name}</h2>
                        <p className="mt-1 text-xs text-zinc-500">{preview ? variantLabel(p, false) : p.sku}</p>
                        <p className="mt-3 text-sm">
                          {p.price_minor > 0 ? money(p.price_minor, currency) : "Price to be added"} each
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
                    <span>{items.some((p) => p.price_minor <= 0) ? "Pending prices" : money(total, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fulfilment</span>
                    <span>Collection</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-5 font-semibold">
                    <span>Estimated total</span>
                    <span>{items.some((p) => p.price_minor <= 0) ? "Pending prices" : money(total, currency)}</span>
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
            <p className="honor-eyebrow mb-2">HONOR · YOUR ACCOUNT</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {activeView === "signup"
                ? "Create your account"
                : activeView === "recover"
                  ? "Reset your password"
                  : "Welcome back to HONOR"}
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
                  {preview ? "Sign-in is unavailable on this review page." : "Account services are temporarily unavailable. You can enter your details, but they will only be submitted when the service is available."}
                </p>
              )}
              <fieldset disabled={busy || preview} className="space-y-5">
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
                      className={input + " pr-24"}
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
                      className="honor-password-toggle absolute right-1 top-1"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}<span>{showPassword ? "Hide" : "Show"}</span>
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
                disabled={busy || preview || pendingAuth.waiting}
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
            <h1 className="text-3xl font-semibold">{catalogue?.company.storefront_content?.collection_heading || "Collection locations"}</h1>
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
      {addedProduct && cart[addedProductId] > 0 && <AddedToCart product={addedProduct} quantity={cart[addedProductId]} currency={currency} onClose={() => setAddedProductId("")} onViewCart={() => { setAddedProductId(""); navigate("cart"); }} />}
      <StoreFooter companyName={catalogue?.company.name} products={products} currency={currency} signedIn={Boolean(customer)} href={href} onNavigate={navigate} onBrowse={browse} />
    </div>
  );
}
