# Plan de desarrollo

Regla general: no se inicia una fase sin que la anterior esté validada y aprobada. Cada fase termina con un informe en [PROJECT_STATUS.md](PROJECT_STATUS.md) y una entrada en [CHANGELOG.md](../CHANGELOG.md).

Criterios comunes a todas las fases (además de los propios):

- La aplicación inicia y las fases anteriores siguen funcionando (pruebas de regresión en verde).
- Las pruebas de la fase se ejecutaron y su resultado real está registrado.
- Sin errores críticos conocidos; los no críticos quedan documentados.
- Documentación actualizada.
- Cada funcionalidad está clasificada como implementada, probada, validada, pendiente o bloqueada.

---

## Fase 0. Preparación y arquitectura — *terminada, pendiente de aprobación*

**Entregables:** inspección del entorno, arquitectura, sistema de IA, seguridad, estructura, riesgos, dependencias, documentación, criterios de aceptación.

**Aceptación:**
- [x] Entorno inspeccionado y versiones comprobadas.
- [x] Los ocho documentos obligatorios existen.
- [x] Riesgos y limitaciones identificados.
- [ ] El usuario aprueba las decisiones marcadas como «requiere decisión del usuario».

## Fase 1. Aplicación de escritorio

**Tareas:** proyecto Tauri 2 + React + TypeScript + Tailwind; backend FastAPI con SQLite y Alembic; arranque del sidecar con token; cliente tipado desde OpenAPI; navegación; dashboard; gestión inicial de proyectos (crear, listar, abrir, renombrar, archivar, eliminar con confirmación); identidad visual base; integración continua.

**Aceptación:**
- La ventana abre en la plataforma principal y muestra el estado del backend.
- Si el backend se detiene, la interfaz lo informa y se recupera al reiniciarlo.
- Una petición sin token es rechazada (prueba automática).
- Crear un proyecto genera su carpeta, su repositorio Git y su registro; persiste tras reiniciar.
- Eliminar un proyecto pide confirmación y crea copia de seguridad.
- Todos los botones visibles ejecutan una acción real; las secciones aún no construidas se muestran como «disponible en la fase N», sin controles falsos.
- Pruebas: unitarias del backend, de componentes y una prueba de extremo a extremo del flujo «crear proyecto».
- Se genera un instalador de prueba en la plataforma principal.

## Fase 2. Analizador de instrucciones

**Tareas:** interfaz de proveedores y adaptadores `ollama` y `openai_compatible` (los mínimos para que el motor funcione); pantalla «Inteligencia Artificial» inicial (añadir proveedor, clave, comprobar conexión, elegir modelo); enrutador por tarea; esquema de la especificación; motor Analizador; preguntas de aclaración; estimación de complejidad; pantalla «Nuevo proyecto».

**Aceptación:**
- Con un modelo configurado, la descripción de ejemplo de la tienda de tecnología produce una especificación válida con tipo de proyecto, páginas, funcionalidades, roles, datos necesarios y riesgos.
- Un conjunto de al menos 12 descripciones (una por categoría de proyecto) se clasifica correctamente; el resultado por modelo queda registrado.
- Ante una descripción ambigua formula como máximo cinco preguntas concretas; ante una completa, ninguna.
- La clave no aparece en la base de datos, en registros ni en respuestas de la API (prueba automática).
- Sin proveedor configurado, la interfaz explica qué falta en lugar de fallar.
- La especificación se puede editar, se versiona y sobrevive al reinicio.
- Las pruebas del motor funcionan con un proveedor simulado, sin conexión.

## Fase 3. Investigación web

**Tareas:** interfaz de proveedores de búsqueda y primer adaptador; obtención y lectura de páginas con límites; motor Investigador; registro de fuentes; extracción de patrones (estructura, navegación, tono visual) sin copiar contenido; adaptadores `anthropic` y `google`.

**Aceptación:**
- Cada afirmación del informe enlaza con una fuente registrada con URL y fecha.
- Sin conexión o sin proveedor, la función se muestra no disponible con su motivo y el resto del flujo continúa.
- El informe no contiene código, textos extensos ni imágenes de los sitios consultados (comprobación automática de similitud).
- El contenido de las páginas se trata como datos: una página de prueba con instrucciones maliciosas no altera el comportamiento del motor.
- Se respeta `robots.txt` y se limita la frecuencia de peticiones.

## Fase 4. Motor de diseño

**Tareas:** esquema del sistema de diseño (color, tipografía, espaciado, radios, sombras, movimiento); motor Diseñador; estructura de páginas y componentes; comprobación automática de contraste; vista de la propuesta con aprobación o ajuste.

