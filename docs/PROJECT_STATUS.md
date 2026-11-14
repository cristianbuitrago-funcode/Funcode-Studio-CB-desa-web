# Estado del proyecto

Última actualización: 2026-11-14

## Resumen

| Fase | Estado |
|---|---|
| 0. Preparación y arquitectura | Terminada y **aprobada** por el usuario (2026-11-14) |
| 1. Aplicación de escritorio | **Implementada y probada. Pendiente de validación en Windows 11 y de aprobación** |
| 2 a 11 | Pendientes. No iniciadas. La Fase 2 no comienza sin aprobación explícita |

**Fase actual: 1.**

Vocabulario (ver [TESTING.md](TESTING.md)): *implementado* = el código existe; *probado* = tiene pruebas automáticas que se ejecutaron y pasaron; *validado* = comprobado en la aplicación real en Windows 11 y aprobado por el usuario. **Nada de la Fase 1 está validado todavía.**

## Informe de la Fase 1

### Qué se construyó

Una aplicación de escritorio estable sobre la cual construir el resto del producto. No analiza descripciones, no usa inteligencia artificial y no genera código.

- **Ventana de escritorio (Tauri 2 + Rust):** abre la interfaz, inicia el backend local, lo vigila, lo reinicia si cae (hasta 3 veces) y lo detiene al salir. Una sola instancia.
- **Backend local (Python + FastAPI):** configuración, registro de eventos con redacción de secretos, manejo uniforme de errores, comprobación de salud, migraciones automáticas al arrancar y apagado controlado. Funciona iniciado por la aplicación o de forma independiente.
- **Comunicación protegida:** solo en `127.0.0.1`, puerto dinámico, token aleatorio por sesión, validación de origen y de host, CORS restrictivo, flujo SSE de eventos, reconexión automática con esperas crecientes.
- **Interfaz (React + TypeScript + Tailwind):** dashboard, lista de proyectos, creación, detalle, edición y eliminación con confirmación, configuración, sección de inteligencia artificial (informativa) e indicador permanente del estado del backend.
- **Persistencia (SQLite + Alembic):** proyectos, ajustes, actividad y la base del orquestador (tareas con estados, dependencias, clave de idempotencia y recuperación tras un cierre inesperado).
- **Identidad visual** de Funcode Studio CB, tomada del sitio del estudio.
- **Empaquetado** del backend con PyInstaller e **integración continua** en Linux y Windows, que además genera el instalador de Windows.

### Funcionalidades

| Funcionalidad | Estado |
|---|---|
| Ventana de escritorio que inicia y detiene el backend | Probado en Linux (pantalla virtual) y en Windows (integración continua) |
| Backend: salud, configuración, registro, errores, apagado controlado | Probado en Linux y Windows |
| Token de sesión, validación de origen y host, CORS | Probado en Linux y Windows |
| Flujo SSE y reconexión automática | Probado |
| Indicador de estado: Iniciando, Conectado, Desconectado, Error, Cerrando | Probado. «Cerrando» por reinicio desde la ventana: solo implementado (requiere la ventana real) |
| Dashboard con estado vacío, proyectos recientes, actividad y estado del sistema | Probado |
| Crear proyecto (nombre, descripción, directorio de trabajo, identificador único, carpeta y Git) | Probado |
| Listar, abrir, consultar estado y editar proyectos | Probado |
| Eliminar proyecto con confirmación y copia de seguridad | Probado |
| Persistencia tras reiniciar el backend y tras un cierre abrupto | Probado |
| Configuración: directorio de proyectos y tema | Probado |
| Configuración: seguridad, backend, sistema, Docker/Podman | Probado (lectura del estado real) |
| Detección de Docker y Podman | Probado con respuestas simuladas y con el estado real de Linux. Sin probar contra Docker Desktop o Podman reales en Windows |
| Diálogo nativo «Examinar…» para elegir carpeta | **Implementado, sin probar** (requiere la ventana real con interacción) |
| Botón «Reiniciar backend» | **Implementado, sin probar** (requiere la ventana real con interacción) |
| Reinicio automático del backend si cae | **Implementado, sin probar** de extremo a extremo |
| Segunda instancia enfoca la ventana existente | **Implementado, sin probar** |
| Almacén persistente de tareas y recuperación | Probado (aún sin motores que lo usen) |
| Instalador de Windows (NSIS) | Generado en integración continua. Instalación **sin probar** |
| Compilación para macOS | Sin probar |

