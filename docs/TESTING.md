# Estrategia de pruebas

Estado: diseño de la Fase 0. **Todavía no hay pruebas porque todavía no hay código.**

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
| Extremo a extremo | Playwright contra la interfaz web con backend real | Flujos completos |
| Ventana de escritorio | Manual con lista de comprobación en la plataforma principal; automatización con `tauri-driver` donde esté disponible | Arranque, sidecar, cierre |
| Seguridad | Pytest | Petición sin token, salida de la carpeta del proyecto, claves ausentes de registros y base de datos, escape del entorno aislado, inyección de instrucciones |
| Calidad estática | Ruff, mypy, ESLint, `tsc` | Estilo y tipos |

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