**Aceptación:**
- Tres especificaciones de sectores distintos producen sistemas de diseño visiblemente distintos (paleta, tipografía y disposición).
- Todas las combinaciones de texto y fondo cumplen contraste WCAG AA (verificado por programa).
- El diseño define el comportamiento en móvil, tablet y computador.
- El usuario puede pedir cambios y la propuesta se versiona.

## Fase 5. Generador frontend

**Tareas:** motor Arquitecto (parte de frontend); motor Generador frontend; operaciones de archivo con registro en Git; servidor de vista previa de nivel 0; pruebas automáticas básicas del sitio generado; exportación básica.

**Aceptación:**
- Un sitio informativo y una landing page se generan completos, sin errores de consola, con navegación y formularios operativos.
- Ningún enlace interno roto ni botón sin comportamiento (verificado con Playwright).
- Se visualiza correctamente en los tres tamaños.
- La exportación básica abre y funciona fuera de la aplicación.
- Cada generación indica qué archivos creó o modificó.

## Fase 6. Backend y bases de datos

**Tareas:** subsistema `sandbox` (niveles 1 y 2); motores Arquitecto (completo), Generador backend y Generador de bases de datos; autenticación, roles y CRUD; migraciones y datos de demostración identificados como tales; pruebas de API.

**Aceptación:**
- El proyecto de ejemplo (tienda con registro, carrito, pedidos y panel administrativo) se genera por módulos y supera sus pruebas de API y de extremo a extremo.
- La tecnología elegida queda justificada por escrito; un sitio estático no recibe backend ni base de datos.
- Contraseñas con hash, consultas parametrizadas y control de acceso por rol verificados con pruebas.
- El código del proyecto se ejecuta solo en el entorno aislado; la prueba de escape (leer un archivo fuera del proyecto) falla en el nivel 1.
- Ninguna clave de proveedores de IA aparece en el proyecto.

## Fase 7. Generador multimedia

**Tareas:** inventario de recursos necesarios; carga desde el computador; adaptador de generación de imágenes; optimización (tamaño, formatos); registro de origen y licencia.

**Aceptación:**
- Cada recurso tiene origen y licencia registrados (usuario, generado, de demostración).
- Los recursos de demostración están marcados y se enumeran antes de exportar.
- En proyectos comerciales no se generan fotografías ni datos de productos presentados como reales.
- Sin servicio de imágenes configurado, el proyecto se completa con marcadores identificados.

## Fase 8. Editor y vista previa

**Tareas:** explorador de archivos; editor Monaco; consola; vista responsive completa; historial, comparación y restauración; selección visual de elementos; panel de propiedades; modificaciones por instrucción sobre el elemento seleccionado.

**Aceptación:**
- La instrucción de ejemplo sobre el encabezado modifica solo los archivos necesarios, lista los archivos cambiados y es reversible.
- Editar y guardar actualiza la vista previa.
- Comparar y restaurar versiones funciona; restaurar pide confirmación.
- La vista previa no puede acceder a funciones de Tauri ni al backend (prueba automática).

## Fase 9. Testing y reparación

**Tareas:** motor Tester completo (navegación, formularios, API, base de datos, responsive, consola, accesibilidad, rendimiento, seguridad básica); motor Reparador con ciclo limitado de corrección y repetición; informes con evidencias.

**Aceptación:**
- En un conjunto de proyectos con errores introducidos a propósito, el Tester detecta al menos el 90 % y el resultado real queda registrado.
- El Reparador registra causa, cambio y resultado de la repetición de pruebas; se detiene tras un máximo de intentos y solicita intervención.
- Ningún informe declara «funciona» sin una ejecución asociada.
- Ninguna reparación elimina archivos sin autorización.

## Fase 10. Exportación y publicación

**Tareas:** motor Exportador completo; ZIP; SQL y migraciones; documentación de instalación y despliegue; configuraciones para tipos de alojamiento habituales; revisión de secretos; instaladores firmados de la aplicación.

**Aceptación:**
- El proyecto exportado se instala y funciona en un entorno limpio siguiendo solo su documentación (verificado en contenedor).
- No contiene referencias a Funcode Web Architect necesarias para funcionar, ni secretos.
- Incluye la lista de datos y recursos de demostración que deben sustituirse.

## Fase 11. Escalabilidad y auditoría

**Tareas:** motor Optimizador; gestión de proyectos grandes (contexto, generación por módulos en paralelo); medición de rendimiento y de requisitos reales de hardware; compatibilidad en los tres sistemas; auditoría de seguridad y de dependencias; revisión integral.

**Aceptación:**
- Un proyecto grande (más de 30 pantallas y 15 tablas) se genera, pausa, continúa y valida por módulos.
- Requisitos de hardware medidos y publicados.
- Auditoría de seguridad sin hallazgos críticos abiertos.
- Todas las pruebas de regresión en verde en las plataformas admitidas.
