"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  ApiError,
  client,
  Location,
  Me,
  money,
  Order,
  Product,
} from "./api";
import { Badge, Brand, Empty, Field, Modal } from "./ui";
import { readAuthCallback } from "./authCallback";
import { ConnectionNotice, SubmissionStatus, useAuthSubmission } from "./connection";
import PasswordSetup from "./PasswordSetup";
import {
  blankWorkspace as blank,
  canOpenWorkspacePage,
  loadWorkspaceSession,
  type WorkspaceBundle as Bundle,
} from "./workspaceSession";

function HandoverForm({
  order,
  products,
  busy,
  onSubmit,
}: {
  order: Order;
  products: Product[];
  busy: boolean;
  onSubmit: (
    devices: { product_id: string; serials: string[] }[],
  ) => Promise<void>;
}) {
  const [scans, setScans] = useState<Record<string, string>>({});
  const devices = order.lines.filter((line) =>
    products.some((p) => p.id === line.product_id && p.tracking === "SERIAL"),
  );
  return (
    <form
      className="w-full space-y-4 rounded-xl bg-zinc-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          devices.map((line) => ({
            product_id: line.product_id,
            serials: (scans[line.product_id] || "")
              .split(/[,\n]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          })),
        );
      }}
    >
      <p className="text-xs leading-6 text-zinc-500">
        Confirm the goods you are handing over. Only devices at this location
        that are available or reserved for this order can be issued.
      </p>
      {devices.map((line) => (
        <Field
          key={line.product_id}
          label={`${line.name}: scan ${line.quantity} serial / IMEI number${line.quantity === 1 ? "" : "s"}`}
        >
          <textarea
            required
            className="online-input font-mono"
            rows={Math.min(4, line.quantity)}
            maxLength={line.quantity * 102}
            placeholder="Scan or enter one identifier per line"
            autoComplete="off"
            value={scans[line.product_id] || ""}
            onChange={(e) =>
              setScans({ ...scans, [line.product_id]: e.target.value })
            }
          />
        </Field>
      ))}
      <button className="honor-button" disabled={busy}>
        <Check size={14} />
        Confirm handover / collected
      </button>
    </form>
  );
}