### Pendiente a propósito (identificado en la interfaz como «Fase N», sin controles ficticios)

- Proveedores de inteligencia artificial, modelos y claves: Fase 2.
- Análisis de la descripción, adjuntos y confirmación del alcance: Fase 2. Referencias web: Fase 3.
- Editor, vista previa, pruebas y exportación de proyectos: fases 5 a 10.
- Ejecución aislada de proyectos (los tres niveles): fases 5 y 6.
- Otros idiomas de interfaz.

### Dependencias agregadas

- **Backend:** `fastapi` 0.163, `uvicorn` 0.54, `pydantic` 2.14, `pydantic-settings` 2.16, `sqlalchemy` 2.1, `alembic` 1.20. Desarrollo: `pytest`, `httpx2` (cliente de pruebas), `ruff`, `mypy`, `pyinstaller`.
- **Interfaz:** `react` y `react-dom` 19, `react-router` 8, `@tanstack/react-query` 5, `zustand` 5, `@tauri-apps/api` y `@tauri-apps/plugin-dialog` 2, `lucide-react` (iconos), `@fontsource-variable/inter` y `space-grotesk` (tipografías de marca incluidas en la aplicación). Desarrollo: `vite` 8, `typescript` 6.0, `tailwindcss` 4, `vitest` 5, Testing Library, `jsdom`, `@playwright/test`, `@tauri-apps/cli`, `openapi-typescript`.
- **Rust:** `tauri` 2, `tauri-plugin-dialog`, `tauri-plugin-single-instance`, `serde`, `serde_json`, `uuid`.

Respecto a lo previsto en la Fase 0: no se usó `tauri-plugin-shell` (DT-017); `keyring` y `httpx` se aplazan a la Fase 2, cuando existan claves y adaptadores; TypeScript quedó en 6.0 (DT-011); se añadieron `lucide-react`, las tipografías, `openapi-typescript` y `tauri-plugin-single-instance`.

### Pruebas ejecutadas

Detalle, cifras y cobertura de los diez puntos pedidos en [TESTING.md](TESTING.md).

- **Linux:** backend 95 aprobadas y 1 omitida de 96; interfaz 36 de 36; extremo a extremo 9 de 9; núcleo Rust 3 de 3; prueba de humo del backend empaquetado; prueba de humo de la ventana real bajo pantalla virtual.
- **Windows (integración continua):** __WINDOWS_SUMMARY__

### Pruebas pendientes en Windows 11

La lista completa, paso a paso, está en [TESTING.md](TESTING.md), sección «Pendiente: validación manual en Windows 11». En resumen: instalar con el instalador, abrir la ventana, crear un proyecto con «Examinar…», cerrar y reabrir, reiniciar el backend desde Configuración, comprobar Docker o Podman, eliminar un proyecto, y verificar en el Administrador de tareas que no quedan procesos al cerrar.

### Errores conocidos

No hay errores críticos conocidos.

1. **Fallo intermitente de una prueba de extremo a extremo**, observado una vez y no reproducido; causa no identificada. Detalle en [TESTING.md](TESTING.md).
2. **El instalador no está firmado.** Windows SmartScreen mostrará una advertencia y algún antivirus podría marcar el backend empaquetado (riesgo R4). La firma de código está prevista para la Fase 10 y requiere comprar un certificado.
3. **Arranque del backend empaquetado:** el ejecutable se descomprime en una carpeta temporal en cada inicio. En Linux tarda 1,2 s; en Windows puede tardar más, sobre todo con antivirus. La interfaz muestra «Iniciando» mientras tanto.
4. **Si la carpeta de un proyecto se mueve fuera de la aplicación**, el proyecto se marca como «carpeta no encontrada», pero aún no se puede volver a enlazar.
5. **Protección frente a programas locales:** el token protege frente a páginas web y a la red, no frente a software malicioso que ya se ejecute con tu cuenta de usuario (ver [SECURITY.md](SECURITY.md), sección 3).

### Limitaciones del entorno

