import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { BACKEND_URL, TestBackend, TOKEN } from "./backend";

let backend: TestBackend;
let consoleErrors: string[];

const indicator = (page: Page) => page.getByTestId("connection-indicator");

test.beforeEach(async ({ page }) => {
  backend = new TestBackend();
  await backend.start();
  consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
});

test.afterEach(async () => {
  await backend.dispose();
});

async function createProject(page: Page, name: string, description = "") {
  await page.goto("/#/projects/new");
  await page.getByLabel("Nombre del proyecto").fill(name);
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Directorio de trabajo").fill(backend.workspace);
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("dashboard vacío, creación de proyecto y aparición en las listas", async ({ page }) => {
  await page.goto("/");
  await expect(indicator(page)).toHaveAttribute("data-status", "connected");
  await expect(page.getByRole("heading", { level: 1, name: "Funcode Web Architect" })).toBeVisible();
  await expect(page.getByText("Crea tu primer proyecto")).toBeVisible();

  await page.getByRole("button", { name: "Crear proyecto" }).first().click();
  await expect(page).toHaveURL(/#\/projects\/new$/);
  await createProject(page, "Tienda de tecnología", "Una tienda virtual de celulares.");

  await expect(page).toHaveURL(/#\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Una tienda virtual de celulares.")).toBeVisible();
  await expect(page.getByText("Borrador")).toBeVisible();
  await expect(page.getByText("Proyecto «Tienda de tecnología» creado.")).toBeVisible();
  expect(existsSync(join(backend.workspace, "tienda-de-tecnologia"))).toBe(true);

  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByRole("link", { name: /Tienda de tecnología/ })).toBeVisible();
  await expect(page.getByText("Crea tu primer proyecto")).toHaveCount(0);
  await page.getByRole("link", { name: "Proyectos", exact: true }).click();
  await page.getByRole("link", { name: /Tienda de tecnología/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tienda de tecnología" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("los errores de validación se muestran con claridad", async ({ page }) => {
  await page.goto("/#/projects/new");
  await expect(indicator(page)).toHaveAttribute("data-status", "connected");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page.getByText("Escribe un nombre para el proyecto.")).toBeVisible();

  await page.getByLabel("Nombre del proyecto").fill("Demo");
  await page.getByLabel("Directorio de trabajo").fill("carpeta/relativa");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page.getByText("El directorio de trabajo debe ser una ruta absoluta.")).toBeVisible();
  await expect(page).toHaveURL(/#\/projects\/new$/);
});

test("los proyectos persisten y la interfaz se recupera tras reiniciar el backend", async ({ page }) => {
  await createProject(page, "Proyecto persistente");
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Proyecto persistente/ })).toBeVisible();

  await backend.stop();
  await expect(indicator(page)).not.toHaveAttribute("data-status", "connected");
  await expect(indicator(page)).toHaveAttribute("data-status", /disconnected|closing|error/);
  await expect(page.getByRole("button", { name: "Crear proyecto" }).first()).toBeVisible();

  await backend.start();
  await expect(indicator(page)).toHaveAttribute("data-status", "connected", { timeout: 20_000 });
  await page.reload();
  await expect(indicator(page)).toHaveAttribute("data-status", "connected");
  await expect(page.getByRole("link", { name: /Proyecto persistente/ })).toBeVisible();
});

test("sin backend la interfaz muestra «Iniciando» y luego «Error», y se conecta cuando aparece", async ({ page }) => {
  await backend.stop();
  await page.goto("/");
  await expect(indicator(page)).toHaveAttribute("data-status", "starting");
  await expect(indicator(page)).toHaveAttribute("data-status", "error", { timeout: 30_000 });
  await expect(page.getByText("Sin conexión con el backend")).toBeVisible();
  await backend.start();
  await expect(indicator(page)).toHaveAttribute("data-status", "connected", { timeout: 20_000 });
  await expect(page.getByText("Sin conexión con el backend")).toHaveCount(0);
});

test("eliminar exige confirmación, respalda y borra la carpeta", async ({ page }) => {
  await createProject(page, "Para borrar");
  const folder = join(backend.workspace, "para-borrar");
  expect(existsSync(folder)).toBe(true);

  await page.getByRole("button", { name: "Eliminar" }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminar proyecto" });
  const confirm = dialog.getByRole("button", { name: "Eliminar proyecto" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/para confirmar/).fill("otro nombre");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(existsSync(folder)).toBe(true);

  await page.getByRole("button", { name: "Eliminar" }).click();
  await dialog.getByRole("checkbox", { name: /Eliminar también la carpeta/ }).check();
  await dialog.getByLabel(/para confirmar/).fill("Para borrar");
  await confirm.click();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByText("Aún no hay proyectos")).toBeVisible();
  expect(existsSync(folder)).toBe(false);
  expect(readdirSync(join(backend.dataDir, "backups")).some((f) => f.endsWith(".zip"))).toBe(true);
});

test("la configuración se guarda y muestra el estado real del sistema", async ({ page }) => {
  await page.goto("/#/settings");
  await expect(indicator(page)).toHaveAttribute("data-status", "connected");
  await expect(page.getByText("Docker", { exact: true })).toBeVisible();
  await expect(page.getByText("Podman", { exact: true })).toBeVisible();
  await expect(page.getByText(/127\.0\.0\.1:8793/)).toBeVisible();

  await page.getByRole("radio", { name: /Claro/ }).click();
  await expect(page.getByRole("radio", { name: /Claro/ })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const directory = page.getByRole("textbox", { name: "Directorio de proyectos" });
  await directory.fill(backend.workspace);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(directory).toHaveValue(backend.workspace);

  await directory.fill("no/absoluta");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("El directorio de trabajo debe ser una ruta absoluta.")).toBeVisible();
});

test("una página externa no puede usar la API aunque conozca el token", async ({ page }) => {
  // Página servida desde otro origen (no es la interfaz de la aplicación).
  await page.route("http://sitio-externo.test/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>externo</title>" }),
  );
  await page.goto("http://sitio-externo.test/");
  const result = await page.evaluate(
    async ([url, token]) => {
      try {
        const response = await fetch(`${url}/api/v1/projects`, { headers: { Authorization: `Bearer ${token}` } });
        return `respuesta ${response.status}`;
      } catch {
        return "bloqueada";
      }
    },
    [BACKEND_URL, TOKEN],
  );
  expect(result).toBe("bloqueada");
  // Sin CORS de por medio, el backend responde 403 a ese origen.
  const direct = await fetch(`${BACKEND_URL}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Origin: "http://sitio-externo.test" },
  });
  expect(direct.status).toBe(403);
});

test("el token de sesión no aparece en la página ni en el almacenamiento del navegador", async ({ page }) => {
  await createProject(page, "Revisión de secretos");
  for (const route of ["/#/", "/#/settings", "/#/ai", "/#/projects"]) {
    await page.goto(route);
    await expect(indicator(page)).toHaveAttribute("data-status", "connected");
    const exposed = await page.evaluate((token) => {
      const storage = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      return (
        document.documentElement.outerHTML.includes(token) ||
        storage.includes(token) ||
        document.cookie.includes(token) ||
        location.href.includes(token)
      );
    }, TOKEN);
    expect(exposed, `token expuesto en ${route}`).toBe(false);
  }
});

test("las secciones pendientes no ofrecen controles ficticios", async ({ page }) => {
  await page.goto("/#/ai");
  await expect(page.getByText("Esta sección todavía no está disponible")).toBeVisible();
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
});
