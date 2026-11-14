# Estrategia de pruebas

Estado: Fase 1. Este documento describe la estrategia y registra las ejecuciones reales, separando lo ejecutado en Linux, lo ejecutado en Windows mediante integración continua y lo que queda por validar a mano en Windows 11.

## Vocabulario de estados

| Estado | Significado |
|---|---|
| Implementado | El código existe. No dice nada sobre si funciona. |
| Probado | Tiene pruebas automáticas que se ejecutaron y pasaron. Se registra la ejecución. |
| Validado | Además cumple los criterios de aceptación de su fase, comprobados en la aplicación real, y el usuario lo aprobó cuando corresponde. |
| Pendiente | No iniciado o incompleto. |
| Bloqueado | No puede avanzar; se indica la causa. |

Ningún documento ni informe usará «funciona» sin una ejecución de prueba que lo respalde.

## Dos ámbitos distintos

1. **Pruebas de Funcode Web Architect** (este repositorio).
2. **Pruebas de los proyectos generados**, que ejecuta el motor Tester dentro del entorno aislado.

## Pruebas de la aplicación

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Unitarias del backend | Pytest | Motores con proveedor de IA simulado, servicios, validación de rutas, enrutador |
| Integración del backend | Pytest + httpx | API con SQLite temporal, migraciones, orquestador de principio a fin |
| Contrato | Generación de tipos desde OpenAPI en la integración continua | Interfaz y backend sincronizados |
| Arquitectura | Pytest | Reglas de importación: los motores no se importan entre sí ni acceden a claves |
| Componentes | Vitest + Testing Library | Interfaz React |
| Extremo a extremo | Playwright: la interfaz real en un navegador contra el backend real | Flujos completos. No ejercita la ventana de Tauri |
| Núcleo Rust | `cargo test` | Token, puerto y serialización del estado |
| Backend empaquetado | `backend/packaging/smoke_test.py` | Arranque, migración, token, apagado por entrada estándar |
| Ventana de escritorio | Pruebas de humo: `desktop/scripts/linux_window_smoke.py` (Xvfb) y `desktop/scripts/windows-window-smoke.ps1`; lista manual en Windows 11 | Arranque, backend hijo, cierre normal y abrupto |
| Seguridad | Pytest | Petición sin token, salida de la carpeta del proyecto, claves ausentes de registros y base de datos, escape del entorno aislado, inyección de instrucciones |
| Calidad estática | Ruff, mypy (estricto), `tsc` (estricto) | Estilo y tipos. ESLint se añadirá en la Fase 8 |

**IA en las pruebas:** las pruebas automáticas usan un proveedor simulado con respuestas grabadas, para que sean repetibles y no gasten. Aparte existe un conjunto de **evaluaciones** con modelos reales (descripciones de referencia y resultados esperados) que se ejecuta a petición y cuyos resultados se registran por modelo, porque la calidad depende del modelo elegido.

## Pruebas de proyectos generados (motor Tester)

Navegación y enlaces, botones y formularios, API, operaciones de base de datos, responsive en tres tamaños, errores de consola y de red, accesibilidad (axe-core), rendimiento (Lighthouse cuando esté disponible) y seguridad básica. Cada resultado guarda evidencia: registro, captura o traza.

## Registro de ejecuciones

Cada fase añade a este documento una tabla con: fecha, conjunto de pruebas, entorno, número de pruebas, aprobadas, fallidas, omitidas y observaciones.

### Fase 0

