# Política de seguridad

## Versiones con soporte

Cantoral se distribuye como app de escritorio con actualizaciones automáticas
firmadas: cada instalación busca la última versión al abrirse y la instala desde
**Configuración → Actualizaciones**. Por eso solo se publican arreglos para la
última versión; la forma de recibir uno es actualizar.

Dos excepciones, documentadas en el README (**Limitaciones conocidas**): los Mac
Intel y las compilaciones sin la clave de firma del actualizador (un fork, por
ejemplo) no se actualizan solos, y hay que instalar la última versión a mano.

| Versión | Soporte |
|---------|---------|
| Última publicada | ✅ |
| Anteriores | ❌ — actualiza a la última |

## Reportar una vulnerabilidad

**No abras un issue público.**

Usa el reporte privado de GitHub:
**[Security → Report a vulnerability](https://github.com/xlCyanz/cantoral/security/advisories/new)**.

Incluye, en la medida de lo posible:

- versión de Cantoral y sistema operativo;
- qué se puede lograr con el fallo (leer archivos ajenos, ejecutar código, corromper la base…);
- pasos para reproducirlo, o un archivo de prueba que lo dispare;
- si lo tienes, una idea de por dónde iría el arreglo.

Respuesta inicial dentro de los **7 días**. Si se confirma, se acuerda contigo una
fecha de publicación y se te acredita en el aviso, salvo que prefieras lo contrario.

## Alcance

Cantoral es una app **local**: sin servidor, sin cuentas y sin telemetría. La
única petición de red que hace por su cuenta es la comprobación de actualizaciones
al abrirse, que no envía datos del usuario y se puede apagar en Configuración (ver
[La comprobación de actualizaciones](#la-comprobación-de-actualizaciones)). El
modelo de amenaza relevante es, por tanto:

**Dentro de alcance**

- Ejecución de código a partir de un archivo de audio o video malicioso durante el escaneo
  (la lectura de metadatos va por [`lofty`](https://github.com/Serial-ATA/lofty-rs)).
- Lectura o escritura de archivos fuera de lo que la app necesita, a través del
  protocolo `asset`, del plugin `opener` o del comando `export_playlist`.
- Inyección en la webview a través de metadatos de archivo (etiquetas ID3, nombres
  de carpeta) que acaben renderizados o exportados.
- Corrupción o pérdida de la base de datos local provocada desde fuera.
- Escalada de los permisos declarados en `src-tauri/capabilities/default.json`.
- Que la app instale una actualización que no esté firmada con la clave del
  proyecto, o que el actualizador pueda llevarse a otra URL que la configurada en
  `src-tauri/tauri.conf.json`.

**Fuera de alcance**

- Que los bundles no estén firmados y macOS/Windows avisen al abrirlos: es una
  limitación conocida y documentada en el README, no un fallo.
- Que un atacante con acceso físico y sesión abierta pueda leer `cantoral.db`: la
  base no está cifrada, por diseño, y el sistema operativo es quien protege el
  directorio de datos del usuario.
- Vulnerabilidades en dependencias sin una ruta de explotación en Cantoral; para eso
  están los PRs de Dependabot.

## Endurecimiento

La configuración de seguridad de Tauri se endureció en
[#14](https://github.com/xlCyanz/cantoral/issues/14) y hoy está así:

- **CSP** estricta en `src-tauri/tauri.conf.json`: scripts y fuentes solo del propio
  paquete, sin `eval`, y la webview no puede conectarse a ningún origen externo
  (`connect-src` se limita al IPC de Tauri). La búsqueda de actualizaciones la hace
  el núcleo en Rust, no la webview.
- **Protocolo `asset`** con alcance vacío de partida: al arrancar se abre solo al
  directorio de datos de la app y a las carpetas indexadas, y a una carpeta o un
  archivo nuevos cuando el usuario los añade o localiza.
- **Plugin `opener`** con sus permisos por defecto, que se usan para mostrar un
  archivo en el Finder o el Explorador; los archivos multimedia no se le pasan a
  otro programa, se reproducen dentro de la app.
- El actualizador no expone ningún permiso a la webview: solo dos comandos
  (`check_for_update`, `install_update`) implementados en `src-tauri/src/updates.rs`.

Si encuentras una forma de saltarte algo de esto, repórtala en privado por el canal
de arriba.

## Limitaciones conocidas

- **El alcance del protocolo `asset` solo crece mientras la app está abierta.**
  Al indexar una carpeta o localizar una pista se le da acceso a esa ruta, pero
  quitar la carpeta o borrar pistas del catálogo no lo retira: Tauri no ofrece
  una forma sencilla de revocar lo concedido. El alcance se vacía al cerrar y, al
  arrancar, se vuelve a abrir solo a las carpetas que siguen en la biblioteca, así
  que lo que queda de más dura como mucho hasta reiniciar. Sin una ruta de
  explotación conocida, se anota aquí en vez de tratarlo como fallo
  ([#131](https://github.com/xlCyanz/cantoral/issues/131)).
