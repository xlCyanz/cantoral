# Cantoral: logo y assets

Assets finales del logo (variante con nota). Úsalos tal cual, sin redibujarlos.

## Colores
- Índigo principal: #3A4D8F
- Tinta (gris frío oscuro): #1F2430
- Gris frío claro: #E6E8EE
- Fondo oscuro de la app: #161A23

## Símbolo (`svg/`)
Rejilla de 244 × 200. Es un libro abierto: la página izquierda es sólida con una corchea calada (máscara transparente) y la derecha son 4 líneas de letra.
- `symbol-indigo.svg`: sobre fondos claros (uso por defecto)
- `symbol-white.svg`: sobre índigo o fotos
- `symbol-light.svg`: modo oscuro (#E6E8EE sobre #161A23)
- `symbol-ink.svg`: monocromo oscuro
- `symbol-small-32.svg`: 3 líneas y líneas más gruesas; para mostrarlo entre 20 y 40 px
- `symbol-small-16.svg`: 2 líneas y sin nota; para mostrarlo a 20 px o menos

Regla: por debajo de 40 px usa la versión small que corresponda.

## Logotipo (símbolo + nombre)
El nombre no está convertido en trazos. Se escribe en vivo:
- Fuente: Bricolage Grotesque 700 (Google Fonts), letter-spacing -0.035em, line-height 1
- Texto: «Cantoral» (solo la C en mayúscula)
- Alto del símbolo: 1.14 × el tamaño de fuente
- Separación símbolo–texto: 0.27 × el tamaño de fuente
- Alineación: centrado vertical
- Color: igual que el símbolo (#3A4D8F en claro, #E6E8EE en oscuro)

## Ícono de app
- `svg/app-icon.svg`: 1024, a sangre, rx 22.5 % (Windows / Linux / web)
- `svg/app-icon-macos.svg`: 1024 con 100 px de margen, según la plantilla de íconos de macOS
- `png/app-icon-{16,24,32,48,64,128,256,512,1024}.png`: para armar el .ico de Windows (16–256) y el ícono de Linux
- `png/macos/icon_{16,32,64,128,256,512,1024}.png`: para armar el .icns
- `svg/favicon.svg`: favicon o ventana web

Los PNG de 16–24 px usan la versión de 2 líneas, los de 32–48 px la de 3 líneas y el resto la completa.

### Generar .ico / .icns
- Windows: `magick png/app-icon-{16,24,32,48,64,128,256}.png app.ico`
- macOS: crea `Cantoral.iconset/` con icon_16x16.png (16), icon_16x16@2x.png (32), icon_32x32.png (32), icon_32x32@2x.png (64), icon_128x128.png (128), icon_128x128@2x.png (256), icon_256x256.png (256), icon_256x256@2x.png (512), icon_512x512.png (512) e icon_512x512@2x.png (1024), sacados de `png/macos/`. Después ejecuta `iconutil -c icns Cantoral.iconset`.
- Electron / Tauri: apunta la config del ícono a app.ico, Cantoral.icns y png/app-icon-512.png.

## Dónde va dentro de la app
- Barra de título y cabecera de la barra lateral: símbolo 20 px (symbol-small-32) + «Cantoral» en Bricolage Grotesque 600, 15 px
- Pantalla Acerca de / splash: logotipo con el símbolo a 64 px
- Modo oscuro: symbol-light.svg

## No hacer
No cambies los colores, no le pongas degradados ni sombras, no lo estires y no redibujes la nota. Deja libre alrededor al menos el 25 % del alto del símbolo.
