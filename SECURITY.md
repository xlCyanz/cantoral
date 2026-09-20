# Política de seguridad

## Versiones con soporte

Cantoral se distribuye como app de escritorio sin actualizaciones automáticas
todavía ([#19](https://github.com/xlCyanz/cantoral/issues/19)), así que solo se
publican arreglos para la última versión.

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

Cantoral es una app **local**: sin servidor, sin cuentas, sin telemetría y sin
llamadas de red. El modelo de amenaza relevante es, por tanto:

**Dentro de alcance**

- Ejecución de código a partir de un archivo de audio o video malicioso durante el escaneo
  (la lectura de metadatos va por [`lofty`](https://github.com/Serial-ATA/lofty-rs)).
- Lectura o escritura de archivos fuera de lo que la app necesita, a través del
  protocolo `asset`, del plugin `opener` o del comando `export_playlist`.
- Inyección en la webview a través de metadatos de archivo (etiquetas ID3, nombres
  de carpeta) que acaben renderizados o exportados.
- Corrupción o pérdida de la base de datos local provocada desde fuera.
- Escalada de los permisos declarados en `src-tauri/capabilities/default.json`.

**Fuera de alcance**

- Que los bundles no estén firmados y macOS/Windows avisen al abrirlos: es una
  limitación conocida y documentada en el README, no un fallo.
- Que un atacante con acceso físico y sesión abierta pueda leer `cantoral.db`: la
  base no está cifrada, por diseño, y el sistema operativo es quien protege el
  directorio de datos del usuario.
- Vulnerabilidades en dependencias sin una ruta de explotación en Cantoral; para eso
  están los PRs de Dependabot.

## Endurecimiento en curso

Hay un issue abierto y público sobre la configuración de seguridad de Tauri —CSP
nula, alcance del protocolo `asset` y permisos del plugin `opener`—:
[#14](https://github.com/xlCyanz/cantoral/issues/14). Está abierto porque no se
conoce ninguna ruta de explotación hoy; si encuentras una, repórtala en privado por
el canal de arriba en vez de comentar en ese issue.
