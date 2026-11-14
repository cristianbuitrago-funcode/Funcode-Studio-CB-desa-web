# Funcode Web Architect

Producto de **Funcode Studio CB**. Aplicación de escritorio que crea sitios web y aplicaciones web reales a partir de descripciones en lenguaje natural: analiza la necesidad, investiga referencias, diseña, programa, prueba, corrige y exporta proyectos independientes.

> **Estado actual: Fase 1 (aplicación de escritorio) implementada y probada; pendiente de validación en Windows 11 y de aprobación.**
> Existe la base de la aplicación: ventana de escritorio, backend local, dashboard, gestión de proyectos y configuración. Todavía **no** analiza descripciones, no usa inteligencia artificial y no genera código: eso empieza en la Fase 2.
> Detalle en [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Qué es y qué no es

- Es una herramienta de desarrollo que funciona en el computador del usuario, con proyectos y base de datos locales.
- Podrá usar inteligencia artificial externa (mediante API), local (por ejemplo Ollama) o una combinación de ambas.
- No es un generador de plantillas ni promete terminar cualquier proyecto con una sola instrucción: los proyectos grandes se dividen en módulos y deben superar pruebas antes de considerarse terminados.

## Requisitos para desarrollar

| Herramienta | Versión | Windows 11 |
|---|---|---|
| Node.js | 22 o superior | `winget install OpenJS.NodeJS.LTS` |
| pnpm | 10 | `npm install -g pnpm` |
| Rust | estable | `winget install Rustlang.Rustup` |
| Microsoft C++ Build Tools | — | `winget install Microsoft.VisualStudio.2022.BuildTools` (carga «Desarrollo para el escritorio con C++») |
| uv (gestiona Python 3.13) | 0.11 o superior | `winget install astral-sh.uv` |
| Git | cualquiera reciente | `winget install Git.Git` |

WebView2 ya viene con Windows 11. Docker o Podman son opcionales.

## Cómo ejecutar la aplicación

Todos los comandos se ejecutan desde la carpeta del repositorio.

### 1. Instalar dependencias (una vez)

```
cd backend
uv sync
cd ../desktop
pnpm install
```

### 2. Modo desarrollo (ventana de escritorio)

```
cd desktop
pnpm tauri dev
```

Abre la ventana, inicia el backend automáticamente y recarga la interfaz al cambiar el código. La primera compilación tarda varios minutos.

### 3. Compilar el instalador de Windows

```
cd backend
uv run python packaging/build_sidecar.py
cd ../desktop
pnpm tauri build --bundles nsis --config src-tauri/tauri.bundle.conf.json
```

El instalador queda en `desktop/src-tauri/target/release/bundle/nsis/`. También se genera automáticamente en GitHub (pestaña *Actions*, flujo *CI*, artefacto `funcode-web-architect-windows`).

### 4. Solo el backend, o la interfaz en un navegador

Útil para desarrollar sin compilar la ventana. En dos terminales (PowerShell):

```
cd backend
$env:FWA_DEV = "1"; $env:FWA_SESSION_TOKEN = "un-token-de-desarrollo-largo"
uv run fwa-backend
```

```
cd desktop
$env:VITE_FWA_BACKEND_URL = "http://127.0.0.1:8765"; $env:VITE_FWA_TOKEN = "un-token-de-desarrollo-largo"
pnpm dev
```

Y abrir `http://localhost:1420`. En este modo no existen el diálogo «Examinar…» ni el botón de reiniciar el backend, y la interfaz lo indica.

## Pruebas

```
cd backend
uv run pytest                 # backend
uv run ruff check . ; uv run mypy

cd ../desktop
pnpm typecheck
pnpm test                     # interfaz (Vitest)
pnpm exec playwright install chromium   # una vez
pnpm test:e2e                 # extremo a extremo, con el backend real

cd src-tauri
cargo test                    # núcleo Rust
```

Validación en Windows 11 de la aplicación compilada: ver [docs/TESTING.md](docs/TESTING.md).

## Dónde se guardan los datos

- **Proyectos:** en el directorio que elijas al crear cada uno (se propone `Documentos\Funcode Web Architect\Proyectos`).
- **Datos de la aplicación** (base de datos, registros, copias de seguridad): `%LOCALAPPDATA%\Funcode Studio CB\Funcode Web Architect`.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Estado actual, informe de la fase, qué falta |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, comunicación escritorio-backend, sistema de IA, estructura |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Fases 0 a 11 con criterios de aceptación |
| [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md) | Decisiones técnicas y su estado |
| [docs/SECURITY.md](docs/SECURITY.md) | Seguridad: qué está implementado y qué es diseño |
| [docs/TESTING.md](docs/TESTING.md) | Pruebas ejecutadas, resultados y validación en Windows |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios por fase |

## Cómo continuar el desarrollo en otra sesión

1. Leer [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md): indica la fase vigente y lo pendiente.
2. Revisar [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md) para no reabrir decisiones ya aprobadas.
3. Seguir la fase correspondiente de [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md). No se avanza de fase sin validar la anterior.
