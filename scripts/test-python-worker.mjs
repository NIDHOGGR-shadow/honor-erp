// CI-only runtime smoke test. The compatibility entrypoint is never deployed.
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const root = new URL("../build/cloudflare-api/", import.meta.url);
const fixture = await readFile(new URL("../services/backend/tests/fixtures/fernet.json", import.meta.url), "utf8");
await writeFile(new URL("src/smoke.py", root), `
import base64, hashlib, json
from cryptography.fernet import Fernet
from workers import Response
from entry import Default as HonorDefault
from honor.transport import request as http_request

class Default(HonorDefault):
    async def fetch(self, request):
        if request.url.endswith('/__compat'):
            fixture = json.loads(${JSON.stringify(fixture)})
            key = base64.urlsafe_b64encode(hashlib.sha256(fixture['test_secret'].encode()).digest())
            assert Fernet(key).decrypt(fixture['token'].encode()).decode() == fixture['plaintext']
            # Exercise the JSPI bridge against an actual HTTP endpoint.
            result = http_request('GET', 'https://example.com', timeout=15)
            assert result.status_code == 200
            return Response.from_json({'encryption': True, 'http_bridge': True})
        return await super().fetch(request)
`);
const config = JSON.parse(await readFile(new URL("wrangler.jsonc", root), "utf8"));
config.main = "src/smoke.py";
config.name = "honor-api-ci-only";
delete config.triggers;
await writeFile(new URL("wrangler.smoke.jsonc", root), JSON.stringify(config));
const child = spawn("uv", ["run", "--frozen", "pywrangler", "dev", "--config", "wrangler.smoke.jsonc", "--ip", "127.0.0.1", "--port", "8792"], { cwd: root, stdio: "inherit", detached: true });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error("Python Worker exited before readiness");
    try {
      const response = await fetch("http://127.0.0.1:8792/api/health", { signal: AbortSignal.timeout(1000) });
      if (response.status === 503 && (await response.json()).detail === "Honor API configuration is incomplete.") { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Python Worker did not become ready");
  const response = await fetch("http://127.0.0.1:8792/__compat", { signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok || !result.encryption || !result.http_bridge) throw new Error("Worker encryption/HTTP runtime compatibility failed");
  console.log("Python Worker imports, fail-closed configuration, Fernet compatibility and HTTP bridge passed.");
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
}
