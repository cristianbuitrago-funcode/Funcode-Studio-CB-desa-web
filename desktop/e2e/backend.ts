// Control del backend real durante las pruebas de extremo a extremo.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PORT = 8793;
export const BACKEND_URL = `http://127.0.0.1:${PORT}`;
export const TOKEN = "token-e2e-0123456789abcdef0123456789";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "backend");

export class TestBackend {
  readonly root = mkdtempSync(join(tmpdir(), "fwa-e2e-"));
  readonly dataDir = join(this.root, "datos");
  readonly workspace = join(this.root, "proyectos");
  private process: ChildProcess | null = null;

  async start(): Promise<void> {
    this.process = spawn("uv", ["run", "--project", backendDir, "fwa-backend"], {
      env: {
        ...process.env,
        FWA_PORT: String(PORT),
        FWA_SESSION_TOKEN: TOKEN,
        FWA_DATA_DIR: this.dataDir,
        FWA_DEV: "1",
        FWA_WATCH_STDIN: "1",
      },
      stdio: ["pipe", "ignore", "inherit"],
      shell: process.platform === "win32",
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${BACKEND_URL}/health`)).ok) return;
      } catch {
        // todavía no escucha
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("El backend de pruebas no arrancó a tiempo.");
  }

  /** Apagado controlado, igual que lo hace la aplicación: cerrando su entrada estándar. */
  async stop(): Promise<void> {
    const child = this.process;
    this.process = null;
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.stdin?.end();
    const timer = setTimeout(() => child.kill("SIGKILL"), 8_000);
    await exited;
    clearTimeout(timer);
  }

  async dispose(): Promise<void> {
    await this.stop();
    rmSync(this.root, { recursive: true, force: true });
  }
}
