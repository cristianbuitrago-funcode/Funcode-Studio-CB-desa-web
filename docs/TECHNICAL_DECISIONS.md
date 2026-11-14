# Decisiones técnicas

Cada decisión tiene un estado: **Propuesta** (pendiente de aprobación), **Aprobada**, **Rechazada** o **Sustituida**. Las decisiones no se borran; se actualiza su estado.

El usuario aprobó la arquitectura de la Fase 0 el 2026-11-14, con decisiones expresas sobre DT-008 y DT-015 y los ajustes DT-016 a DT-019. DT-001 a DT-014 quedan aprobadas salvo donde se indica otra cosa.

## Versiones comprobadas

Consultadas en los registros oficiales (npm, PyPI) el 2026-11-14. Las versiones exactas se fijarán en archivos de bloqueo en la Fase 1, tras una compilación de comprobación.

| Componente | Versión vigente | Nota |
|---|---|---|
| Tauri (CLI y API) | 2.12.4 | Existe Tauri 3 en versión alfa; no se usará |
| React / React DOM | 19.3.1 | |
| TypeScript | 6.0.3 en uso (7.0.2 es la vigente) | Ver DT-011 |
| Vite | 8.3.8 | Requiere Node 20.19+ o 22.12+ |
| @vitejs/plugin-react | 6.3.0 | |
| Tailwind CSS | 4.3.5 | Con `@tailwindcss/vite` |
| React Router | 8.5.1 | |
| TanStack Query | 5.107.1 | |
| Zustand | 5.1.0 | |
| Monaco Editor | 0.57.0 | Se incorpora en la Fase 8 |
| Vitest | 5.1.0 | |
| Playwright | 1.65.x | |
| FastAPI | 0.163.0 | Python 3.11+ |
| Pydantic | 2.14.3 | |
| Uvicorn | 0.54.0 | |
| SQLAlchemy | 2.1.8 | Python 3.11+ |
| Alembic | 1.20.1 | |
| httpx | 0.28.1 | |
| keyring | 25.7.0 | |
| Pytest | 9.2.0 | |
| Ruff / mypy | 0.17.5 / 2.4.1 | |
| PyInstaller | 6.22.3 | Admite Python hasta 3.15 |

---

## DT-001. Tres procesos: interfaz, backend Python y entorno aislado
**Estado:** Aprobada
**Decisión:** Tauri solo aloja la interfaz y vigila el backend. Toda la lógica vive en Python. El código generado solo se ejecuta en el entorno aislado.
**Motivo:** separa responsabilidades, permite probar el backend sin ventana y mantiene las claves lejos de la interfaz.
**Alternativa descartada:** escribir la lógica en Rust dentro de Tauri. Un solo proceso, pero desarrollo mucho más lento y peor ecosistema para IA.

## DT-002. Comunicación por HTTP + SSE en loopback con token de sesión
**Estado:** Aprobada
**Decisión:** REST para órdenes, SSE para progreso, en `127.0.0.1` con puerto dinámico y token por sesión.
**Motivo:** FastAPI genera el contrato OpenAPI, del que se derivan los tipos TypeScript. SSE es suficiente porque el flujo en vivo va del backend a la interfaz.
**Alternativas descartadas:** WebSocket (bidireccional, innecesario y más complejo de reconectar); canal stdin/stdout del sidecar (sin contrato tipado ni herramientas de depuración).

## DT-003. Backend empaquetado como sidecar con PyInstaller
**Estado:** Aprobada
**Decisión:** en desarrollo se ejecuta con `uv`; para distribuir se congela en un ejecutable incluido en el instalador.
**Motivo:** el usuario final no debe instalar Python.
**Riesgo:** tamaño del instalador y posibles falsos positivos de antivirus en Windows. Se evalúa en la Fase 1 con un instalador de prueba; la firma de código se trata en la Fase 10.

## DT-004. Python 3.12 o 3.13; Node 22; pnpm; uv
**Estado:** Aprobada
**Decisión:** Python mínimo 3.12 (probado en 3.13), Node 22 LTS, pnpm para JavaScript y uv para Python.
**Motivo:** todas las dependencias lo admiten; pnpm y uv producen archivos de bloqueo reproducibles e instalaciones rápidas.

## DT-005. Los motores viven dentro del paquete del backend
**Estado:** Aprobada
**Decisión:** `backend/src/fwa/engines/` en lugar de `engines/` en la raíz; se elimina `backend/agents/`.
**Motivo:** ver «Cambios respecto a la estructura inicial» en [ARCHITECTURE.md](ARCHITECTURE.md). La independencia se asegura con contratos Pydantic y una prueba automática de reglas de importación.

