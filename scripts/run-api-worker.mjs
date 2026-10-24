// Keep platform-wide Python selectors out of the Worker dependency installation.
import { spawn, spawnSync } from "node:child_process";
import { dirname, delimiter } from "node:path";
const args = process.argv.slice(2);
if (!["deploy", "versions", "dev"].includes(args[0])) {
  throw new Error("Expected a Python Worker deploy, versions or dev command");
}
const env = { ...process.env, UV_SYSTEM_PYTHON: "false" };
for (const key of ["VIRTUAL_ENV", "CONDA_PREFIX", "UV_PYTHON", "UV_PROJECT_ENVIRONMENT", "PYTHONHOME", "UV_INTERNAL__PARENT_INTERPRETER"]) {
  delete env[key];
}
const discovery = spawnSync("python3", ["-c", "from uv import find_uv_bin; print(find_uv_bin())"], { env, encoding: "utf8" });
if (discovery.status !== 0 || !discovery.stdout.trim()) {
  throw new Error("Install the pinned uv package before running the API Worker command");
}
const uvBinary = discovery.stdout.trim();
env.PATH = dirname(uvBinary) + delimiter + (env.PATH || "");
const child = spawn(uvBinary, ["run", "--frozen", "pywrangler", ...args], {
  cwd: new URL("../build/cloudflare-api/", import.meta.url),
  env,
  stdio: "inherit",
});
child.on("error", error => {
  console.error("Python Worker runner failed:", error.code || error.name);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
