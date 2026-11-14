# Seguridad

Estado: Fase 1. Cada medida indica si está **implementada y probada** o si es **diseño** para una fase posterior. La sección 9 resume el estado.

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

## 3. Comunicación local entre la interfaz y el backend

Implementado y probado en la Fase 1 (`backend/src/fwa/security/local_auth.py`, `desktop/src-tauri/src/backend.rs`).

| Medida | Detalle |
|---|---|
| Solo loopback | El backend escucha en `127.0.0.1`. La dirección no es configurable. No es visible en la red local ni en Internet. |
| Puerto | Uno libre elegido por la aplicación en cada arranque. |
| Token de sesión | Aleatorio, 244 bits, nuevo en cada sesión. Se envía en `Authorization: Bearer`. No se acepta en la URL. Comparación en tiempo constante. Sin token no arranca el backend. |
| Validación de origen | Si la petición trae `Origin` y no es el de la interfaz de la aplicación, se rechaza con 403, aunque el token sea correcto. Así una página web abierta en un navegador no puede usar la API. |
| Validación de host | `Host` debe ser el loopback y puerto propios (400 si no). Frena ataques de DNS rebinding. |
| CORS | Lista cerrada: los orígenes de Tauri y, solo en modo desarrollo, el servidor de Vite. Sin credenciales. |
| CSRF | No se usan cookies ni sesiones implícitas: toda petición necesita el token en una cabecera que un sitio externo no puede conocer ni enviar. Por eso no hace falta un token CSRF adicional. |
| Sesiones | No hay sesiones en el servidor. El token vive en la memoria del núcleo de Tauri y de la interfaz; no se guarda en disco, en `localStorage` ni en la base de datos. |
| Documentación de la API | `/docs` y `/openapi.json` no están expuestos. |
| WebSockets | No se usan; se rechazan. |
| Cierre del backend | Al cerrar la ventana y también si la aplicación muere de forma abrupta (vigilancia de la entrada estándar). |
| Procesos duplicados | Una sola ventana y un solo backend por directorio de datos. |
| Permisos de la ventana | Solo eventos y el diálogo para elegir carpeta. Sin acceso directo al sistema de archivos ni a ejecutar programas. Política de contenido (CSP) que solo permite conectar con `127.0.0.1`. |
| Registros | Un filtro elimina el token y patrones de claves de todos los registros. |

Limitación conocida: cualquier programa que se ejecute con tu misma cuenta de usuario en el computador puede, en principio, leer la memoria o las variables de entorno de otros procesos tuyos y obtener el token. Esta protección está pensada frente a páginas web y a otros equipos de la red, no frente a software malicioso ya instalado con tus permisos.

## 4. Credenciales

Diseño para la Fase 2. En la Fase 1 la aplicación no guarda ninguna clave API y funciona sin ninguna.

- Se guardan en el almacén del sistema operativo. En Windows 11, el **Administrador de credenciales de Windows**, mediante la biblioteca `keyring` (en macOS el Llavero y en Linux Secret Service).
- No se guardan en SQLite, en archivos de configuración, en el código, en archivos de la interfaz, en repositorios Git ni en proyectos exportados. La base de datos solo guarda una referencia (nombre del proveedor).
- La interfaz nunca recibe la clave de vuelta: solo «configurada / no configurada» y los últimos caracteres para identificarla.
- Las claves se leen únicamente en el adaptador del proveedor, en el momento de la llamada.
- Si el sistema no ofrece un almacén seguro, la aplicación **no** escribe la clave en disco: ofrece usarla solo durante la sesión y lo explica.
- Los proyectos generados que necesiten credenciales propias (pagos, correo) reciben un archivo `.env.example` con nombres de variables vacíos. Nunca reciben claves de los proveedores de IA.
- La aplicación funciona sin claves externas con modelos locales y con todas las tareas exclusivamente locales.

## 5. Ejecución aislada de código generado

Decisión aprobada: Docker o Podman recomendado, pero opcional. Tres niveles; la aplicación muestra siempre cuál aplica.

| Nivel | Cuándo | Cómo | Garantía |
|---|---|---|---|
| **1. Sitios estáticos** | HTML, CSS y JavaScript sin servidor | Vista previa controlada desde un servidor de archivos de solo lectura limitado a la carpeta del proyecto. No se ejecuta código de servidor en el computador | Alta |
| **2. Backend con contenedores** | Proyectos con backend, si Docker o Podman están disponibles | Un entorno por proyecto, sin privilegios administrativos, con acceso solo a la carpeta del proyecto, límites de memoria y procesador, puertos publicados solo en loopback, red limitada, y posibilidad de detenerlo y eliminarlo | Alta |
| **3. Backend sin contenedores** | Proyectos con backend, sin Docker ni Podman | **Nada se ejecuta automáticamente.** Se permiten la edición y el análisis estático. Para iniciar un entorno de menor protección la aplicación muestra una advertencia con los riesgos y pide autorización explícita en cada proyecto | **Reducida. No equivale al aislamiento con contenedores** |