## DT-006. Adaptadores de IA propios sobre httpx, sin marcos de agentes
**Estado:** Aprobada
**Decisión:** interfaz común y cuatro adaptadores iniciales (`ollama`, `openai_compatible`, `anthropic`, `google`) implementados con `httpx`. Los modelos se consultan al proveedor, no se fijan en el código.
**Motivo:** una sola dependencia para todos los proveedores, control total del flujo en vivo y de los errores, sin atarse a un marco (LangChain, LiteLLM) que cambia con frecuencia.
**Costo asumido:** mantener cuatro adaptadores pequeños. Si alguno resulta costoso de mantener, se puede sustituir por el SDK oficial sin tocar los motores.

## DT-007. Claves en el almacén de credenciales del sistema operativo
**Estado:** Aprobada
**Decisión:** biblioteca `keyring` desde el backend. Sin almacén disponible, la clave vive solo en memoria durante la sesión.
**Motivo:** el backend es quien usa las claves; así nunca pasan por la interfaz.
**Alternativa descartada:** archivo cifrado propio. Obliga a gestionar una contraseña maestra y es más fácil de implementar mal.

## DT-008. Aislamiento por niveles: estático, contenedor, proceso restringido
**Estado:** Aprobada por el usuario, con ajustes
**Decisión:** Docker o Podman recomendado pero opcional, con tres niveles numerados 1 a 3: sitios estáticos; backend con contenedores; backend sin contenedores (nada se ejecuta automáticamente, advertencia clara y autorización explícita). Ver [SECURITY.md](SECURITY.md), sección 5. La aplicación detecta Docker y Podman y nunca los instala por su cuenta.
**Motivo:** no existe un mecanismo de aislamiento fuerte, uniforme y sin instalación adicional en los tres sistemas operativos.
**Alternativas:** (a) exigir Docker siempre: más seguro, pero obstáculo de instalación para usuarios no técnicos; (b) solo modo restringido: más simple, protección insuficiente; (c) WebContainers u otro entorno en el navegador: aísla bien Node.js, pero no admite PHP ni Python y tiene licencia comercial.

## DT-009. Estado del orquestador en SQLite como grafo de tareas
**Estado:** Aprobada
**Decisión:** tareas, dependencias, artefactos y eventos persistentes; motor de ejecución propio con `asyncio`.
**Motivo:** permite continuar tras cerrar la aplicación y no depender del contexto de una conversación. Un gestor de colas externo (Celery, Redis) sería una dependencia innecesaria en una aplicación de un solo usuario.

## DT-010. Un repositorio Git por proyecto generado; metadatos fuera del proyecto
**Estado:** Aprobada
**Decisión:** historial, comparación y restauración mediante Git. Los metadatos de la aplicación se guardan en su base de datos, no dentro del proyecto.
**Motivo:** los proyectos exportados quedan limpios. Si Git no está instalado, se usa un sistema de instantáneas más limitado.
**Fase 1:** Git es opcional. Si está instalado, cada proyecto nuevo recibe su repositorio; si no, el proyecto se crea igualmente y la interfaz lo indica. La alternativa sin Git para el historial se decidirá en la Fase 8, cuando exista historial que mostrar.

## DT-011. Versión de TypeScript
**Estado:** Resuelta en la Fase 1: **TypeScript 6.0.3**
**Resultado de la verificación:** con TypeScript 7.0.2 el generador de tipos `openapi-typescript` 7.13 falla, porque depende de la API de programación del compilador que la versión 7 ya no ofrece. Se aplicó la alternativa prevista. Se revisará cuando el generador admita la versión 7.
**Decisión original:** intentar TypeScript 7.0 y verificar en la Fase 1 que Vite, Vitest, el editor y el generador de tipos OpenAPI funcionan con ella. Si alguna herramienta falla, fijar la última 6.x.
**Motivo:** es una versión mayor reciente; no se ha comprobado su compatibilidad con todo el conjunto de herramientas.

## DT-012. Estado de la interfaz: TanStack Query + Zustand
**Estado:** Aprobada
**Decisión:** TanStack Query para datos del backend y Zustand para estado local de interfaz (paneles, selección).
**Motivo:** evita escribir a mano caché, reintentos y sincronización. Son dos bibliotecas pequeñas.

## DT-013. Editor de código: Monaco
**Estado:** Aprobada en principio (se confirma en la Fase 8)
**Decisión:** Monaco Editor, que incluye comparación de cambios.
**Alternativa:** CodeMirror 6, más ligero pero con comparación y autocompletado menos completos.

