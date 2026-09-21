## Instalación

**macOS** — abre el `.dmg` y arrastra Cantoral a Aplicaciones.
Si la compilación no está firmada, macOS dirá que la app «está dañada».
Para abrirla de todos modos:

```bash
xattr -dr com.apple.quarantine /Applications/Cantoral.app
```

**Windows** — usa el instalador `-setup.exe` (NSIS) o el `.msi`. Ambos
instalan el runtime WebView2 si hace falta, así que funcionan también en
Windows 10.

El `Cantoral.exe` suelto es portable pero **no** instala WebView2: úsalo
solo en equipos que ya lo tengan (Windows 11 lo trae de fábrica).

## Verificar la descarga

Los instaladores **no están firmados** mientras no existan los certificados, así
que el sistema avisará al abrirlos. Eso no dice que el archivo esté mal: dice que
nadie puede certificar de dónde viene. Estas sumas sí permiten comprobar que lo
que descargaste es exactamente lo que se publicó aquí.

En macOS o Linux, con `SHA256SUMS.txt` al lado de los instaladores:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

En Windows, con PowerShell:

```powershell
Get-FileHash .\Cantoral_0.2.0_x64-setup.exe -Algorithm SHA256
```

<!-- SHA256SUMS -->

---

¿Algo no funciona? [Reporta un fallo](https://github.com/xlCyanz/cantoral/issues/new?template=bug_report.yml).
