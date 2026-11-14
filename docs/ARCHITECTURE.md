# Arquitectura de Funcode Web Architect

Versión del documento: Fase 0. Estado: **propuesta pendiente de aprobación**.

## 1. Visión general

La aplicación se compone de tres procesos locales con responsabilidades separadas:

```
┌──────────────────────────────────────────────────────────────┐
│ Ventana de escritorio (Tauri 2)                              │
│  ┌────────────────────────────┐   ┌───────────────────────┐  │
│  │ Interfaz React/TypeScript  │   │ Vista previa aislada  │  │
│  │ (dashboard, editor, IA…)   │   │ (origen distinto)     │  │
│  └─────────────┬──────────────┘   └──────────▲────────────┘  │
│  Núcleo Rust: inicia y vigila el backend,    │               │
│  diálogos de archivos, ciclo de vida         │               │
└────────────────┼─────────────────────────────┼───────────────┘
                 │ HTTP + SSE en 127.0.0.1     │ HTTP 127.0.0.1
                 │ (token de sesión)           │ (otro puerto)
┌────────────────▼─────────────────────────────┼───────────────┐
│ Backend local (Python · FastAPI)             │               │
│  API ─ Orquestador ─ 12 motores              │               │
│  Proveedores de IA · Seguridad · SQLite      │               │
└────────────────┬─────────────────────────────┼───────────────┘
                 │ lanza y controla            │
┌────────────────▼─────────────────────────────┴───────────────┐
│ Entorno de ejecución aislado (por proyecto)                  │
│  servidor de vista previa, instalación de dependencias,      │
│  pruebas del proyecto generado                               │
└──────────────────────────────────────────────────────────────┘
        │                                   │
   Sistema de archivos               Proveedores de IA
   (proyectos + Git)                 externos / Ollama local
```

- **Escritorio (Tauri + React):** solo interfaz. No contiene lógica de generación ni claves.
- **Backend (Python):** toda la lógica: orquestador, motores, proveedores de IA, base de datos interna, seguridad.
- **Entorno aislado:** el único lugar donde se ejecuta código generado.

## 2. Comunicación entre escritorio y backend

| Aspecto | Diseño |
|---|---|
| Arranque | El núcleo Rust de Tauri inicia el backend como proceso hijo («sidecar») y lo detiene al cerrar la aplicación. |
| Transporte | HTTP sobre `127.0.0.1` en un puerto libre elegido al arrancar. Nunca se escucha en `0.0.0.0`. |
| Autenticación | Tauri genera un token aleatorio por sesión y lo entrega al backend (variable de entorno) y a la interfaz (comando Tauri). Toda petición lo envía en una cabecera; sin token, se rechaza. |
| Órdenes y consultas | API REST con JSON, validada con Pydantic. El contrato OpenAPI que genera FastAPI se usa para generar los tipos TypeScript del cliente, de modo que interfaz y backend no puedan desincronizarse. |
| Progreso en vivo | Server-Sent Events (SSE): un flujo de eventos por proyecto (avance de tareas, registros, texto generado). |
| Operaciones largas | Nunca bloquean una petición: la API devuelve un identificador de tarea y el avance llega por SSE. Todo evento se guarda también en SQLite, así que la interfaz puede reconstruir el estado tras reiniciar. |
| Salud | `GET /health` para que Tauri sepa cuándo el backend está listo y lo reinicie si falla. |

Empaquetado: en desarrollo el backend se ejecuta con `uv`; para distribución se congela en un ejecutable con PyInstaller y se incluye como sidecar de Tauri, de modo que el usuario final no necesita instalar Python.

## 3. Backend: capas

```
api/            Rutas FastAPI. Sin lógica de negocio.
orchestrator/   Planificación y ejecución de tareas. Estado persistente.
engines/        Los 12 motores. Cada uno con contrato de entrada/salida.
providers/      Adaptadores de IA, búsqueda e imágenes.
services/       Proyectos, archivos, Git, copias de seguridad, credenciales.
sandbox/        Ejecución aislada de código generado.
security/       Permisos, validación de rutas, auditoría.
db/             Modelos SQLAlchemy y sesiones. Migraciones con Alembic.
```

Reglas de dependencia (se verificarán con una prueba automática):

- `api` → `orchestrator` y `services`. Nunca llama a un motor directamente.
- `engines` no se importan entre sí. Un motor recibe datos estructurados y devuelve datos estructurados; solo el orquestador los encadena.
- `engines` no conocen proveedores concretos: piden «un modelo para la tarea X» al enrutador de IA.
- Solo `sandbox` puede ejecutar procesos sobre proyectos generados. Solo `services/credentials` puede leer claves.