function SerialLookup({ api }: { api: ReturnType<typeof client> }) {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<{
    serial: string;
    product: string;
    sku: string;
    status: string;
    order_id?: string;
    sales: { order_id: string; customer_name: string; created_at: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details className="mx-6 mb-5 rounded-xl border border-zinc-200 p-4">
      <summary className="cursor-pointer text-xs font-medium">
        Staff device lookup - serial / IMEI
      </summary>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          try {
            setResult(
              await api.request(
                "/stock/serial-search?serial=" +
                  encodeURIComponent(serial.trim()),
              ),
            );
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Exact serial / IMEI">
          <input
            required
            className="online-input font-mono"
            value={serial}
            maxLength={100}
            onChange={(e) => setSerial(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <button className="online-secondary" disabled={busy}>
          {busy ? "Searching…" : "Find device"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
      {result && (
        <div
          role="status"
          className="mt-4 space-y-2 break-all text-xs leading-6"
        >
          <p className="font-semibold">
            {result.product} · {result.sku}
          </p>
          <p>
            {result.serial} · {result.status.replaceAll("_", " ")}
          </p>
          {result.order_id && <p>Current order: {result.order_id}</p>}
          <p className="text-zinc-500">
            {result.sales.length
              ? "Previous confirmed sales:"
              : "No confirmed sale history."}
          </p>
          {result.sales.map((sale) => (
            <p key={sale.order_id}>
              {sale.order_id} · {sale.customer_name} ·{" "}
              {new Date(sale.created_at).toLocaleString()}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}

type Page =
  | "Overview"
  | "Inventory"
  | "Receive stock"
  | "Transfers"
  | "Orders"
  | "People & access"
  | "Activity"
  | "Security"
  | "Company";
const pages: {
  label: Page;
  icon: React.ComponentType<any>;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Inventory", icon: Boxes },
  { label: "Receive stock", icon: ArrowDownToLine },
  { label: "Transfers", icon: Truck },
  { label: "Orders", icon: ShoppingBag },
  { label: "People & access", icon: Users },
  { label: "Activity", icon: Activity },
  { label: "Security", icon: ShieldCheck },
  { label: "Company", icon: Settings },
];

export default function Workspace({
  apiBase = "/api/v1",
  configured = true,
  initialSearch = "",
  shopUrl,
}: {
  apiBase?: string;
  configured?: boolean;
  initialSearch?: string;
  shopUrl?: string;
}) {
  const publicApi = useMemo(() => client(apiBase), [apiBase]);
  const inviteToken = new URLSearchParams(initialSearch || (typeof window === "undefined" ? "" : window.location.search)).get("invite") || "";
  const [recoveryToken, setRecoveryToken] = useState(() =>
    new URLSearchParams(
      initialSearch || (typeof window === "undefined" ? "" : window.location.search),
    ).get("recovery") || "",
  );
  const [me, setMe] = useState<Me | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<Bundle>(blank);
  const [config, setConfig] = useState<any>(null);
  const [page, setPage] = useState<Page>("Overview");
  const [location, setLocation] = useState("ALL");
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(configured && !recoveryToken);
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<{ kind: string; record?: any } | null>(
    null,
  );
  const [enrolment, setEnrolment] = useState<any>(null);
  const [invitationLink, setInvitationLink] = useState("");
  const version = useRef(0);
  const accessIdentity = useRef("");
  const company = me?.companies.find((c) => c.id === companyId);
  const api = useMemo(() => client(apiBase, companyId), [apiBase, companyId]);
  const privileged = company?.role === "ADMIN" || company?.role === "MANAGER";
  const stockStaff = privileged || company?.role === "STOCK";

  const clearSession = useCallback(() => {
    ++version.current;
    accessIdentity.current = "";
    setMe(null);
    setCompanyId("");
    setData(blank);
    setLastSynced(null);
    setPage("Overview");
    setLocation("ALL");
    setQuery("");
    setModal(null);
    setEnrolment(null);
    setInvitationLink("");
    setNotice("");
    setMobile(false);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (!configured || recoveryToken) {
      setLoading(false);
      return;
    }
    const generation = ++version.current;
    try {
      const next = await loadWorkspaceSession(apiBase, companyId);
      if (generation !== version.current) return;
      const selected = next.me.companies.find((c) => c.id === next.companyId);
      const identity = JSON.stringify([next.me.id, next.companyId, selected?.role]);
      if (identity !== accessIdentity.current) {
        setPage("Overview");
        setLocation("ALL");
        setQuery("");
        setModal(null);
        setEnrolment(null);
        setInvitationLink("");
        accessIdentity.current = identity;
      }
      setMe(next.me);
      setCompanyId(next.companyId);
      setData(next.data);
      setLastSynced(new Date());
    } catch (e) {
      if (generation !== version.current) return;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        const hadAccess = !!accessIdentity.current;
        clearSession();
        if (e.status === 403)
          setError("Your workspace access has changed. Sign in again or contact your company administrator.");
        else if (hadAccess) setError("Your session has ended. Please sign in again.");
      } else setError((e as Error).message);
    } finally {
      if (generation === version.current) setLoading(false);
    }
  }, [apiBase, companyId, configured, recoveryToken, clearSession]);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    publicApi.request("/config").then((value) => {
      if (active) setConfig(value);
    }).catch(() => {});
    return () => { active = false; };
  }, [publicApi, configured]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !busy) refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [refresh, !!me, busy]);
  useEffect(() => {
    if (recoveryToken) return;
    const callback = readAuthCallback(window.location.hash);
    if (!callback) return;
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    if (callback.kind === "error") { setError(callback.message); return; }
    if (!configured) {
      setError("Your email link was received. Sign-in is temporarily unavailable; please try again later.");
      return;
    }
    publicApi.send("/auth/exchange", { access_token: callback.accessToken, refresh_token: callback.refreshToken })
      .then(() => refresh())
      .catch((e) => setError(e.message));
  }, [publicApi, configured, recoveryToken]);
  function exitRecovery() {
    const search = new URLSearchParams(window.location.search);
    search.delete("recovery");
    const query = search.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? "?" + query : ""));
    setRecoveryToken("");
  }
  async function act(operation: () => Promise<any>, success = "Changes saved") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      setModal(null);
      setNotice(success);
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401) clearSession();
    } finally {
      setBusy(false);
    }
  }
  async function formAction(
    event: React.FormEvent<HTMLFormElement>,
    callback: (f: FormData) => Promise<any>,
    success?: string,
  ) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await act(() => callback(fields), success);
  }
  async function signOut() {
    await act(async () => {
      await publicApi.send("/auth/logout");
      clearSession();
    }, "Signed out");
  }
  function go(next: Page) {
    if (!company || !canOpenWorkspacePage(company.role, next)) return;
    setPage(next);
    setMobile(false);
    setQuery("");
    setNotice("");
  }
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fa]">
        <div className="space-y-6 text-center">
          <Brand />
          <p className="text-xs text-zinc-400">Opening your workspace…</p>
        </div>
      </div>
    );
  if (!me)
    return (
      <SignIn
        api={publicApi}
        refresh={async () => {
          setLoading(true);
          setPage("Overview");
          setLocation("ALL");
          setQuery("");
          await refresh();
        }}
        configured={configured}
        recoveryToken={recoveryToken}
        inviteToken={inviteToken}
        apiBase={apiBase}
        onExitRecovery={exitRecovery}
        onRecoveryComplete={() => {
          clearSession();
          exitRecovery();
        }}
        shopUrl={shopUrl}
        development={config?.development}
        error={error}
        setError={setError}
      />
    );
  if (me.must_change_password) return <PasswordSetup api={publicApi} complete={refresh} signOut={signOut} />;
  if (!company)
    return (
      <div className="online-app grid min-h-screen place-items-center bg-[#f7f8fa] p-6">
        <div className="w-full max-w-md space-y-7 rounded-2xl border border-zinc-200 bg-white p-8">
          <Brand />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <ConnectionNotice />
          <h1 className="text-xl font-semibold">Your Honor access</h1>
          <p className="text-sm leading-6 text-zinc-500">
            Honor accounts are assigned by the business administrator. Accept your invitation below, or ask your administrator to assign your role and locations.
          </p>
          {new URLSearchParams(window.location.search).get("invite") && (
            <button
              disabled={busy}
              className="honor-button w-full"
              onClick={() =>
                act(
                  () =>
                    publicApi.send("/invitations/accept", {
                      token: new URLSearchParams(window.location.search).get(
                        "invite",
                      ),
                    }),
                  "Invitation accepted",
                )
              }
            >
              Accept company invitation
            </button>
          )}
          <button
            className="text-xs text-zinc-500"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  const balances = data.balances.filter(
    (b) => location === "ALL" || b.location_id === location,
  );
  const orders = data.orders.filter(
    (o) => location === "ALL" || o.location_id === location,
  );
  const movements = data.movements.filter(
    (m) => location === "ALL" || m.location_id === location,
  );
  const onHand = balances.reduce((n, b) => n + b.on_hand, 0);
  const reserved = balances.reduce((n, b) => n + b.reserved, 0);
  const available = onHand - reserved;
  const productBalance = (id: string) =>
    balances
      .filter((b) => b.product_id === id)
      .reduce(
        (s, b) => ({
          on_hand: s.on_hand + b.on_hand,
          reserved: s.reserved + b.reserved,
          available: s.available + b.available,
        }),
        { on_hand: 0, reserved: 0, available: 0 },
      );
  const low = data.products.filter(
    (p) => productBalance(p.id).available <= p.reorder_point,
  );
  const shown = data.products.filter((p) =>
    `${p.name} ${p.sku} ${p.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const productName = (id: string) =>
    data.products.find((p) => p.id === id)?.name || "Product";
  const locationName = (id: string) =>
    [...data.locations, ...data.destinations].find((l) => l.id === id)?.name ||
    "Location";
  const metric = (
    label: string,
    value: string | number,
    hint: string,
    Icon: any,
    warm = false,
  ) => (
    <div className="min-w-0 rounded-2xl border border-zinc-200/70 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-2 text-xs text-zinc-500">
        <span>{label}</span>
        <Icon
          size={16}
          className={`shrink-0 ${warm ? "text-amber-600" : "text-emerald-700"}`}
        />
      </div>
      <p className="mt-4 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">{hint}</p>
    </div>
  );
  const inventoryTable = (products: Product[]) => (
    <div className="overflow-x-auto">
      <table className="online-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>On hand</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Status</th>
            <th>Storefront</th>
            {privileged && <th />}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const s = productBalance(p.id);
            return (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0f3ee] text-emerald-800">
                      <Package size={18} strokeWidth={1.5} />
                    </span>
                    <span>
                      <span className="block font-medium text-zinc-800">
                        {p.name}
                      </span>
                      <span className="mt-1 block text-[10px] text-zinc-400">
                        {p.sku} ·{" "}
                        {p.tracking === "SERIAL"
                          ? "Serial tracked"
                          : p.category}
                      </span>
                    </span>
                  </div>
                </td>
                <td>{s.on_hand}</td>
                <td className="text-zinc-400">{s.reserved}</td>
                <td className="font-semibold">{s.available}</td>
                <td>
                  <Badge warning={s.available <= p.reorder_point}>
                    {s.available === 0
                      ? "Out of stock"
                      : s.available <= p.reorder_point
                        ? "Replenish"
                        : "Healthy"}
                  </Badge>
                </td>
                <td className="text-zinc-400">
                  {p.published ? "Published" : "Hidden"}
                </td>
                {privileged && (
                  <td>
                    <button
                      className="text-xs text-emerald-700"
                      onClick={() => setModal({ kind: "product", record: p })}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!products.length && (
        <Empty
          title={data.products.length ? "No matching products" : "No products yet"}
          text={data.products.length ? "Try another search or change your stock filter." : "Add your catalogue, then receive the stock you have checked."}
        />
      )}
    </div>
  );
  const navigation = (<>
        <div className="px-3">
          <Brand />
        </div>
        <div className="mt-10 px-3 text-[9px] uppercase tracking-[.18em] text-emerald-100/35">
          Your workspace
        </div>
        <nav aria-label="Staff navigation" className="mt-3 space-y-1">
          {pages
            .filter((p) => canOpenWorkspacePage(company.role, p.label))
            .map((p) => (
              <button
                key={p.label}
                onClick={() => go(p.label)}
                aria-current={page === p.label ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-xs ${page === p.label ? "bg-white/10 text-white" : "text-emerald-100/55 hover:bg-white/5 hover:text-white"}`}
              >
                <p.icon size={17} strokeWidth={1.6} />
                {p.label}
                {p.label === "Orders" &&
                  orders.some((o) => o.status === "PAID") && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
              </button>
            ))}
        </nav>
        <a
          href={"/shop/" + company.slug}
          target="_blank"
          rel="noreferrer"
          className="mt-7 flex items-center gap-3 rounded-lg border border-white/10 px-3 py-3 text-xs text-emerald-100/70"
        >
          <ExternalLink size={16} />
          Open your store
          <ArrowUpRight size={13} className="ml-auto" />
        </a>
        <div className="mt-7 rounded-xl border border-white/10 p-3">
          <p className="text-xs font-medium">{me.name}</p>
          <p className="mt-1 text-[10px] text-emerald-100/40">
            {company.role.toLowerCase()} · company access
          </p>
          <button
            disabled={busy}
            onClick={signOut}
            className="mt-4 flex items-center gap-2 text-[10px] text-emerald-100/60"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
  </>);
  return (
    <div className="online-app min-h-screen bg-[#f7f8fa] text-zinc-900">
      <ConnectionNotice />
      <aside aria-label="Staff workspace navigation" className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col overflow-y-auto bg-[#132b25] px-4 py-7 text-white md:flex">
        {navigation}
      </aside>
      {mobile && <Modal title="Navigation" onClose={() => setMobile(false)}><div className="rounded-xl bg-[#132b25] px-3 py-5 text-white">{navigation}</div></Modal>}

      <nav aria-label="Mobile staff navigation" className="honor-mobile-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-zinc-200 bg-white px-2 pt-1 md:hidden">
        {[{label: "Overview", icon: LayoutDashboard}, {label: "Inventory", icon: Boxes}, {label: "Orders", icon: ShoppingBag}].map(item => <button key={item.label} onClick={() => go(item.label as Page)} aria-current={page === item.label ? "page" : undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] ${page === item.label ? "bg-emerald-50 font-semibold text-emerald-800" : "text-zinc-600"}`}><item.icon size={19} />{item.label}</button>)}
        <button onClick={() => setMobile(true)} aria-expanded={mobile} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-zinc-600"><Menu size={19} />More</button>
      </nav>
      <div className="md:ml-[236px]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-zinc-200/70 bg-white px-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-50 md:hidden"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <select
              aria-label="Company"
              className="min-h-11 min-w-0 w-full max-w-48 truncate bg-transparent text-base font-semibold sm:text-sm"
              value={companyId}
              onChange={(e) => {
                ++version.current;
                setLoading(true);
                setModal(null);
                setEnrolment(null);
                setInvitationLink("");
                setCompanyId(e.target.value);
                setData(blank);
                setLocation("ALL");
                setPage("Overview");
              }}
            >
              {me.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="hidden h-4 w-px bg-zinc-200 sm:block" />
            <span className="hidden truncate text-xs text-zinc-400 lg:block">
              {page}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3">
            <label className="flex min-w-0 max-w-52 flex-1 items-center gap-2 text-xs text-zinc-500">
              <span className="hidden sm:inline">Location</span>
              <select
                aria-label="Stock location"
                className="min-h-11 min-w-0 w-full truncate rounded-lg border border-zinc-200 bg-white p-2 text-base sm:text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="ALL">All locations</option>
                {data.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Refresh workspace"
              onClick={() => refresh()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-50"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main className="honor-workspace-main mx-auto min-w-0 max-w-[1440px] p-4 sm:p-8 lg:p-10">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-400">
            <span className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${config?.development ? "bg-amber-500" : "bg-emerald-500"}`}
              />
              {config?.development
                ? "Local development environment"
                : "Shared company workspace"}
            </span>
            <span>{lastSynced ? `Last synced ${lastSynced.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}` : "Loading company records"}</span>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-6 text-red-800"
            >
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
            >
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {invitationLink && config?.development && (
            <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs">
              <a className="text-amber-900 underline" href={invitationLink}>
                Open development invitation
              </a>
              <p className="mt-2 text-amber-800">
                Sign in with the invited email. This link does not confirm email
                delivery.
              </p>
            </div>
          )}
          {new URLSearchParams(window.location.search).has("invite") && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-emerald-50 p-4 text-xs">
              <span>You have a company invitation to accept.</span>
              <button
                className="text-emerald-800 underline"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const result = await publicApi.send("/invitations/accept", {
                      token: new URLSearchParams(window.location.search).get(
                        "invite",
                      ),
                    });
                    window.history.replaceState(
                      {},
                      "",
                      window.location.pathname,
                    );
                    setCompanyId(result.company_id);
                  }, "Invitation accepted")
                }
              >
                Accept invitation
              </button>
            </div>
          )}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-emerald-700">
                {page === "Overview"
                  ? "A clear view of your stock"
                  : "Company workspace"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
                {page === "Overview" ? "Inventory overview" : page}
              </h1>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-zinc-500">
                {
                  {
                    Overview:
                      "Know what is available, what needs attention and what is ready to move.",
                    Inventory:
                      "Your catalogue and available stock across permitted locations.",
                    "Receive stock":
                      "Check the goods in front of you, then record what actually arrived.",
                    Transfers:
                      "Dispatch from one location. Receive when the goods arrive at the other.",
                    Orders:
                      "Online orders, verified payments and stock ready for collection.",
                    "People & access":
                      "Give each person the access they need. Your company stays in control.",
                    Activity:
                      "A traceable record of the stock that moved and the people who changed it.",
                    Security:
                      "Manage your password, authenticator and sensitive-action verification.",
                    Company:
                      "Manage your company locations and see outstanding delivery jobs.",
                  }[page]
                }
              </p>
            </div>
            {stockStaff && ["Overview", "Inventory"].includes(page) && (
              <div className="flex gap-2">
                {privileged && (
                  <button
                    className="online-secondary"
                    onClick={() => setModal({ kind: "product" })}
                  >
                    <Plus size={14} />
                    Add product
                  </button>
                )}
                <button
                  className="honor-button"
                  onClick={() => go("Receive stock")}
                >
                  <Plus size={15} />
                  Receive stock
                </button>
              </div>
            )}
            {page === "People & access" && company.role === "ADMIN" && (
              <button
                className="honor-button"
                onClick={() => setModal({ kind: "invite" })}
              >
                <Plus size={15} />
                Add staff
              </button>
            )}
            {page === "Transfers" && stockStaff && (
              <button
                className="honor-button"
                onClick={() => setModal({ kind: "transfer" })}
              >
                <Plus size={15} />
                Dispatch transfer
              </button>
            )}
          </div>
          {page === "Overview" && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {metric(
                  "Available units",
                  available.toLocaleString(),
                  `${onHand} on hand · ${reserved} reserved`,
                  Boxes,
                )}
                {metric(
                  "Products to replenish",
                  low.length,
                  "At or below their reorder point",
                  ArrowDownToLine,
                  low.length > 0,
                )}
                {metric(
                  "Ready to fulfil",
                  orders.filter((o) => o.status === "PAID").length,
                  "Paid orders with allocated stock",
                  ShoppingBag,
                )}
                {metric(
                  "Incoming transfers",
                  data.transfers.filter(
                    (t) =>
                      t.status === "DISPATCHED" &&
                      (location === "ALL" || t.destination_id === location),
                  ).length,
                  "Receive after checking delivery",
                  Truck,
                )}
              </div>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                <section className="online-panel min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
                    <div>
                      <h2 className="text-sm font-semibold">
                        Available inventory
                      </h2>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Products and available quantities at your permitted locations.
                      </p>
                    </div>
                    <button
                      className="text-xs text-emerald-700"
                      onClick={() => go("Inventory")}
                    >
                      View inventory
                      <ArrowRight size={13} className="ml-1 inline" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 sm:px-6">
                    <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-200 px-3">
                      <Search size={16} className="shrink-0 text-zinc-400" />
                      <input aria-label="Search dashboard inventory" placeholder="Product or SKU" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 w-full bg-transparent py-2 text-base sm:text-sm" />
                      {query && <button aria-label="Clear inventory search" onClick={() => setQuery("")} className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={16} /></button>}
                    </label>
                    <button className="online-secondary min-h-11" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(!attentionOnly)}>{attentionOnly ? "Show all stock" : `Needs attention (${low.length})`}</button>
                  </div>
                  {inventoryTable(attentionOnly ? shown.filter(p => productBalance(p.id).available <= p.reorder_point) : shown)}
                </section>
                <section className="online-panel p-6">
                  <p className="text-sm font-semibold">Today's operations</p>
                  <div className="mt-6 space-y-6">
                    {[
                      {
                        label: "Record a delivery",
                        sub: "Receive stock you have checked",
                        icon: ArrowDownToLine,
                        page: "Receive stock" as Page,
                        allowed: stockStaff,
                      },
                      {
                        label: "Prepare customer orders",
                        sub: "Review payment and fulfilment",
                        icon: ShoppingBag,
                        page: "Orders" as Page,
                        allowed: true,
                      },
                      {
                        label: "Check stock movements",
                        sub: "Follow the complete history",
                        icon: Activity,
                        page: "Activity" as Page,
                        allowed: true,
                      },
                    ]
                      .filter((x) => x.allowed)
                      .map((x) => (
                        <button
                          key={x.label}
                          onClick={() => go(x.page)}
                          className="flex w-full items-start gap-3 text-left"
                        >
                          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                            <x.icon size={16} />
                          </span>
                          <span>
                            <span className="block text-xs font-medium">
                              {x.label}
                            </span>
                            <span className="mt-1 block text-[10px] leading-5 text-zinc-400">
                              {x.sub}
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                  <div className="mt-8 border-t border-zinc-100 pt-5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Replenishment
                    </p>
                    <p className="mt-3 text-xs leading-6 text-zinc-500">
                      Current alerts use your reorder points. Forecasting will
                      be introduced after there is enough sales history to
                      evaluate it.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "Inventory" && (
            <section className="online-panel">
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
                <span className="text-xs font-medium">
                  {data.products.length} products
                </span>
                <label className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                  <Search size={14} className="text-zinc-400" />
                  <input
                    aria-label="Search inventory"
                    placeholder="Search name or SKU"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-w-0 w-full bg-transparent text-base sm:text-sm"
                  />
                </label>
                {privileged && (
                  <button
                    className="text-xs text-emerald-700"
                    onClick={() => setModal({ kind: "adjustment" })}
                  >
                    Record an adjustment
                  </button>
                )}
              </div>
              {stockStaff && <SerialLookup key={company.id} api={api} />}
              {inventoryTable(shown)}
            </section>
          )}
          {page === "Receive stock" &&
            (stockStaff ? (
              <section className="online-panel max-w-2xl p-6 sm:p-8">
                <OperationForm
                  kind="receipt"
                  data={data}
                  busy={busy}
                  onSubmit={(e) =>
                    formAction(
                      e,
                      (f) => api.command("/receipts", stockBody(f)),
                      "Stock received and movement recorded",
                    )
                  }
                />
              </section>
            ) : (
              <Empty
                title="This action is restricted"
                text="Your administrator controls stock-receiving access."
              />
            ))}
          {page === "Transfers" && (
            <section className="online-panel">
              <div className="overflow-x-auto">
                <table className="online-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Route</th>
                      <th>Units</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.transfers.map((t) => (
                      <tr key={t.id}>
                        <td className="font-medium">
                          {productName(t.product_id)}
                        </td>
                        <td>
                          {locationName(t.source_id)} →{" "}
                          {locationName(t.destination_id)}
                        </td>
                        <td>{t.quantity}</td>
                        <td>
                          <Badge warning={t.status === "DISPATCHED"}>
                            {t.status === "DISPATCHED"
                              ? "In transit"
                              : "Received"}
                          </Badge>
                        </td>
                        <td>
                          {stockStaff &&
                            t.status === "DISPATCHED" &&
                            data.locations.some(
                              (l) => l.id === t.destination_id,
                            ) && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  act(
                                    () =>
                                      api.command(`/transfers/${t.id}/receive`),
                                    "Transfer received",
                                  )
                                }
                                className="text-emerald-700"
                              >
                                Receive all units
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.transfers.length && (
                <Empty
                  title="No transfers yet"
                  text="Dispatched goods stay in transit until the destination records receipt."
                />
              )}
            </section>
          )}
          {page === "Orders" && (
            <div className="space-y-4">
              {orders.map((o) => (
                <section key={o.id} className="online-panel p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-400">
                        {o.id.slice(0, 8).toUpperCase()} ·{" "}
                        {new Date(o.created_at).toLocaleString()}
                      </p>
                      <h2 className="mt-2 text-sm font-semibold">
                        {o.customer_name}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        {o.email} · {locationName(o.location_id!)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        warning={["EXCEPTION", "EXPIRED", "CANCELLED"].includes(
                          o.status,
                        )}
                      >
                        {o.status.replaceAll("_", " ")}
                      </Badge>
                      <p className="mt-3 text-sm font-semibold">
                        {money(o.total_minor, o.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-zinc-100 pt-4">
                    {o.lines.map((l) => (
                      <p
                        key={l.product_id}
                        className="text-xs leading-7 text-zinc-500"
                      >
                        {l.quantity} × {l.name}
                        {l.returned_quantity
                          ? ` · ${l.returned_quantity} returned`
                          : ""}
                      </p>
                    ))}
                    {o.serials?.length ? (
                      <p className="mt-2 text-[10px] text-zinc-400">
                        Serials: {o.serials.map((s) => s.serial).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`text-[10px] ${o.payment_status === "REFUND_REQUIRED" ? "text-amber-800" : "text-zinc-400"}`}
                    >
                      Payment: {o.payment_status.replaceAll("_", " ")}
                      {o.payment_status === "REFUND_REQUIRED" &&
                        " · Review with the merchant provider; no automatic refund has been issued."}
                    </span>
                    {o.status === "PAID" && (
                      <HandoverForm
                        order={o}
                        products={data.products}
                        busy={busy}
                        onSubmit={(devices) =>
                          act(
                            () =>
                              api.command(`/orders/${o.id}/fulfil`, {
                                devices,
                              }),
                            "Handover confirmed; exact devices and stock issue recorded",
                          )
                        }
                      />
                    )}
                    {o.receipt_ready && (
                      <button
                        className="online-secondary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api.download(
                                `/orders/${o.id}/receipt.pdf`,
                                `honor-receipt-${o.id}.pdf`,
                              ),
                            "Receipt downloaded",
                          )
                        }
                      >
                        Download receipt (PDF)
                      </button>
                    )}
                    {o.status === "FULFILLED" && privileged && (
                      <button
                        className="online-secondary"
                        onClick={() => setModal({ kind: "return", record: o })}
                      >
                        Record inspected return
                      </button>
                    )}
                  </div>
                </section>
              ))}
              {!orders.length && (
                <section className="online-panel">
                  <Empty
                    title="Ready for your first order"
                    text="Orders from your online store will appear here with their payment and stock status."
                  />
                </section>
              )}
            </div>
          )}
          {page === "People & access" && company.role === "ADMIN" && (
            <section className="online-panel">
              <div className="overflow-x-auto">
                <table className="online-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Access</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <p className="font-medium">
                            {m.name}
                            {m.id === me.id ? " (you)" : ""}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-400">
                            {m.email}
                          </p>
                        </td>
                        <td>{m.role.toLowerCase()}</td>
                        <td>
                          {m.role === "ADMIN"
                            ? "All company locations"
                            : m.location_ids.map(locationName).join(", ")}
                        </td>
                        <td>
                          <Badge warning={!m.active}>
                            {m.active ? "Active" : "Suspended"}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-3">
                            <button
                              className="text-emerald-700"
                              onClick={() =>
                                setModal({ kind: "member", record: m })
                              }
                            >
                              Edit access
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  () => api.send(`/team/${m.id}/sign-out`),
                                  "Person signed out of this company",
                                )
                              }
                              className="text-zinc-500"
                            >
                              Sign out
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  () => api.send(`/team/${m.id}/recover`),
                                  "Password recovery requested",
                                )
                              }
                              className="text-zinc-500"
                            >
                              Reset password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-zinc-100 p-6 text-xs leading-6 text-zinc-500">
                Access changes require recent password verification. Production
                administrators also verify an authenticator code in Security.
                Password resets send recovery instructions; existing passwords
                are never visible.
              </p>
            </section>
          )}
          {page === "Activity" && (
            <div className="space-y-6">
              <section className="online-panel">
                <div className="px-6 py-5 text-sm font-semibold">
                  Stock movements
                </div>
                <div className="overflow-x-auto">
                  <table className="online-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Product</th>
                        <th>Location</th>
                        <th>Change</th>
                        <th>Movement</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap text-zinc-400">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                          <td>{productName(m.product_id)}</td>
                          <td>{locationName(m.location_id)}</td>
                          <td
                            className={
                              m.delta > 0 ? "text-emerald-700" : "text-zinc-700"
                            }
                          >
                            {m.delta > 0 ? "+" : ""}
                            {m.delta}
                          </td>
                          <td>{m.kind.replaceAll("_", " ").toLowerCase()}</td>
                          <td className="max-w-64 text-zinc-400">
                            {m.reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!movements.length && (
                  <Empty
                    title="Your stock history starts here"
                    text="Every posted receipt, transfer, sale and return creates a movement."
                  />
                )}
              </section>
              {company.role === "ADMIN" && (
                <section className="online-panel p-6">
                  <h2 className="text-sm font-semibold">Company audit trail</h2>
                  <div className="mt-4 divide-y divide-zinc-100">
                    {data.audit.slice(0, 30).map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap justify-between gap-2 py-3 text-xs"
                      >
                        <span>
                          {a.action.replaceAll(".", " · ").replaceAll("_", " ")}
                        </span>
                        <span className="text-zinc-400">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {page === "Security" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="online-panel p-6">
                <h2 className="text-sm font-semibold">Change your email</h2>
                <p className="mt-3 text-xs leading-6 text-zinc-500">Current email: {me.email}. Confirm the change from your inboxes. Your staff ID and activity stay linked; administrators receive an account update without your password.</p>
                <form className="mt-6 space-y-5" onSubmit={e => formAction(e, async f => {
                  const result = await publicApi.send("/auth/email", Object.fromEntries(f));
                  setNotice(result.message);
                  return result;
                }, "Email change requested. Check your current and new inboxes.")}>
                  <Field label="New email address"><input required type="email" name="email" autoComplete="email" maxLength={254} className="online-input" /></Field>
                  <Field label="Current password"><input required type="password" name="current_password" autoComplete="current-password" maxLength={256} className="online-input" /></Field>
                  <button disabled={busy} className="honor-button">Request email change</button>
                </form>
              </section>
              <section className="online-panel p-6">
                <h2 className="text-sm font-semibold">Change your password</h2>
                <form
                  className="mt-6 space-y-5"
                  onSubmit={(e) =>
                    formAction(
                      e,
                      (f) =>
                        publicApi.send("/auth/password", Object.fromEntries(f)),
                      "Password changed; your other Honor sessions are signed out",
                    )
                  }
                >
                  <Field label="Current password">
                    <input
                      required
                      type="password"
                      name="current_password"
                      autoComplete="current-password"
                      className="online-input"
                    />
                  </Field>
                  <Field label="New password · at least 12 characters">
                    <input
                      required
                      minLength={12}
                      maxLength={256}
                      type="password"
                      name="new_password"
                      autoComplete="new-password"
                      className="online-input"
                    />
                  </Field>
                  <button disabled={busy} className="honor-button">
                    Change password
                  </button>
                </form>
              </section>
              <section className="online-panel p-6">
                <h2 className="text-sm font-semibold">
                  Verify sensitive actions
                </h2>
                <p className="mt-3 text-xs leading-6 text-zinc-500">
                  Re-enter your password before changing team access.
                  Verification lasts five minutes.
                </p>
                <form
                  className="mt-5 space-y-4"
                  onSubmit={(e) =>
                    formAction(
                      e,
                      (f) =>
                        publicApi.send("/auth/reauthenticate", {
                          email: me.email,
                          password: f.get("password"),
                        }),
                      "Password verified for sensitive actions",
                    )
                  }
                >
                  <Field label="Your current password">
                    <input
                      required
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      className="online-input"
                    />
                  </Field>
                  <button disabled={busy} className="online-secondary">
                    Verify password
                  </button>
                </form>
                <div className="mt-7 border-t border-zinc-100 pt-6">
                  <h3 className="text-sm font-semibold">Authenticator</h3>
                  {config?.development ? (
                    <p className="mt-3 text-xs leading-6 text-zinc-500">
                      Authenticator verification is enforced for administrators
                      when managed identity is enabled in production.
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 text-xs leading-6 text-zinc-500">
                        {me.mfa
                          ? "Authenticator verified for this session."
                          : "Verify a code before changing company access."}
                      </p>
                      {!me.factors?.some((f) => f.status === "verified") &&
                        !enrolment && (
                          <button
                            className="online-secondary mt-4"
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                const result =
                                  await publicApi.send("/auth/mfa/enrol");
                                setEnrolment(result);
                              }, "Scan the authenticator code, then verify")
                            }
                          >
                            Set up authenticator
                          </button>
                        )}
                      {enrolment && (
                        <div className="mt-4">
                          <img
                            alt="Scan with your authenticator app"
                            className="h-40 w-40"
                            src={
                              "data:image/svg+xml," +
                              encodeURIComponent(enrolment.totp?.qr_code || "")
                            }
                          />
                          <p className="mt-2 break-all text-xs text-zinc-500">
                            Manual key: {enrolment.totp?.secret}
                          </p>
                        </div>
                      )}
                      <form
                        className="mt-4 space-y-4"
                        onSubmit={(e) =>
                          formAction(
                            e,
                            (f) =>
                              publicApi.send("/auth/mfa/verify", {
                                factor_id:
                                  enrolment?.id ||
                                  me.factors.find(
                                    (f) => f.status === "verified",
                                  )?.id,
                                code: f.get("code"),
                              }),
                            "Authenticator verified",
                          )
                        }
                      >
                        <Field label="Six-digit code">
                          <input
                            required
                            name="code"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            autoComplete="one-time-code"
                            className="online-input"
                          />
                        </Field>
                        <button disabled={busy} className="honor-button">
                          Verify authenticator
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
          {page === "Company" && company.role === "ADMIN" && (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="online-panel p-6">
                <h2 className="text-sm font-semibold">Company locations</h2>
                <div className="mt-5 space-y-3">
                  {data.locations.map((l) => (
                    <p key={l.id} className="rounded-lg bg-zinc-50 p-3 text-xs">
                      {l.name}
                      {l.fulfil_online && (
                        <span className="mt-1 block text-[10px] text-emerald-700">
                          Online collection · {l.address}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(e) =>
                    formAction(
                      e,
                      (f) =>
                        api.send("/locations", {
                          name: f.get("name"),
                          address: f.get("address"),
                          fulfil_online: f.get("fulfil_online") === "on",
                        }),
                      "Location added",
                    )
                  }
                >
                  <Field label="New location name">
                    <input
                      required
                      name="name"
                      minLength={2}
                      maxLength={100}
                      className="online-input"
                    />
                  </Field>
                  <Field label="Collection address (required for online collection)">
                    <textarea
                      name="address"
                      maxLength={300}
                      className="online-input"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="fulfil_online" />
                    Use this location for online collection
                  </label>
                  <button disabled={busy} className="honor-button">
                    <Plus size={14} />
                    Add location
                  </button>
                </form>
                <p className="mt-6 text-xs leading-6 text-zinc-500">
                  Currency: {company.currency} · Timezone: {company.timezone}.
                  Your storefront is{" "}
                  <a
                    className="text-emerald-700 underline"
                    href={"/shop/" + company.slug}
                  >
                    available here
                  </a>
                  .
                </p>
              </section>
              <section className="online-panel p-6">
                <h2 className="text-sm font-semibold">Delivery jobs</h2>
                <p className="mt-3 text-xs leading-6 text-zinc-500">
                  Queued emails and payment events stay visible until processing
                  completes. Queued does not mean delivered.
                </p>
                <div className="mt-5 space-y-3">
                  {data.jobs.slice(0, 12).map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 text-xs"
                    >
                      <span>
                        {j.kind.replaceAll("_", " ").toLowerCase()}
                        <span className="mt-1 block text-[10px] text-zinc-400">
                          {j.attempts} attempts
                          {j.last_error ? " · Needs review" : ""}
                        </span>
                      </span>
                      <Badge warning={j.status !== "DONE"}>{j.status}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          title={
            {
              product: modal.record ? "Edit product" : "Add a product",
              transfer: "Dispatch a transfer",
              adjustment: "Record an adjustment",
              return: "Record an inspected return",
              invite: "Assign staff access",
              member: "Edit company access",
            }[modal.kind] || "Stock operation"
          }
          onClose={() => !busy && setModal(null)}
        >
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-700"
            >
              {error}
            </p>
          )}
          {modal.kind === "product" ? (
            <ProductForm
              product={modal.record}
              busy={busy}
              onSubmit={(e) =>
                formAction(
                  e,
                  (f) =>
                    api.send(
                      modal.record
                        ? `/products/${modal.record.id}`
                        : "/products",
                      {
                        sku: f.get("sku"),
                        name: f.get("name"),
                        description: f.get("description"),
                        category: f.get("category"),
                        tracking: f.get("tracking"),
                        price_minor: Math.round(Number(f.get("price")) * 100),
                        cost_minor: Math.round(Number(f.get("cost")) * 100),
                        reorder_point: Number(f.get("reorder")),
                        published: f.get("published") === "on",
                        image_url: f.get("image"),
                      },
                      modal.record ? "PUT" : "POST",
                    ),
                  "Product saved",
                )
              }
            />
          ) : ["invite", "member"].includes(modal.kind) ? (
            <MemberForm
              member={modal.record}
              locations={data.locations}
              busy={busy}
              onSubmit={(e) =>
                formAction(
                  e,
                  async (f) => {
                    const body = {
                      role: f.get("role"),
                      active: f.get("active") === "on",
                      location_ids: f.getAll("location_ids"),
                    };
                    if (modal.kind === "member")
                      return api.send(
                        `/team/${modal.record.id}`,
                        body,
                        "PATCH",
                      );
                    const temporary = f.get("account_method") === "password";
                    const result = await api.send(temporary ? "/team" : "/invitations", {
                      ...body,
                      email: f.get("email"),
                      ...(temporary ? { name: f.get("name"), temporary_password: f.get("temporary_password") } : {}),
                    });
                    if (result.development_link)
                      setInvitationLink(result.development_link);
                    return result;
                  },
                  modal.kind === "invite"
                    ? "Staff access saved. Any verification or invitation email is queued for delivery."
                    : "Company access updated",
                )
              }
            />
          ) : (
            <OperationForm
              kind={modal.kind}
              record={modal.record}
              data={data}
              busy={busy}
              onSubmit={(e) =>
                formAction(
                  e,
                  (f) => {
                    if (modal.kind === "adjustment")
                      return api.command("/adjustments", {
                        product_id: f.get("product_id"),
                        location_id: f.get("location_id"),
                        delta: Number(f.get("quantity")),
                        reason: f.get("reason"),
                      });
                    if (modal.kind === "return")
                      return api.command(`/orders/${modal.record.id}/returns`, {
                        ...stockBody(f),
                        location_id: modal.record.location_id,
                        restock: f.get("restock") === "on",
                      });
                    return api.command("/transfers", {
                      ...stockBody(f),
                      destination_id: f.get("destination_id"),
                    });
                  },
                  modal.kind === "transfer"
                    ? "Transfer dispatched; awaiting destination receipt"
                    : modal.kind === "return"
                      ? "Inspected return recorded; refund is a separate payment action"
                      : "Adjustment posted with its reason",
                )
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function stockBody(f: FormData) {
  return {
    product_id: f.get("product_id"),
    location_id: f.get("location_id"),
    quantity: Number(f.get("quantity")),
    reason: f.get("reason"),
    serials: String(f.get("serials") || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
function OperationForm({
  kind,
  record,
  data,
  busy,
  onSubmit,
}: {
  kind: string;
  record?: any;
  data: Bundle;
  busy: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const products =
    kind === "return"
      ? data.products.filter((p) =>
          record.lines.some(
            (l: any) =>
              l.product_id === p.id && l.quantity > l.returned_quantity,
          ),
        )
      : kind === "adjustment"
        ? data.products.filter((p) => p.tracking === "QUANTITY")
        : data.products;
  const [productId, setProductId] = useState(products[0]?.id || "");
  const p = products.find((x) => x.id === productId) || products[0];
  if (!products.length || !data.locations.length)
    return (
      <Empty
        title="Add your catalogue and locations first"
        text="Your administrator can add locations in Company and products in Inventory."
      />
    );
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field label="Product">
        <select
          name="product_id"
          value={p?.id}
          onChange={(e) => setProductId(e.target.value)}
          className="online-input"
        >
          {products.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.sku}
            </option>
          ))}
        </select>
      </Field>
      {kind !== "return" && (
        <Field label={kind === "transfer" ? "From location" : "Location"}>
          <select name="location_id" className="online-input">
            {data.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {kind === "transfer" && (
        <Field label="To location">
          <select name="destination_id" className="online-input">
            {data.destinations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field
        label={
          kind === "adjustment"
            ? "Quantity change · negative to reduce stock"
            : "Quantity physically checked"
        }
      >
        <input
          required
          name="quantity"
          type="number"
          step="1"
          min={kind === "adjustment" ? -1000000 : 1}
          max={1000000}
          defaultValue={1}
          className="online-input"
        />
      </Field>
      {p?.tracking === "SERIAL" && (
        <Field label="Serials / IMEIs · one per line">
          <textarea
            required
            name="serials"
            rows={4}
            maxLength={101000}
            className="online-input"
            placeholder="Enter each serial you have checked"
          />
        </Field>
      )}
      <Field
        label={
          kind === "return"
            ? "Inspection result and reason"
            : "Reference / reason"
        }
      >
        <textarea
          required
          name="reason"
          minLength={5}
          maxLength={300}
          rows={3}
          className="online-input"
          placeholder={
            kind === "receipt"
              ? "Supplier delivery or opening-stock reference"
              : "Explain this movement"
          }
        />
      </Field>
      {kind === "return" && (
        <label className="flex items-start gap-3 text-xs leading-6 text-zinc-600">
          <input
            type="checkbox"
            name="restock"
            defaultChecked
            className="mt-1"
          />
          Inspected and fit for resale. Uncheck to quarantine the returned
          device.
        </label>
      )}
      <button disabled={busy} className="honor-button w-full">
        {busy
          ? "Recording…"
          : kind === "receipt"
            ? "Receive & record stock"
            : kind === "transfer"
              ? "Dispatch transfer"
              : kind === "return"
                ? "Record inspected return"
                : "Post adjustment"}
        <ArrowRight size={15} />
      </button>
      <p className="text-[10px] leading-5 text-zinc-400">
        This records a company stock operation. Check quantities and references
        before submitting.
      </p>
    </form>
  );
}

function ProductForm({
  product: p,
  busy,
  onSubmit,
}: {
  product?: Product;
  busy: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <Field label="Product name">
        <input
          required
          name="name"
          minLength={2}
          maxLength={160}
          defaultValue={p?.name}
          className="online-input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU">
          <input
            required
            name="sku"
            maxLength={80}
            defaultValue={p?.sku}
            className="online-input"
          />
        </Field>
        <Field label="Category">
          <input
            required
            name="category"
            maxLength={80}
            defaultValue={p?.category || "General"}
            className="online-input"
          />
        </Field>
      </div>
      <Field label="Tracking">
        <select
          name="tracking"
          defaultValue={p?.tracking || "QUANTITY"}
          className="online-input"
        >
          <option value="QUANTITY">Quantity</option>
          <option value="SERIAL">Individual serial / IMEI</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Selling price">
          <input
            required
            name="price"
            type="number"
            min="0"
            step="0.01"
            max="20000000"
            defaultValue={p ? p.price_minor / 100 : ""}
            className="online-input"
          />
        </Field>
        <Field label="Unit cost">
          <input
            required
            name="cost"
            type="number"
            min="0"
            step="0.01"
            max="20000000"
            defaultValue={p ? (p.cost_minor || 0) / 100 : 0}
            className="online-input"
          />
        </Field>
      </div>
      <Field label="Reorder point">
        <input
          required
          name="reorder"
          type="number"
          min="0"
          max="1000000"
          step="1"
          defaultValue={p?.reorder_point ?? 5}
          className="online-input"
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          maxLength={3000}
          defaultValue={p?.description}
          className="online-input"
        />
      </Field>
      <Field label="Product image · HTTPS address (optional)">
        <input
          name="image"
          type="url"
          maxLength={2000}
          defaultValue={p?.image_url}
          className="online-input"
        />
      </Field>
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input name="published" type="checkbox" defaultChecked={p?.published} />
        Publish in the customer store
      </label>
      <button disabled={busy} className="honor-button w-full">
        {busy ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
function MemberForm({
  member,
  locations,
  busy,
  onSubmit,
}: {
  member?: any;
  locations: Location[];
  busy: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [method, setMethod] = useState("invitation");
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {!member && <>
        <Field label="Account setup"><select name="account_method" value={method} onChange={e => setMethod(e.target.value)} className="online-input"><option value="invitation">Send a private invitation</option><option value="password">Create with a temporary password</option></select></Field>
        {method === "password" && <>
          <Field label="Staff name"><input required name="name" autoComplete="off" maxLength={120} className="online-input" /></Field>
          <Field label="Temporary password"><input required name="temporary_password" type="password" autoComplete="new-password" minLength={12} maxLength={256} className="online-input" /></Field>
          <p className="text-xs leading-6 text-zinc-500">Share this temporary password privately. Staff must replace it before accessing records. It cannot be retrieved later.</p>
        </>}
      </>}
      {!member && (
        <Field label="Person's email">
          <input
            required
            type="email"
            name="email"
            maxLength={254}
            className="online-input"
          />
        </Field>
      )}
      <Field label="Company role">
        <select
          name="role"
          defaultValue={member?.role || "STOCK"}
          className="online-input"
        >
          <option value="ADMIN">Company administrator</option>
          <option value="MANAGER">Branch manager</option>
          <option value="STOCK">Stock operator</option>
          <option value="SALES">Sales staff</option>
        </select>
      </Field>
      <fieldset>
        <legend className="mb-3 text-xs font-medium text-zinc-600">
          Permitted locations · administrators can access all
        </legend>
        <div className="space-y-3">
          {locations.map((l) => (
            <label key={l.id} className="flex items-center gap-3 text-xs">
              <input
                type="checkbox"
                name="location_ids"
                value={l.id}
                defaultChecked={member?.location_ids.includes(l.id)}
              />
              {l.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3 text-xs">
        <input
          type="checkbox"
          name="active"
          defaultChecked={member?.active ?? true}
        />
        Active access
      </label>
      <button disabled={busy} className="honor-button w-full">
        {busy ? "Saving…" : member ? "Update access" : method === "password" ? "Create staff account" : "Send invitation"}
      </button>
      <p className="text-[10px] leading-6 text-zinc-400">
        Staff choose their private password. Suspension blocks company access
        and preserves their historical activity.
      </p>
    </form>
  );
}
function SignIn({
  api,
  refresh,
  configured,
  recoveryToken,
  inviteToken,
  apiBase,
  onExitRecovery,
  onRecoveryComplete,
  shopUrl,
  development,
  error,
  setError,
}: {
  api: ReturnType<typeof client>;
  refresh: () => Promise<void>;
  configured: boolean;
  recoveryToken: string;
  inviteToken: string;
  apiBase: string;
  onExitRecovery: () => void;
  onRecoveryComplete: () => void;
  shopUrl?: string;
  development?: boolean;
  error: string;
  setError: (e: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "activate" | "recover" | "reset">(
    recoveryToken ? "reset" : "login",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const pending = useAuthSubmission(apiBase, configured, mode);
  useEffect(() => { setShowPassword(false); }, [mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    await pending.submit(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        const result = await api.send("/auth/recovery-password", {
          token_hash: recoveryToken,
          new_password: values.password,
        });
        setMessage(result.message);
        onRecoveryComplete();
        setMode("login");
      } else if (mode === "login") {
        await api.send("/auth/login", values);
        await refresh();
      } else {
        const result = await api.send(
          mode === "activate" ? "/auth/activate-invitation" : "/auth/recover",
          mode === "activate" ? { ...values, token: inviteToken } : values,
        );
        setMessage(result.message);
        if (mode === "activate") setMode("login");
      }
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
    });
  }
  return (
    <div className="online-app grid min-h-screen bg-[#f6f8f5] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#132b25] p-16 text-white lg:flex">
        <Brand />
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] text-emerald-200/50">
            A little more clarity. Every day.
          </p>
          <h1 className="mt-6 max-w-lg text-5xl font-medium leading-[1.2] tracking-tight">
            Your inventory.
            <br />
            Every movement.
            <br />
            <span className="text-[#a7c7a0]">All in order.</span>
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-emerald-100/50">
            A shared workspace for the people, products and decisions that keep
            your business moving.
          </p>
        </div>
        <p className="text-[10px] text-emerald-100/35">
          Company-controlled access · Traceable stock · Connected orders
        </p>
      </section>
      <section className="honor-staff-entry flex items-center justify-center px-5 py-7 sm:p-12">
        <div className="honor-auth w-full max-w-sm">
          {shopUrl && (
            <a href={shopUrl} className="honor-text-button mb-8">
              <ArrowLeft size={15} /> Back to shop
            </a>
          )}
          <div className="mb-7 lg:hidden">
            <Brand />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">
            Honor · Staff &amp; administration
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {mode === "activate"
              ? "Activate your staff access"
              : mode === "recover"
                ? "Recover your access."
                : mode === "reset"
                  ? "Choose a new password."
                  : "Staff sign-in"}
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-500">
            {mode === "activate"
              ? "Use the email your administrator invited and choose your private password."
              : mode === "recover"
                ? "Enter your staff email to receive password recovery instructions."
                : mode === "reset"
                  ? "Choose a new password for your staff account."
                  : "Sign in with the account assigned by your Honor administrator."}
          </p>
          <ConnectionNotice />
          {!configured && (
            <p
              role="status"
              id="workspace-setup-status"
              className="honor-auth-status mt-4"
            >
              Sign-in is temporarily unavailable. You can enter your details, but they will only be submitted when the service is available.
            </p>
          )}
          {development && (
            <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              Development workspace. Use the account created during local setup.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-5 rounded-lg bg-emerald-50 p-3 text-xs leading-6 text-emerald-800"
            >
              {message}
            </p>
          )}
          {inviteToken && mode === "login" && <p className="honor-auth-status mt-4">You have an invitation. Sign in with your invited email, or activate your assigned account below.</p>}
          <form key={mode} onSubmit={submit} onChange={pending.cancel} className="mt-6 space-y-5" aria-describedby={!configured ? "workspace-setup-status" : undefined}>
            <fieldset disabled={busy} className="space-y-5">
            {mode === "activate" && (
              <Field label="Your name">
                <input
                  required
                  name="name"
                  minLength={1}
                  maxLength={120}
                  autoComplete="name"
                  className="online-input"
                />
              </Field>
            )}
            {mode !== "reset" && (
              <Field label="Email address">
                <input
                  required
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  className="online-input"
                />
              </Field>
            )}
            {mode !== "recover" && (
              <Field label={mode === "reset" ? "New password" : "Password"}>
                <div className="relative">
                <input
                  required
                  name="password"
                  aria-label={mode === "reset" ? "New password" : "Password"}
                  type={showPassword ? "text" : "password"}
                  maxLength={256}
                  minLength={mode === "activate" || mode === "reset" ? 12 : 1}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="online-input pr-12"
                />
                <button type="button" className="absolute right-2 top-2 p-2" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                </div>
              </Field>
            )}
            <button
              disabled={busy || pending.waiting}
              className="honor-button w-full"
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in to workspace"
                  : mode === "activate"
                    ? "Activate assigned account"
                    : mode === "reset"
                      ? "Reset password"
                      : "Send recovery email"}
              <ArrowRight size={15} />
            </button>
            </fieldset>
          </form>
          <SubmissionStatus {...pending} />
          <div className="honor-auth-links mt-4 flex flex-wrap justify-between gap-x-4 text-sm">
            {mode !== "login" && (
            <button
              className="text-emerald-700"
              onClick={() => {
                if (mode === "reset") onExitRecovery();
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              Back to staff sign-in
            </button>
            )}
            {mode === "login" && (
              <button
                className="text-emerald-700"
                onClick={() => {
                  setMode("recover");
                  setError("");
                  setMessage("");
                }}
              >
                Forgot password?
              </button>
            )}
            {mode === "login" && inviteToken && <button className="text-emerald-700" onClick={() => { setMode("activate"); setError(""); setMessage(""); }}>Activate assigned account</button>}
          </div>
          {mode === "login" && <p className="mt-4 text-xs leading-6 text-zinc-500">Need access? Ask your Honor administrator. Staff accounts cannot be created here.</p>}
        </div>
      </section>
    </div>
  );
}