Estado:

- **Implementado y probado (Fase 1):** detección de Docker y Podman. Distingue «no instalado», «instalado pero detenido» y «disponible», y muestra el nivel que aplicaría. Solo consulta: nunca instala ni inicia nada.
- **Diseño (fases 5 y 6):** la ejecución en sí. Hoy la aplicación no ejecuta ningún código generado, porque todavía no genera código.

Limitación que debe conocerse: sin un contenedor no es posible garantizar aislamiento total del código generado de forma uniforme en Windows, macOS y Linux. En el nivel 3, con autorización, se usará un proceso con directorio de trabajo fijo, entorno limpio, lista cerrada de comandos, límites de tiempo y los mecanismos del sistema donde existan (Job Objects en Windows); aun así el código podría leer archivos del usuario.

Reglas comunes:

- Los motores no ejecutan comandos libres. Solicitan operaciones con nombre (`instalar_dependencias`, `iniciar_vista_previa`, `ejecutar_pruebas`) que el subsistema `sandbox` traduce a comandos fijos.
- Ningún proceso de un proyecto recibe el token del backend, las claves ni las variables de entorno del usuario.
- Cada proyecto tiene su propio entorno; un proyecto no puede leer otro.
- Los procesos se terminan al cerrar el proyecto o la aplicación.
- Ya en vigor: en el backend, solo `services/commands.py` puede ejecutar programas (Git, Docker y Podman, con argumentos fijos y tiempo límite). Una prueba automática lo verifica.

## 6. Sistema de archivos

Implementado y probado en la Fase 1 (`backend/src/fwa/security/paths.py`):

- `resolve_within`: resuelve una ruta dentro de la carpeta del proyecto y rechaza rutas absolutas (incluidas las de Windows, como `C:\…` y `\\servidor\…`), `..` y enlaces simbólicos que salgan de ella. Todas las operaciones de archivos de las fases siguientes pasarán por aquí.
- El directorio de trabajo debe ser una ruta absoluta y no puede estar dentro de los datos internos de la aplicación.
- Los nombres de carpeta se generan a partir del nombre del proyecto, sin separadores ni nombres reservados de Windows.
- La interfaz no tiene acceso directo al sistema de archivos.

Diseño (Fase 7): validación por tipo y tamaño de los archivos que cargue el usuario.

## 7. Operaciones destructivas

Implementado y probado en la Fase 1, para eliminar proyectos:

- Hay que escribir el nombre exacto del proyecto. No existe ninguna ruta de la API que elimine sin esa confirmación.
- Por defecto solo se quita el registro; los archivos se conservan.
- Si se pide borrar la carpeta, antes se guarda una copia en ZIP en los datos de la aplicación. Si la copia falla, no se borra nada.
- Nunca se borra un enlace simbólico, el directorio personal, la raíz de un disco, el directorio de proyectos completo ni una carpeta que contenga alguno de ellos.

Diseño (fases 8 y 9): la misma regla para restaurar versiones, sobrescribir archivos editados a mano y eliminaciones masivas. El Reparador y el Optimizador trabajarán sobre una confirmación Git previa.

## 8. Registro de operaciones

Implementado en la Fase 1: tabla `events` con fecha, proyecto, actor, operación, mensaje y datos. Registra creación, edición y eliminación de proyectos y cambios de configuración, y sobrevive a la eliminación del proyecto. Además hay un registro técnico rotativo en `logs/backend.log`.

Diseño (fases 2 y 6): llamadas a proveedores (proveedor, modelo, uso; sin claves) y cada comando ejecutado en el entorno aislado.

## 9. Estado de las medidas

| Medida | Estado |
|---|---|
| Comunicación local protegida (sección 3) | Implementada y probada en Linux; backend probado en Windows mediante integración continua |
| Validación de rutas y eliminación segura | Implementada y probada |
| Detección de Docker y Podman | Implementada y probada |
| Redacción de secretos en registros | Implementada y probada |
| Recuperación tras cierre inesperado | Implementada y probada (almacén de tareas) |
| Almacén de claves del sistema operativo | Diseño (Fase 2) |
| Ejecución aislada, niveles 1 a 3 | Diseño (fases 5 y 6) |
| Vista previa en origen separado | Diseño (fases 5 y 8) |
| Protección frente a inyección de instrucciones | Diseño (Fase 3) |

Las pruebas que respaldan cada medida están en [TESTING.md](TESTING.md).

## 10. Seguridad de los proyectos generados

Diseño (Fase 6).

El Generador backend y el Tester aplicarán y verificarán, como mínimo: contraseñas con hash moderno (Argon2 o bcrypt), consultas parametrizadas, validación de entradas en el servidor, protección CSRF donde corresponda, cabeceras de seguridad, sesiones o tokens con expiración, control de acceso por rol en el servidor y secretos fuera del código. La auditoría de dependencias (`npm audit`, `pip-audit`, `composer audit`) se ejecutará cuando haya conexión.

