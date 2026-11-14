// Genera los tipos TypeScript de la API a partir del contrato OpenAPI del backend.
// Uso: pnpm gen:api   (requiere uv y el backend instalado en ../backend)
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "..", "backend");
const out = join(root, "src", "lib", "api", "schema.d.ts");
const tmp = mkdtempSync(join(tmpdir(), "fwa-openapi-"));
const spec = join(tmp, "openapi.json");
const shell = process.platform === "win32";

try {
  execFileSync("uv", ["run", "--project", backend, "python", join(backend, "scripts", "export_openapi.py"), spec], {
    stdio: "inherit",
    shell,
  });
  execFileSync("pnpm", ["exec", "openapi-typescript", spec, "-o", out], { cwd: root, stdio: "inherit", shell });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
