import { ApiError, client, type Balance, type Location, type Me, type Order, type Product } from "./api";

export type WorkspaceBundle = {
  locations: Location[];
  products: Product[];
  balances: Balance[];
  orders: Order[];
  movements: any[];
  transfers: any[];
  team: any[];
  audit: any[];
  jobs: any[];
  destinations: Location[];
};

export const blankWorkspace: WorkspaceBundle = {
  locations: [], products: [], balances: [], orders: [], movements: [],
  transfers: [], team: [], audit: [], jobs: [], destinations: [],
};
const roles = new Set(["ADMIN", "MANAGER", "STOCK", "SALES"]);
const commonPages = new Set([
  "Overview", "Inventory", "Transfers", "Orders", "Activity", "Security",
]);

export function canOpenWorkspacePage(role: string, page: string) {
  if (!roles.has(role)) return false;
  if (page === "Company" || page === "People & access") return role === "ADMIN";
  if (page === "Receive stock") return role !== "SALES";
  return commonPages.has(page);
}

function validProfile(profile: Me): boolean {
  return !!profile && typeof profile.id === "string" &&
    typeof profile.name === "string" && typeof profile.email === "string" &&
    typeof profile.mfa === "boolean" && Array.isArray(profile.factors) &&
    Array.isArray(profile.companies) && profile.companies.every((company) =>
      company && ["id", "name", "slug", "currency", "timezone", "role"].every(
        (field) => typeof company[field as keyof typeof company] === "string",
      ) && roles.has(company.role),
    );
}

// Return one complete, company-scoped snapshot. The UI must not combine a new
// identity with records left over from a previous user or company.
export async function loadWorkspaceSession(base: string, requestedCompanyId: string) {
  const me = await client(base).request<Me>("/me");
  if (!validProfile(me))
    throw new ApiError(502, "Your workspace could not be loaded. Please try again.");
  const company = me.companies.find((c) => c.id === requestedCompanyId) || me.companies[0];
  if (!company) return { me, companyId: "", data: blankWorkspace };

  const api = client(base, company.id);
  const paths: [keyof WorkspaceBundle, string][] = [
    ["locations", "/locations"], ["products", "/products"],
    ["balances", "/stock/balances"], ["orders", "/orders"],
    ["movements", "/stock/movements"], ["transfers", "/transfers"],
  ];
  if (company.role === "ADMIN") paths.push(
    ["team", "/team"], ["audit", "/audit"], ["jobs", "/jobs"],
  );
  if (company.role !== "SALES") paths.push(["destinations", "/transfer-destinations"]);
  const entries = await Promise.all(paths.map(async ([key, path]) => {
    const rows = await api.request<unknown>(path);
    if (!Array.isArray(rows))
      throw new ApiError(502, "Your workspace could not be loaded. Please try again.");
    return [key, rows] as const;
  }));
  return {
    me,
    companyId: company.id,
    data: { ...blankWorkspace, ...Object.fromEntries(entries) } as WorkspaceBundle,
  };
}