## 4. Orquestador

El orquestador convierte una descripción en un **grafo de tareas** persistente.

1. Recibe la descripción y la envía al Analizador, que produce una **especificación estructurada** (JSON validado con Pydantic y versionado).
2. Genera un plan: tareas con tipo, motor responsable, dependencias y criterios de aceptación.
3. Ejecuta las tareas cuyo requisito previo esté cumplido, seleccionando proveedor y modelo según la configuración por tarea.
4. Guarda cada resultado (artefacto) y cada evento en SQLite y en disco.
5. Ante un error: reintenta si es transitorio, deriva al Reparador si es de código, o pausa y solicita intervención.
6. Comprueba los criterios de aceptación antes de marcar la tarea como validada.

Estados de una tarea: `pendiente → lista → en_ejecución → implementada → probada → validada`, con salidas a `fallida`, `bloqueada` y `esperando_usuario`.

**Continuidad:** el estado vive en la base de datos, no en la conversación con un modelo. Cada llamada a la IA se construye a partir de la especificación, las decisiones registradas y los archivos relevantes del proyecto. Al reabrir la aplicación, las tareas `en_ejecución` interrumpidas vuelven a `lista` y el trabajo continúa.

**Proyectos grandes:** la especificación se divide en módulos (por ejemplo catálogo, carrito, pedidos, panel administrativo). Cada módulo es un subgrafo que se genera, prueba y valida por separado, con contexto limitado a lo que necesita.

## 5. Motores

| # | Motor | Entrada | Salida | ¿Usa IA? |
|---|---|---|---|---|
| 1 | Analizador | Descripción, adjuntos | Especificación + preguntas pendientes | Sí |
| 2 | Investigador | Especificación, consultas | Informe de referencias con fuentes | Sí + búsqueda web |
| 3 | Diseñador UI/UX | Especificación, referencias | Sistema de diseño (tokens, tipografía, componentes, estructura) | Sí |
| 4 | Arquitecto | Especificación | Plan técnico: tecnologías justificadas, carpetas, módulos, APIs | Sí |
| 5 | Generador frontend | Plan + sistema de diseño | Archivos de código | Sí |
| 6 | Generador backend | Plan | Archivos de código, APIs | Sí |
| 7 | Generador de bases de datos | Plan | Esquema, migraciones, datos iniciales, documentación | Sí |
| 8 | Multimedia | Especificación, archivos del usuario | Inventario de recursos con origen y licencia | Opcional |
| 9 | Tester | Proyecto | Informe de pruebas con evidencias | No (ejecución) / Sí (redactar casos) |
| 10 | Reparador | Informe de pruebas | Cambios aplicados y su justificación | Sí |
| 11 | Optimizador | Proyecto | Propuestas de mejora y cambios verificados | Sí + herramientas |
| 12 | Exportador | Proyecto validado | Carpeta independiente + ZIP + documentación | No |

Todos implementan el mismo contrato: `ejecutar(contexto, entrada) → resultado`, donde entrada y resultado son modelos Pydantic. Esto permite probar cada motor de forma aislada con un proveedor de IA simulado.

Los motores que escriben código lo hacen mediante **operaciones de archivo explícitas** (crear, modificar, eliminar) que el servicio de proyectos aplica y registra en Git. Así toda modificación es reversible y se puede explicar qué archivos cambiaron.

## 6. Sistema multiproveedor de IA

### 6.1 Adaptadores

Cada proveedor es un adaptador que implementa una interfaz común:

```
listar_modelos()            → modelos disponibles y sus capacidades
comprobar_conexion()        → estado y mensaje de error legible
generar(mensajes, opciones) → texto o salida estructurada, con flujo en vivo
uso                         → tokens consumidos y costo si el proveedor lo informa
```

Adaptadores iniciales:

| Adaptador | Cubre | Requiere clave |
|---|---|---|
| `ollama` | Modelos locales mediante Ollama | No |
| `openai_compatible` | OpenAI y cualquier servicio con API compatible (OpenRouter, Groq, LM Studio, vLLM, etc.) mediante URL base configurable | Depende del servicio; LM Studio local no |
| `anthropic` | Modelos Claude | Sí |
| `google` | Modelos Gemini | Sí |

