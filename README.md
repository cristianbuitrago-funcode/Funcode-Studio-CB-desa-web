# Funcode Web Architect

Producto de **Funcode Studio CB**. Aplicación de escritorio que crea sitios web y aplicaciones web reales a partir de descripciones en lenguaje natural: analiza la necesidad, investiga referencias, diseña, programa, prueba, corrige y exporta proyectos independientes.

> **Estado actual: Fase 0 (preparación y arquitectura) terminada y pendiente de aprobación.**
> Todavía no existe código de la aplicación. Este repositorio contiene únicamente la arquitectura, el plan y las decisiones técnicas propuestas.

## Qué es y qué no es

- Es una herramienta de desarrollo que funciona en el computador del usuario, con proyectos y base de datos locales.
- Puede usar inteligencia artificial externa (mediante API), local (por ejemplo Ollama) o una combinación de ambas.
- No es un generador de plantillas ni promete terminar cualquier proyecto con una sola instrucción: los proyectos grandes se dividen en módulos y deben superar pruebas antes de considerarse terminados.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, comunicación escritorio-backend, sistema de IA, estructura de carpetas |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Fases 0 a 11 con tareas y criterios de aceptación |
| [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md) | Registro de decisiones técnicas y su estado de aprobación |
| [docs/SECURITY.md](docs/SECURITY.md) | Modelo de amenazas, aislamiento, credenciales |
| [docs/TESTING.md](docs/TESTING.md) | Estrategia de pruebas y vocabulario de estados |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Estado actual, entorno inspeccionado, qué falta aprobar |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios por fase |

## Tecnologías propuestas

- **Escritorio:** Tauri 2, React, TypeScript, Tailwind CSS, Vite.
- **Backend local:** Python, FastAPI, Pydantic.
- **Datos internos:** SQLite, SQLAlchemy, Alembic.
- **Pruebas:** Pytest, Vitest, Playwright.

Las versiones concretas y su justificación están en [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md).

## Cómo continuar el desarrollo en otra sesión

1. Leer [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md): indica la fase vigente y lo pendiente.
2. Revisar las decisiones con estado «Propuesta» en [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md).
3. Seguir la fase correspondiente de [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md). No se avanza de fase sin validar la anterior.
