# Estado del proyecto

Última actualización: 2026-11-14

## Resumen

| Fase | Estado |
|---|---|
| 0. Preparación y arquitectura | **Terminada. Pendiente de aprobación del usuario** |
| 1 a 11 | Pendientes. No iniciadas |

No existe código de la aplicación. Nada está implementado, probado ni validado más allá de la documentación.

## Informe de la Fase 0

### Qué se hizo

- Inspección del entorno de desarrollo y de las herramientas instaladas.
- Comprobación de las versiones vigentes de todas las dependencias propuestas.
- Diseño de la arquitectura, la comunicación escritorio-backend, el orquestador, los motores, el sistema multiproveedor de IA y la seguridad.
- Definición de la estructura de carpetas, con los cambios justificados.
- Identificación de riesgos y limitaciones.
- Criterios de aceptación para las fases 0 a 11.

### Entorno inspeccionado

Contenedor Linux en la nube (Ubuntu 24.04, x86_64, 4 núcleos, 15 GB de RAM), **no el computador del usuario**.

| Herramienta | Estado |
|---|---|
| Node.js 22.23.4, npm 10.9.9, pnpm 10.28.0 | Instalados |
| Python 3.13.18, uv 0.11.32 | Instalados |
| Rust 1.97.0 y Cargo | Instalados |
| Git 2.43.0 | Instalado |
| PHP 8.3.6 | Instalado |
| Playwright 1.63.0 (Node) con Chromium | Instalado |
| Cliente Docker 29.9.2 | Instalado; no se comprobó si el servicio está activo |
| SQLite | Disponible desde Python (3.53.1); sin herramienta de línea de comandos |
| WebKitGTK 4.1 y GTK 3 (necesarios para Tauri en Linux) | **No instalados** |
| Ollama | **No instalado** |
| bubblewrap | No instalado |
| Pantalla gráfica | No disponible |

**Consecuencia:** en este entorno se puede desarrollar y probar el backend, la interfaz web y las pruebas con navegador. No se puede abrir ni validar la ventana de Tauri ni probar modelos locales. Esas validaciones deben hacerse en el computador del usuario o mediante compilación automática (ver DT-015).

No se instaló ninguna herramienta ni se modificó la configuración del sistema.

### Archivos creados

- `README.md`
- `CHANGELOG.md`
- `.gitignore`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/TECHNICAL_DECISIONS.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/PROJECT_STATUS.md`

### Dependencias añadidas

Ninguna. Las dependencias previstas para la Fase 1 son:

- **Escritorio:** `@tauri-apps/cli`, `@tauri-apps/api`, `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `zustand`, `tailwindcss`, `@tailwindcss/vite`, `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@playwright/test`, ESLint.
- **Backend:** `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `alembic`, `httpx`, `keyring`; para desarrollo `pytest`, `pytest-asyncio`, `ruff`, `mypy`, `pyinstaller`.
- **Rust:** `tauri`, `tauri-build`, `tauri-plugin-shell` (arranque del sidecar).

Monaco Editor se añade en la Fase 8. No se prevén marcos de agentes ni gestores de colas.

### Pruebas realizadas

Ninguna prueba de software (no hay código). Se ejecutaron las comprobaciones de entorno y de versiones descritas arriba.

### Riesgos identificados

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | La ventana de Tauri no puede validarse en el entorno de desarrollo en la nube | Alto | Validar en el computador del usuario; compilación automática por plataforma |
| R2 | Aislamiento incompleto sin Docker o Podman | Alto | Niveles de aislamiento con aviso explícito (DT-008) |
| R3 | La calidad del código generado depende del modelo; los modelos locales pequeños no bastan para proyectos complejos | Alto | Evaluaciones por modelo, advertencias en la interfaz, generación por módulos con pruebas |
| R4 | Empaquetar Python como sidecar: tamaño y avisos de antivirus | Medio | Instalador de prueba en la Fase 1; firma de código en la Fase 10 |
| R5 | Proyectos grandes superan el contexto de los modelos | Alto | Especificación modular, contexto selectivo por tarea, estado persistente |
| R6 | Los proveedores cambian sus API y modelos | Medio | Adaptadores aislados; modelos consultados al proveedor |
| R7 | Inyección de instrucciones desde contenido web | Medio | Contenido externo como datos; motores sin acceso a claves ni comandos libres |
| R8 | TypeScript 7 recién publicado | Bajo | Verificar en la Fase 1; alternativa 6.x (DT-011) |
| R9 | Costos de API imprevistos para el usuario | Medio | Registro de uso, estimación previa y límites configurables |
| R10 | Diferencias entre Windows, macOS y Linux (credenciales, procesos, rutas) | Medio | Pruebas por plataforma en la integración continua |
| R11 | Alcance muy amplio del producto | Alto | Fases estrictas con criterios de aceptación; un caso completo de extremo a extremo antes de ampliar |
| R12 | Derechos de autor en investigación y recursos multimedia | Medio | Registro de fuentes y licencias; comprobación de similitud |

### Errores conocidos

Ninguno (no hay código).

### Qué falta por aprobar para iniciar la Fase 1

1. **Plataforma principal (DT-015):** sistema operativo donde se usará y validará la aplicación, y si se desea compilación automática de instaladores con GitHub Actions.
2. **Estrategia de aislamiento (DT-008):** niveles propuestos, con Docker o Podman como opción recomendada pero no obligatoria.
3. **Arquitectura general (DT-001, DT-002, DT-003):** tres procesos, HTTP + SSE local, backend empaquetado como sidecar.
4. **Estructura de carpetas (DT-005):** motores dentro del backend.
5. **Sistema de IA (DT-006, DT-007):** adaptadores propios y claves en el almacén del sistema operativo.
6. **Idioma de la interfaz (DT-014).**
7. **Identidad visual de Funcode Studio CB:** logotipo, colores y tipografías existentes, si los hay; de lo contrario se propondrá una identidad en la Fase 1.

Las decisiones restantes (DT-004, DT-009 a DT-013) son técnicas y se aplicarán salvo objeción.