## DT-014. Interfaz en español, preparada para otros idiomas
**Estado:** Aprobada (sin objeción)
**Decisión:** textos en español, centralizados en archivos de traducción para poder añadir idiomas después.

## DT-015. Plataforma principal de desarrollo y validación
**Estado:** Aprobada por el usuario: **Windows 11** es la plataforma principal de desarrollo, instalación y validación. La arquitectura no se cierra a macOS ni Linux.
**Consecuencia:** lo probado en el entorno Linux de desarrollo no demuestra que la aplicación de escritorio funcione en Windows. Se añadió integración continua con un equipo Windows que compila el instalador y ejecuta pruebas de humo, y una lista de validación manual (ver [TESTING.md](TESTING.md)).
**Contexto:** el entorno donde se realizó la Fase 0 es un contenedor Linux en la nube, sin pantalla ni bibliotecas WebKitGTK. Sirve para desarrollar y probar el backend y la interfaz web, pero no para abrir ni validar la ventana de Tauri.
**Se necesita saber:** en qué sistema operativo se usará y validará la aplicación (Windows, macOS o Linux) y si se desea compilación automática de instaladores mediante GitHub Actions.

## DT-016. El backend se apaga al cerrarse su entrada estándar
**Estado:** Implementada (Fase 1)
**Decisión:** la aplicación de escritorio mantiene abierta la entrada estándar del backend. Cerrarla es la orden de apagado controlado, y el sistema operativo la cierra por sí mismo si la aplicación muere.
**Motivo:** garantiza que no queden backends huérfanos en ningún sistema, sin depender de identificadores de proceso ni de señales (que en Windows no existen como en Linux). Es especialmente necesario con PyInstaller, cuyo ejecutable son dos procesos: terminar el primero no termina el segundo.
**Alternativas descartadas:** vigilar el identificador del proceso padre (requiere llamadas específicas de cada sistema); Job Objects de Windows (solo Windows).

## DT-017. El núcleo de Tauri inicia el backend con la biblioteca estándar de Rust
**Estado:** Implementada (Fase 1). Sustituye el uso previsto de `tauri-plugin-shell`.
**Decisión:** `std::process::Command` desde Rust, sin el complemento de shell.
**Motivo:** el complemento expone a la interfaz la capacidad de ejecutar programas, que aquí no se necesita. Así la ventana no tiene ningún permiso de ejecución.
**Complementos usados:** `tauri-plugin-dialog` (elegir carpeta) y `tauri-plugin-single-instance` (una sola ventana).

## DT-018. Rutas con «#» en la interfaz
**Estado:** Implementada (Fase 1)
**Decisión:** enrutador con almohadilla (`createHashRouter`).
**Motivo:** funciona igual con el protocolo propio de Tauri en los tres sistemas y en el navegador, sin configurar redirecciones.

## DT-019. Capacidades reales de cada modelo (ajuste del usuario)
**Estado:** Aprobada; se implementa en la Fase 2
**Decisión:** ver [ARCHITECTURE.md](ARCHITECTURE.md), sección 6.1.1. Ficha de capacidades por modelo con el origen de cada dato; el enrutador no asigna automáticamente un modelo que no cumpla lo que la tarea necesita; las sustituciones por modelos de respaldo se registran con su motivo.

## DT-020. Identidad visual tomada del sitio de Funcode Studio CB
**Estado:** Implementada (Fase 1)
**Decisión:** paleta, tipografías y emblema tomados del repositorio `Funcode-Studio-CB` (sitio del estudio): azul marino `#050a18`, azul eléctrico `#2f6bff`, cian `#38c6ff`, dorado `#f2c14e`; Inter para texto y Space Grotesk para títulos, incluidas en la aplicación (sin peticiones a Google Fonts). El icono de la aplicación es el emblema «FCB».
**Recursos que faltan:** el logotipo solo existe para fondo oscuro y como imagen de 512 px (emblema) y 720 px (logotipo completo). Para un icono nítido en pantallas de alta densidad y para el tema claro conviene disponer de una versión vectorial (SVG) o de al menos 1024 px, y de una variante para fondo claro.
**Tema claro:** se ofrece como preferencia; es una adaptación propia de la paleta, no una identidad oficial.

## DT-021. Cliente HTTP para pruebas y adaptadores
**Estado:** Abierta; se decide en la Fase 2
**Contexto:** Starlette declara obsoleto el uso de `httpx` en su cliente de pruebas y recomienda `httpx2` (mantenido por el equipo de Pydantic). La Fase 1 usa `httpx2` solo como dependencia de pruebas. DT-006 preveía `httpx` para los adaptadores de IA; antes de implementarlos se comprobará cuál de los dos conviene.
