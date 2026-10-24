import { copyFile, writeFile } from "node:fs/promises";
if (process.env.VITE_PUBLIC_PREVIEW === "true")
  throw new Error(
    "Build the connected workspace for Cloudflare; remove VITE_PUBLIC_PREVIEW.",
  );
if (process.argv.includes("--workers")) {
  console.log("Cloudflare Workers assets ready in dist. The API must be connected separately.");
  process.exit(0);
}
await copyFile(
  new URL("../deploy/cloudflare/worker.mjs", import.meta.url),
  new URL("../dist/_worker.js", import.meta.url),
);
await writeFile(
  new URL("../dist/_routes.json", import.meta.url),
  JSON.stringify({ version: 1, include: ["/*"], exclude: [] }),
);
await writeFile(
  new URL("../dist/_headers", import.meta.url),
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n",
);
console.log(
  "Cloudflare Pages bundle ready in dist. Set HONOR_API_ORIGIN in the project runtime configuration.",
);
