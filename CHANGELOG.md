# Historial de cambios

## [Sin publicar]

### Fase 1. Aplicación de escritorio — 2026-11-14

Estado: implementada y probada; pendiente de validación en Windows 11 y de aprobación.

**Construido**
- Backend local FastAPI: configuración, registro con redacción de secretos, errores uniformes, salud, migraciones al arrancar, apagado controlado, instancia única.
- Seguridad de la comunicación local: loopback, token por sesión, validación de origen y host, CORS restrictivo.
- Gestión de proyectos: crear, listar, abrir, editar y eliminar con confirmación y copia de seguridad.
- Ajustes, registro de actividad, flujo SSE, información del sistema y detección de Docker y Podman.
- Base persistente del orquestador: tareas, dependencias, idempotencia y recuperación tras cierres inesperados.
- Aplicación Tauri 2: inicio, vigilancia, reinicio y detención del backend; una sola instancia; permisos mínimos.
- Interfaz React: dashboard, proyectos, nuevo proyecto, detalle, inteligencia artificial (informativa), configuración e indicador de conexión.
- Identidad visual de Funcode Studio CB.
- Empaquetado del backend con PyInstaller, pruebas de humo e integración continua en Linux y Windows con instalador de Windows.

**Archivos**
- Añadidos: `backend/` (código, migraciones, pruebas, empaquetado), `desktop/` (interfaz, núcleo Tauri, pruebas, guiones), `.github/workflows/ci.yml`, `.gitattributes`.
- Modificados: `README.md`, `CHANGELOG.md`, `.gitignore` y todos los documentos de `docs/`.

**Dependencias añadidas:** ver `docs/PROJECT_STATUS.md`.

**Cambios respecto a lo previsto en la Fase 0**
- TypeScript 6.0.3 en lugar de 7.0: el generador de tipos OpenAPI no es compatible con la 7 (DT-011).
- El backend se inicia con la biblioteca estándar de Rust, sin `tauri-plugin-shell` (DT-017), y se apaga al cerrarse su entrada estándar (DT-016).
- Migraciones dentro del paquete del backend; pruebas de extremo a extremo en `desktop/e2e/`.
- Niveles de aislamiento renumerados de 1 a 3 según la decisión aprobada (DT-008).

**Pruebas:** ver `docs/TESTING.md`.

**Pendiente:** validación manual en Windows 11 y aprobación para iniciar la Fase 2.

### Fase 0. Preparación y arquitectura — 2026-11-14

**Construido**
- Documentación inicial: arquitectura, plan de desarrollo, decisiones técnicas, seguridad, estrategia de pruebas y estado del proyecto.
- Inspección del entorno de desarrollo y comprobación de versiones de dependencias.

**Archivos**
- Añadidos: `README.md`, `CHANGELOG.md`, `.gitignore`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/TECHNICAL_DECISIONS.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/PROJECT_STATUS.md`.

**Dependencias añadidas:** ninguna.

**Pruebas:** ninguna de software; no existe código todavía.

**Aprobada** por el usuario el 2026-11-14, con Windows 11 como plataforma principal, aislamiento en tres niveles y cuatro ajustes de arquitectura.
