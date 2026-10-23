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
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data.detail === "string"
          ? data.detail
          : "We could not complete this request.",
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
  return { request, send, command };
}

export type Company = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: string;
  timezone: string;
};
export type Me = {
  id: string;
  name: string;
  email: string;
  companies: Company[];
  mfa: boolean;
  factors: { id: string; status: string }[];
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
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
  collection_location?: { name: string; address: string };
  lines: {
    product_id: string;
    name: string;
    quantity: number;
    price_minor: number;
    returned_quantity: number;
  }[];
  serials?: { product_id: string; serial: string; status: string }[];
};
export type Catalogue = {
  company: { name: string; slug: string; currency: string };
  products: (Pick<
    Product,
    | "id"
    | "sku"
    | "name"
    | "description"
    | "category"
    | "price_minor"
    | "image_url"
  > & { available: number })[];
  checkout_enabled: boolean;
  simulation: boolean;
  fulfilment: string;
};
export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