Los modelos **no se escriben en el código**: se consultan al proveedor (`listar_modelos`) y el usuario elige. Así la aplicación no queda obsoleta cuando aparecen modelos nuevos.

Hay dos familias adicionales con interfaz propia: **búsqueda web** (para el Investigador) e **imágenes** (para Multimedia). Añadir un proveedor es añadir un archivo de adaptador y registrarlo; ningún motor cambia.

### 6.2 Enrutamiento por tarea

Una tabla configurable asigna a cada tipo de tarea un proveedor, un modelo y, opcionalmente, un respaldo:

```
análisis · investigación · diseño · frontend · backend · base_de_datos
revisión · reparación · contenido · imágenes
```

Si no hay asignación específica se usa el modelo predeterminado. Si el proveedor falla y existe respaldo, se usa y se registra. Si la tarea exige una capacidad que el modelo no tiene (por ejemplo salida estructurada o contexto amplio), el enrutador lo informa en lugar de fallar de forma silenciosa.

### 6.3 Modelos locales y externos

- **Local (Ollama u otro servidor local):** sin clave ni conexión. La aplicación detecta si el servicio responde y qué modelos hay instalados. La calidad y la velocidad dependen del hardware.
- **Externo:** con clave API guardada en el almacén de credenciales del sistema operativo.
- **Combinado:** por ejemplo análisis en un modelo local y programación en uno externo.

La salida estructurada se valida siempre con Pydantic. Si un modelo devuelve datos inválidos se reintenta con el error como contexto; los modelos locales pequeños fallan más en esto, por lo que la aplicación advertirá cuando un modelo no sea adecuado para una tarea.

### 6.4 Qué necesita conexión o clave

| Función | Sin conexión | Con modelo local | Requiere servicio externo |
|---|---|---|---|
| Abrir, editar, previsualizar, guardar proyectos | Sí | – | – |
| Historial, versiones, copias de seguridad | Sí | – | – |
| Pruebas locales, exportación, ZIP | Sí | – | – |
| Análisis, diseño, generación y reparación de código | – | Sí | Opcional (clave API del proveedor) |
| Investigación web | No | – | Conexión + proveedor de búsqueda (la mayoría con clave y costo) |
| Generación de imágenes | – | Solo si hay un modelo local de imágenes | Clave del servicio de imágenes |
| Instalar dependencias de un proyecto generado | No (salvo caché) | – | Conexión a registros de paquetes |
| Pagos en proyectos generados | – | – | Credenciales propias del comercio |

La interfaz indicará en cada función si requiere conexión, clave, suscripción o un servicio de pago. No se afirmará que un servicio es gratuito sin comprobarlo.

## 7. Datos y almacenamiento

**Base de datos interna (SQLite)**, en el directorio de datos de la aplicación. Tablas iniciales:

- `projects`, `specifications` (versionadas), `decisions`
- `tasks`, `task_dependencies`, `artifacts`, `events`
- `providers`, `task_routing`, `ai_usage`
- `research_sources`, `media_assets` (con origen y licencia)
- `test_runs`, `repairs`, `audit_log`, `settings`

**Proyectos generados:** cada uno es una carpeta en el directorio de trabajo elegido por el usuario, con su propio repositorio Git. Los metadatos de Funcode Web Architect se guardan fuera de esa carpeta, de modo que el proyecto queda limpio e independiente.

**Versiones:** cada operación del orquestador o edición del usuario produce una confirmación Git, lo que da historial, comparación y restauración. Si Git no está instalado se usa un mecanismo de instantáneas propio, más limitado, y se informa.

**Copias de seguridad:** archivo comprimido del proyecto más su registro en la base de datos, de forma manual y antes de cualquier operación destructiva.

## 8. Vista previa

- Los sitios estáticos se sirven desde un servidor local de solo lectura limitado a la carpeta del proyecto.
- Los proyectos con servidor propio se ejecutan dentro del entorno aislado (ver [SECURITY.md](SECURITY.md)).
- La vista previa se muestra en un marco con origen distinto al de la interfaz, sin acceso a las funciones de Tauri ni al token del backend.
- Tamaños: computador, tablet y móvil, más ancho libre.
- Los errores de consola y de red del sitio se capturan y se muestran en la consola de la aplicación.
- La selección de elementos para el editor visual usa un script inyectado solo en la vista previa, nunca en los archivos del proyecto.

## 9. Estructura de carpetas

