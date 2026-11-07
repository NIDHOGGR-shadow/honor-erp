import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
const Workspace = lazy(() => import("./online/Workspace"));
const Storefront = lazy(() => import("./online/Storefront"));
const StorefrontPreview = import.meta.env.DEV
  ? lazy(() => import("./online/StorefrontPreview"))
  : null;
import "./index.css";

const path = window.location.pathname;
const apiBase = import.meta.env.VITE_API_BASE || "/api/v1";
// Retire old public walkthrough links; staff access always uses the API session.
const retired = path === "/demo" || path === "/pilot" || (path === "/preview" && !import.meta.env.DEV);
if (retired) window.location.replace(path === "/demo" ? "/workspace" : "/");
const shopSlug = path.startsWith("/shop/")
  ? decodeURIComponent(path.split("/").filter(Boolean)[1] || "")
  : import.meta.env.VITE_STORE_SLUG || "honor";
const screen = retired ? null : path === "/preview" && StorefrontPreview ? (
  <StorefrontPreview initialSearch={window.location.search} />
) : path.startsWith("/workspace") ? (
  <Workspace apiBase={apiBase} shopUrl="/" />
) : (
  <Storefront slug={shopSlug} apiBase={apiBase} />
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-zinc-500">
          Opening Honor…
        </div>
      }
    >
      {screen}
    </Suspense>
  </StrictMode>,
);
