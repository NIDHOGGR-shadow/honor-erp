export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function client(base = "/api/v1", companyId = "") {
  async function request<T = any>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(base.replace(/\/$/, "") + path, {
        credentials: "include",
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(companyId ? { "X-Company-Id": companyId } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new ApiError(
        0,
        "Honor is unavailable right now. Please try again.",
      );
    }
    if (response.ok && response.status === 204) return undefined as T;
    const contentType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    const isJson = contentType === "application/json" ||
      (contentType?.startsWith("application/") && contentType.endsWith("+json"));
    let data: any;
    if (isJson) {
      try {
        data = await response.json();
      } catch {
        throw new ApiError(
          response.ok ? 502 : response.status,
          "Honor returned an unreadable response. Please try again.",
        );
      }
    }
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data?.detail === "string"
          ? data.detail
          : "We could not complete this request.",
      );
    if (!isJson)
      throw new ApiError(
        502,
        "Honor returned an unexpected response. Please try again.",
      );
    return data;
  }
  async function send<T = any>(
    path: string,
    body?: unknown,
    method = "POST",
    headers: Record<string, string> = {},
  ): Promise<T> {
    return request(path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function command<T = any>(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    // Retain the same key after a timeout, including a page reload. Store a hash, not form contents.
    const bytes = new TextEncoder().encode(
      JSON.stringify([base, companyId, path, body, headers]),
    );
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const slot = "honor:command:" + hash;
    const key = sessionStorage.getItem(slot) || crypto.randomUUID();
    sessionStorage.setItem(slot, key);
    const result = await send<T>(path, body, "POST", {
      ...headers,
      "Idempotency-Key": key,
    });
    sessionStorage.removeItem(slot);
    return result;
  }
  async function download(
    path: string,
    filename: string,
    headers: Record<string, string> = {},
  ) {
    let response: Response;
    try {
      response = await fetch(base.replace(/\/$/, "") + path, {
        credentials: "include",
        headers: {
          ...(companyId ? { "X-Company-Id": companyId } : {}),
          ...headers,
        },
      });
    } catch {
      throw new ApiError(
        0,
        "Honor is unavailable right now. Please try again.",
      );
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        typeof data.detail === "string"
          ? data.detail
          : "Receipt could not be downloaded.",
      );
    }
    if (!response.headers.get("Content-Type")?.includes("application/pdf"))
      throw new ApiError(
        503,
        "The receipt service returned an unexpected response.",
      );
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { request, send, command, download };
}

export type Company = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: string;
  timezone: string;
  storefront_content?: { heading?: string; introduction?: string; collection_heading?: string };
};
export type Me = {
  id: string;
  name: string;
  email: string;
  companies: Company[];
  mfa: boolean;
  factors: { id: string; status: string }[];
  must_change_password?: boolean;
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  model_name?: string;
  colour?: string;
  memory?: string;
  market?: string;
  source_url?: string;
  tracking: string;
  price_minor: number;
  cost_minor?: number;
  reorder_point: number;
  published: boolean;
  image_url: string;
};
export type Balance = {
  product_id: string;
  location_id: string;
  on_hand: number;
  reserved: number;
  available: number;
};
export type Location = {
  id: string;
  name: string;
  address?: string;
  fulfil_online?: boolean;
};
export type Order = {
  id: string;
  customer_name: string;
  email?: string;
  total_minor: number;
  currency: string;
  status: string;
  payment_status: string;
  location_id?: string;
  expires_at: string;
  created_at: string;
  paid_at?: string;
  fulfilled_at?: string;
  receipt_ready?: boolean;
  collection_location?: { name: string; address: string };
  lines: {
    product_id: string;
    name: string;
    quantity: number;
    price_minor: number;
    returned_quantity: number;
    sku?: string;
    serials?: string[];
  }[];
  serials?: { product_id: string; serial: string; status: string }[];
};
export type Catalogue = {
  recommendations?: { popular_product_ids: string[]; trending_product_ids: string[]; budget_product_ids: string[]; window_days: number };
  company: { name: string; slug: string; currency: string; storefront_content?: Company["storefront_content"] };
  products: (Pick<
    Product,
    | "id"
    | "sku"
    | "name"
    | "description"
    | "category"
    | "model_name"
    | "colour"
    | "memory"
    | "market"
    | "source_url"
    | "price_minor"
    | "image_url"
  > & { available: number; location_availability?: { location_id: string; available: number }[] })[];
  checkout_enabled: boolean;
  simulation: boolean;
  fulfilment: string;
  payment_methods?: string[];
  locations?: { id: string; name: string; address: string }[];
};
export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency,
    ...(currency === "NGN" ? { currencyDisplay: "narrowSymbol" as const } : {}),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