```
/
├── desktop/                     Aplicación de escritorio
│   ├── src/
│   │   ├── app/                 Arranque, rutas, disposición general
│   │   ├── pages/               Dashboard, Nuevo proyecto, Entorno, IA, Configuración
│   │   ├── components/          Componentes reutilizables de interfaz
│   │   ├── features/
│   │   │   ├── projects/
│   │   │   ├── editor/
│   │   │   ├── preview/
│   │   │   ├── ai-settings/
│   │   │   └── settings/
│   │   ├── lib/api/             Cliente HTTP/SSE y tipos generados desde OpenAPI
│   │   └── styles/              Identidad visual (tokens)
│   └── src-tauri/               Núcleo Rust, permisos, configuración del sidecar
├── backend/
│   ├── pyproject.toml
│   ├── src/fwa/
│   │   ├── api/
│   │   ├── orchestrator/
│   │   ├── engines/
│   │   │   ├── analyzer/  researcher/  designer/  architecture/
│   │   │   ├── frontend/  backend/     database/  multimedia/
│   │   │   └── testing/   repair/      optimizer/ exporter/
│   │   ├── providers/           llm/  search/  image/
│   │   ├── services/
│   │   ├── sandbox/
│   │   ├── security/
│   │   └── db/
│   ├── migrations/              Alembic
│   └── tests/                   unit/  integration/
├── templates/                   Bases y componentes reutilizables (no sitios completos)
│   ├── ecommerce/ corporate/ educational/ informational/ custom/
├── tests/e2e/                   Pruebas de extremo a extremo de la aplicación
├── docs/
├── workspace/                   Solo para desarrollo; ignorado por Git
├── README.md
└── CHANGELOG.md
```

### Cambios respecto a la estructura inicial y su justificación

1. **`engines/` pasa a estar dentro de `backend/src/fwa/`.** Los motores son código Python que el orquestador importa. Como carpeta de primer nivel exigirían un segundo paquete instalable y configuración adicional sin aportar independencia real. La independencia se garantiza con contratos y con la prueba de reglas de dependencia.
2. **`backend/agents/` se elimina.** Su función coincide con la de los motores; mantener ambas carpetas duplicaría conceptos.
3. **Se añade `backend/.../sandbox/`**, separado de `security/`, porque la ejecución aislada es un subsistema propio.
4. **`desktop/src/` agrupa por funcionalidad (`features/`)** en lugar de tener `editor/`, `preview/` y `settings/` sueltos; es la misma idea, pero escala mejor.
5. **`workspace/generated-projects/` no forma parte del producto instalado.** En producción los proyectos van al directorio que elija el usuario. La carpeta del repositorio se usa solo durante el desarrollo.
6. **`templates/` contiene piezas reutilizables y estructuras base**, no plantillas de sitio completas, para cumplir el requisito de identidad propia en cada proyecto.

## 10. Requisitos de hardware y software

### Para usar la aplicación (estimación; se medirá en la Fase 11)

| | Mínimo | Recomendado |
|---|---|---|
| Sistema | Windows 10/11, macOS 12+ o Linux con WebKitGTK 4.1 | – |
| Procesador | 4 núcleos | 8 núcleos |
| Memoria | 8 GB | 16 GB |
| Disco | 2 GB más el espacio de los proyectos | SSD con 20 GB libres |
| Opcional | Git, Docker o Podman, Ollama, Node.js/PHP para previsualizar proyectos que los usen | – |

### Para IA local (orientativo; depende del modelo)

| Equipo | Qué se puede esperar |
|---|---|
| 8 GB de RAM, sin GPU | Modelos pequeños (hasta unos 4 mil millones de parámetros). Útiles para análisis sencillo y textos; poco fiables para programar proyectos completos. Lentos. |
| 16 GB de RAM o GPU de 8 GB | Modelos de 7 a 14 mil millones de parámetros. Programación de componentes y páginas sencillas. |
| 32 GB de RAM o GPU de 16 a 24 GB | Modelos de programación de 20 a 34 mil millones de parámetros. Resultados aceptables en proyectos pequeños y medianos, con más correcciones que un modelo externo avanzado. |

Los proyectos grandes con backend y base de datos requieren, en la práctica, un modelo externo de alta capacidad o un equipo local potente. La aplicación lo advertirá según el modelo configurado.

### Para desarrollar la aplicación

Node.js 22, pnpm, Rust estable, Python 3.12 o 3.13, uv, Git y las bibliotecas de sistema de Tauri para cada plataforma (WebView2 en Windows, Xcode Command Line Tools en macOS, WebKitGTK 4.1 en Linux).