| Fecha | Comprobación | Resultado |
|---|---|---|
| 2026-11-14 | Inspección de herramientas instaladas en el entorno de desarrollo | Ejecutada; ver [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| 2026-11-14 | Consulta de versiones vigentes en npm y PyPI | Ejecutada; ver [TECHNICAL_DECISIONS.md](TECHNICAL_DECISIONS.md) |

No se ejecutaron pruebas de software en la Fase 0.

### Fase 1

Tres entornos, que no deben confundirse:

- **Linux (desarrollo):** contenedor Ubuntu 24.04 en la nube. Aquí se ejecutó todo salvo lo propio de Windows.
- **Windows (integración continua):** equipo `windows-latest` de GitHub Actions (Windows Server, no Windows 11). Compila y prueba de forma automática en cada cambio.
- **Windows 11 (usuario):** el computador real. **Todavía no se ha ejecutado nada aquí.**

#### Ejecutado en Linux — 2026-11-14

| Conjunto | Pruebas | Aprobadas | Fallidas | Omitidas | Observaciones |
|---|---|---|---|---|---|
| Backend: `uv run pytest` | 96 | 95 | 0 | 1 | La omitida comprueba que el backend no es accesible por la dirección de red del equipo; este contenedor no tiene una distinta del loopback |
| Backend: `ruff check`, `ruff format --check`, `mypy` estricto | – | sin hallazgos | – | – | |
| Interfaz: `pnpm test` (Vitest) | 36 | 36 | 0 | 0 | |
| Interfaz: `pnpm typecheck` y `pnpm build` | – | sin errores | – | – | |
| Extremo a extremo: `pnpm test:e2e` | 9 | 9 | 0 | 0 | Ver «Errores conocidos»: un fallo intermitente observado una vez |
| Núcleo Rust: `cargo test` | 3 | 3 | 0 | 0 | |
| Backend empaquetado: `smoke_test.py` | 6 pasos | 6 | 0 | – | 27,8 MB; arranca en 1,2 s |
| Ventana Tauri bajo Xvfb: `linux_window_smoke.py` | 4 pasos | 4 | 0 | – | Compilación de depuración con el backend empaquetado; captura revisada: interfaz cargada y «Conectado» |

Qué cubren, respecto a los diez puntos pedidos para la fase:

| # | Comprobación | Dónde se prueba |
|---|---|---|
| 1 | El backend inicia | `test_process.py` (proceso real), `smoke_test.py` |
| 2 | La API responde | `test_projects.py`, `test_system_and_settings.py`, extremo a extremo |
| 3 | La autenticación funciona | `test_security.py`: sin token, token incorrecto, token en la URL, token corto |
| 4 | La interfaz detecta el estado del backend | `connection-manager.test.ts`, `ConnectionIndicator.test.tsx`; extremo a extremo: Iniciando → Error → Conectado y Conectado → Desconectado → Conectado |
| 5 | Los proyectos se crean y se guardan | `test_projects.py`; extremo a extremo (comprueba la carpeta en disco) |
| 6 | Los proyectos aparecen tras reiniciar | `test_projects_persist_after_backend_restart`, `test_data_survives_abrupt_termination`; extremo a extremo |
| 7 | Los errores se muestran | `pages.test.tsx`, `client.test.ts`; extremo a extremo (validación y ruta no válida) |
| 8 | Las rutas de archivos se validan | `test_paths.py` (incluye rutas de Windows y enlaces simbólicos), `test_projects.py` |
| 9 | Se rechazan solicitudes externas no autorizadas | `test_security.py` (origen, host, preflight); extremo a extremo desde una página de otro origen |
| 10 | Las claves no aparecen en registros ni en la interfaz | `test_security.py` (registro, base de datos, respuestas); extremo a extremo (página, almacenamiento, cookies, URL). En esta fase el único secreto es el token de sesión: aún no existen claves API |

Además: recuperación de tareas tras un cierre inesperado y no repetición de operaciones completadas (`test_task_store.py`); una sola instancia del backend (`test_misc.py`, `test_process.py`); apagado controlado con un flujo SSE abierto; reglas de arquitectura entre capas; que las secciones pendientes no tengan controles ficticios.

#### Ejecutado en Windows mediante integración continua — 2026-11-14

Ejecución n.º 1 del flujo *CI* ([enlace](https://github.com/cristianbuitrago-funcode/Funcode-Studio-CB-desa-web/actions/runs/43634800113)), sobre el cambio `a8359fa`. Equipo `windows-latest` de GitHub (Windows Server), Rust 1.100, Python 3.13. Todos los trabajos terminaron correctamente.

| Conjunto | Pruebas | Aprobadas | Fallidas | Omitidas | Observaciones |
|---|---|---|---|---|---|
| Backend: `uv run pytest` | 96 | 96 | 0 | 0 | Incluye las de proceso real, bloqueo de instancia, enlaces simbólicos y acceso solo por loopback |
| Backend: `ruff` y `mypy` | – | sin hallazgos | – | – | |
| Backend empaquetado: `build_sidecar.py` + `smoke_test.py` | 6 pasos | 6 | 0 | – | `fwa-backend.exe` generado con PyInstaller en Windows |
| Núcleo Rust: `cargo test` | 3 | 3 | 0 | 0 | |
| Compilación de la aplicación e instalador NSIS | – | correcta | – | – | Artefacto `funcode-web-architect-windows` (26,5 MB): instalador y captura |
| Ventana: `windows-window-smoke.ps1` | 7 pasos | 7 | 0 | – | Ver abajo |

Pasos de la prueba de la ventana, tal como quedaron en el registro:

1. La aplicación inició el backend empaquetado (dos procesos `fwa-backend.exe`, como es propio de PyInstaller).
2. El backend responde y rechaza peticiones sin el token de la sesión.
3. El backend escucha únicamente en `127.0.0.1`.
4. La ventana está abierta, con el título «Funcode Web Architect».
5. Se guardó una captura de pantalla.
6. Al cerrar la ventana, la aplicación y el backend se detuvieron.
7. Al terminar la aplicación de forma abrupta, el backend se apagó solo.

En el mismo flujo, en Linux: backend 95 aprobadas y 1 omitida; interfaz 36 de 36; contrato de la API sincronizado; extremo a extremo 9 de 9.

Lo que esta ejecución **no** demuestra:

- No es Windows 11 ni tu computador: no hay antivirus de usuario, ni tu escala de pantalla, ni tus permisos.
- Nadie interactuó con la ventana: no se pulsó ningún botón dentro de ella. «Examinar…», «Reiniciar backend» y la segunda instancia siguen sin probar.
- La captura de pantalla generada en Windows no fue revisada; está en el artefacto.
- El instalador se generó, pero no se instaló.

#### Pendiente: validación manual en Windows 11

Nada de esto se ha hecho todavía. Es lo que permite pasar la Fase 1 de «probada» a «validada».

**A. Con el instalador (lo más sencillo; no requiere herramientas de desarrollo)**

1. En GitHub, abrir *Actions* → *CI* → la ejecución más reciente en verde → descargar el artefacto `funcode-web-architect-windows` y descomprimirlo.
2. Ejecutar el instalador `.exe`. Como aún no está firmado, Windows SmartScreen mostrará un aviso: «Más información» → «Ejecutar de todas formas». Anotar si el antivirus lo bloquea.
3. Abrir «Funcode Web Architect» desde el menú Inicio y comprobar:

| # | Comprobación | Resultado esperado |
|---|---|---|
| 1 | La ventana abre | Se ve el dashboard con el emblema de Funcode Studio CB, sin ventana de consola negra |
| 2 | Indicador de conexión (abajo a la izquierda) | Pasa de «Iniciando» a «Conectado» en pocos segundos |
| 3 | Crear proyecto con «Examinar…» | El diálogo de Windows permite elegir carpeta; el proyecto se crea y su carpeta aparece en el Explorador |
| 4 | Cerrar y volver a abrir la aplicación | El proyecto sigue en la lista |
| 5 | Reiniciar el computador y abrir | El proyecto sigue en la lista |
| 6 | Configuración → Reiniciar backend | «Cerrando» → «Iniciando» → «Conectado» |
| 7 | Configuración → Docker o Podman | Refleja lo que realmente tienes instalado y si está en marcha |
| 8 | Configuración → cambiar el tema y el directorio de proyectos | Se guardan y persisten al reabrir |
| 9 | Eliminar un proyecto marcando «Eliminar también la carpeta» | Pide el nombre; la carpeta desaparece; hay un ZIP en `%LOCALAPPDATA%\Funcode Studio CB\Funcode Web Architect\backups` |
| 10 | Abrir la aplicación dos veces | No se abre una segunda ventana; se enfoca la primera |
| 11 | Con la aplicación abierta, Administrador de tareas → Detalles | Hay procesos `fwa-backend.exe`. Al cerrar la ventana desaparecen en pocos segundos |
| 12 | Con la aplicación abierta, finalizar `funcode-web-architect.exe` desde el Administrador de tareas | Los `fwa-backend.exe` desaparecen solos en pocos segundos |
| 13 | Textos y tamaño | Se leen bien con la escala de pantalla que uses (100 %, 125 %, 150 %) |

**B. Desde el código fuente (requiere las herramientas del README)**

```
cd backend
uv sync
uv run pytest
uv run python packaging/build_sidecar.py
uv run python packaging/smoke_test.py ..\desktop\src-tauri\binaries\fwa-backend-x86_64-pc-windows-msvc.exe

cd ..\desktop
pnpm install
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm tauri build --bundles nsis --config src-tauri/tauri.bundle.conf.json
pwsh scripts\windows-window-smoke.ps1 -AppPath src-tauri\target\release\funcode-web-architect.exe
```

Si algo falla, el registro del backend está en `%LOCALAPPDATA%\Funcode Studio CB\Funcode Web Architect\logs\backend.log`.

#### Errores conocidos de las pruebas

- **Fallo intermitente, una vez.** La prueba de extremo a extremo «eliminar exige confirmación, respalda y borra la carpeta» falló en 1 de 8 ejecuciones completas en Linux, en una comprobación sobre el disco. No volvió a reproducirse en las 6 ejecuciones siguientes ni en la integración continua, y no se identificó la causa. Durante la investigación se encontró y corrigió un defecto real del diálogo (el foco saltaba al primer campo en cada actualización), que ahora tiene su propia prueba; no puede afirmarse que fuera la causa. La misma operación está cubierta por pruebas del backend que no han fallado nunca.