- El desarrollo se hizo en un contenedor Linux en la nube. Para poder compilar y abrir la ventana allí se instalaron, solo en ese contenedor desechable, las bibliotecas de Tauri para Linux (WebKitGTK) y se usó una pantalla virtual. Eso demuestra que la aplicación funciona en Linux, **no** en Windows.
- Windows se cubre con un equipo de GitHub Actions (Windows Server). No es Windows 11, no tiene tu antivirus ni tu configuración, y nadie interactúa con la ventana.
- No hay Docker en marcha ni Ollama en el entorno de desarrollo.
- Git, Docker y Podman se detectan mediante sus comandos; no se probaron contra instalaciones reales en Windows.

### Recursos de identidad visual

Encontrados en el repositorio `Funcode-Studio-CB`: paleta, tipografías, emblema «FCB» (512 px) y logotipo completo (720 px), ambos solo para fondo oscuro y como imagen. Faltan, y conviene aportarlos: versión vectorial (SVG) o de 1024 px o más, y una variante para fondo claro (DT-020).

### Qué debe aprobarse para continuar

1. Validación de la aplicación en Windows 11 con la lista de [TESTING.md](TESTING.md).
2. Revisión visual de la interfaz y de la aplicación de la identidad de marca.
3. Conformidad con los cambios respecto a lo previsto: TypeScript 6 (DT-011), sin complemento de shell (DT-017), ubicación de migraciones y pruebas de extremo a extremo.
4. Conformidad con mantener la integración continua en GitHub Actions (el repositorio es público, por lo que no consume minutos de pago).
5. Aprobación explícita para iniciar la Fase 2.

### Próximos pasos (Fase 2, cuando se apruebe)

Interfaz de proveedores de IA con adaptadores `ollama` y `openai_compatible`; almacén de claves en el Administrador de credenciales de Windows; ficha de capacidades por modelo y enrutador por tarea (DT-019); esquema de la especificación; motor Analizador con preguntas de aclaración; pantalla «Nuevo proyecto» ampliada.

## Informe de la Fase 0 (aprobada)

Se inspeccionó el entorno, se comprobaron versiones, se diseñó la arquitectura, el sistema multiproveedor de IA y la seguridad, y se fijaron criterios de aceptación para las fases 0 a 11. No se escribió código.

### Riesgos identificados

| # | Riesgo | Impacto | Mitigación | Situación tras la Fase 1 |
|---|---|---|---|---|
| R1 | La ventana de Tauri no puede validarse en el entorno de desarrollo en la nube | Alto | Validar en el computador del usuario; compilación automática | Mitigado en parte: compila y se prueba en Windows en integración continua; falta la validación manual |
| R2 | Aislamiento incompleto sin Docker o Podman | Alto | Tres niveles con aviso y autorización explícita (DT-008) | Detección implementada; ejecución en fases 5 y 6 |
| R3 | La calidad del código generado depende del modelo | Alto | Capacidades por modelo, evaluaciones, generación por módulos | Sin cambios |
| R4 | Empaquetar Python: tamaño y avisos de antivirus | Medio | Instalador de prueba; firma en la Fase 10 | Backend empaquetado de unos 28 MB; avisos por comprobar en Windows 11 |
| R5 | Proyectos grandes superan el contexto de los modelos | Alto | Especificación modular y estado persistente | Base persistente de tareas implementada |
| R6 | Los proveedores cambian sus API y modelos | Medio | Adaptadores aislados | Sin cambios |
| R7 | Inyección de instrucciones desde contenido web | Medio | Contenido externo como datos | Sin cambios |
| R8 | TypeScript 7 recién publicado | Bajo | Verificar; alternativa 6.x | **Ocurrió.** Se usa 6.0.3 (DT-011) |
| R9 | Costos de API imprevistos | Medio | Registro de uso y límites | Sin cambios |
| R10 | Diferencias entre Windows, macOS y Linux | Medio | Pruebas por plataforma | Backend probado en Linux y Windows; macOS sin probar |
| R11 | Alcance muy amplio del producto | Alto | Fases estrictas | Sin cambios |
| R12 | Derechos de autor en investigación y multimedia | Medio | Registro de fuentes y licencias | Sin cambios |
