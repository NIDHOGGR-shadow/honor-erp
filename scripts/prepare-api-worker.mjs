import { cp, mkdir, rm } from "node:fs/promises";
const output = new URL("../build/cloudflare-api/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["pyproject.toml", "uv.lock", ".python-version", "wrangler.jsonc", "src"]) {
  await cp(new URL(`../deploy/cloudflare-api/${file}`, import.meta.url), new URL(file, output), { recursive: true });
}
await cp(new URL("../services/backend/honor/", import.meta.url), new URL("src/honor/", output), {
  recursive: true,
  filter: source => !source.includes("__pycache__") && !source.endsWith(".pyc"),
});
console.log("Honor API Worker staged in build/cloudflare-api. No frontend or environment files copied.");
