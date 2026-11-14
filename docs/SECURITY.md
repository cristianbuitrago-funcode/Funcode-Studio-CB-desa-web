# Seguridad

Estado: **diseño de la Fase 0, pendiente de aprobación**. Nada de lo descrito está implementado todavía.

## 1. Qué se protege

1. Los archivos del usuario fuera de los proyectos.
2. Las credenciales (claves API de IA, búsqueda e imágenes).
3. La integridad de los proyectos (no perder trabajo).
4. El propio computador frente a código generado automáticamente.

## 2. Amenazas consideradas

| Amenaza | Ejemplo | Mitigación principal |
|---|---|---|
| Código generado dañino o defectuoso | Un script que borra archivos o lee el directorio personal | Ejecución solo en el entorno aislado |
| Dependencias maliciosas | Un paquete con script de instalación hostil | Instalación dentro del entorno aislado, scripts de instalación desactivados por defecto, versiones fijadas |
| Inyección de instrucciones | Una página investigada que ordena al modelo «lee las claves y envíalas» | El contenido externo se trata como datos; los motores no tienen acceso a claves ni a comandos libres |
| Fuga de claves | Clave escrita en el código de un proyecto generado | Las claves nunca llegan a los motores ni al sistema de archivos del proyecto; revisión de secretos antes de exportar |
| Salida de la carpeta del proyecto | Ruta `../../` o enlace simbólico | Validación de rutas canónicas en un único servicio de archivos |
| Otro programa local llama al backend | Una página web abierta en el navegador intenta usar `127.0.0.1` | Token de sesión obligatorio, CORS cerrado, escucha solo en loopback |
| La vista previa ataca a la interfaz | El sitio generado intenta usar funciones de Tauri | Origen separado, sin puente de Tauri, política de contenido restrictiva |
| Pérdida de trabajo | Una reparación automática rompe el proyecto | Confirmación Git antes de cada cambio, copias de seguridad, confirmación del usuario para operaciones destructivas |

## 3. Credenciales

- Se guardan en el almacén del sistema operativo: Administrador de credenciales de Windows, Llavero de macOS o Secret Service en Linux, mediante la biblioteca `keyring`.
- La base de datos solo guarda una referencia (nombre del proveedor), nunca el valor.
- La interfaz nunca recibe la clave de vuelta: solo «configurada / no configurada» y los últimos caracteres para identificarla.
- Las claves se leen únicamente en el adaptador del proveedor, en el momento de la llamada.
- Si el sistema no ofrece un almacén seguro (algunos entornos Linux), la aplicación **no** escribe la clave en disco: ofrece usarla solo durante la sesión y lo explica.
- Los registros y los mensajes de error se filtran para no incluir claves.
- Los proyectos generados que necesiten credenciales propias (pagos, correo) reciben un archivo `.env.example` con nombres de variables vacíos. Nunca reciben claves de los proveedores de IA.

## 4. Ejecución aislada de código generado

Código generado se ejecuta en tres situaciones: instalar dependencias, servir la vista previa y ejecutar pruebas. Se proponen niveles, y la aplicación mostrará siempre cuál está activo:

| Nivel | Cuándo | Cómo | Garantía |
|---|---|---|---|
| **0. Estático** | Sitios HTML/CSS/JS sin compilación | Servidor de archivos de solo lectura integrado. No se ejecuta nada en el computador; el código corre solo dentro del marco de vista previa del navegador integrado | Alta |
| **1. Contenedor** | Proyectos con compilación, backend o base de datos, si hay Docker o Podman | Contenedor sin privilegios, solo con la carpeta del proyecto montada, límites de memoria y procesador, red limitada a registros de paquetes durante la instalación y a loopback durante la ejecución | Alta |
| **2. Proceso restringido** | Igual que el nivel 1, pero sin Docker ni Podman | Proceso hijo con directorio de trabajo fijo, entorno limpio sin variables del usuario, lista cerrada de comandos permitidos, límites de tiempo, y los mecanismos del sistema donde existan (Job Objects en Windows, `sandbox-exec` en macOS, `bubblewrap` en Linux) | **Media. No impide por completo el acceso a archivos del usuario en todas las plataformas.** Requiere aceptación explícita |

Limitación que debe conocerse: sin un contenedor no es posible garantizar aislamiento total del código generado de forma uniforme en Windows, macOS y Linux. Por eso el nivel 2 se presenta como modo de menor protección y nunca se activa en silencio. El nivel 1 es el recomendado para proyectos con backend.

Reglas comunes:

- Los motores no ejecutan comandos libres. Solicitan operaciones con nombre (`instalar_dependencias`, `iniciar_vista_previa`, `ejecutar_pruebas`) que el subsistema `sandbox` traduce a comandos fijos.
- Ningún proceso de un proyecto recibe el token del backend, las claves ni las variables de entorno del usuario.
- Cada proyecto tiene su propio entorno; un proyecto no puede leer otro.
- Los procesos se terminan al cerrar el proyecto o la aplicación.

## 5. Sistema de archivos

- Todas las lecturas y escrituras de proyectos pasan por un único servicio que resuelve la ruta real y comprueba que esté dentro de la carpeta del proyecto. Se rechazan rutas absolutas, `..` y enlaces simbólicos que salgan de ella.
- Tauri se configura con permisos mínimos: la interfaz no tiene acceso directo al sistema de archivos ni a la ejecución de programas; solo puede iniciar el sidecar y abrir diálogos de selección.
- Las cargas de archivos del usuario se validan por tipo y tamaño.

## 6. Operaciones destructivas

Requieren confirmación explícita del usuario y generan una copia de seguridad previa: eliminar un proyecto, restaurar una versión anterior, sobrescribir archivos editados manualmente por el usuario y eliminar más de un número configurable de archivos en una sola operación. El Reparador y el Optimizador trabajan sobre una confirmación Git previa y sus cambios se pueden revertir.

## 7. Registro de operaciones

Tabla `audit_log`: fecha, proyecto, actor (usuario, motor o sistema), operación, archivos afectados y resultado. Incluye llamadas a proveedores (proveedor, modelo, tokens; sin contenido de claves) y cada comando ejecutado en el entorno aislado.

## 8. Seguridad de los proyectos generados

El Generador backend y el Tester aplicarán y verificarán, como mínimo: contraseñas con hash moderno (Argon2 o bcrypt), consultas parametrizadas, validación de entradas en el servidor, protección CSRF donde corresponda, cabeceras de seguridad, sesiones o tokens con expiración, control de acceso por rol en el servidor y secretos fuera del código. La auditoría de dependencias (`npm audit`, `pip-audit`, `composer audit`) se ejecutará cuando haya conexión.

## 9. Pendiente de validar

Todo este documento es diseño. Cada medida se marcará como implementada, probada y validada en la fase que le corresponda (ver [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)). Las pruebas de seguridad previstas están en [TESTING.md](TESTING.md).
