import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() => import("./App.tsx"));
const Workspace = lazy(() => import("./online/Workspace"));
const Storefront = lazy(() => import("./online/Storefront"));
import "./index.css";

const path = window.location.pathname;
const apiBase = import.meta.env.VITE_API_BASE || "/api/v1";
const publicPreview = import.meta.env.VITE_PUBLIC_PREVIEW === "true";
const screen = publicPreview || path.startsWith("/demo") ? (
  <App />
) : path.startsWith("/shop/") ? (
  <Storefront
    slug={decodeURIComponent(path.split("/").filter(Boolean)[1] || "")}
    apiBase={apiBase}
  />
) : (
  <Workspace apiBase={apiBase} />
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
