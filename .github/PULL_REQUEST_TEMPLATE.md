## Qué cambia

<!-- Un párrafo: qué hace este PR y, sobre todo, por qué. El diff ya cuenta el «qué». -->

## Issue relacionado

<!-- «Closes #12» cierra el issue al fusionar. Si no hay issue y el cambio no es trivial,
     abre uno primero: así se acuerda el enfoque antes de revisar código. -->

Closes #

## Tipo de cambio

- [ ] 🐛 Corrección de un fallo
- [ ] ✨ Función nueva
- [ ] ⚡ Rendimiento
- [ ] ♿ Accesibilidad
- [ ] 🔒 Seguridad
- [ ] 📝 Documentación
- [ ] 🔧 Mantenimiento, dependencias o CI
- [ ] 💥 Cambio incompatible (rompe el comportamiento actual o el esquema)

## Cómo se probó

<!-- Qué hiciste para convencerte de que funciona. Pasos concretos, no «lo probé». -->

- [ ] `pnpm dev` (interfaz en el navegador)
- [ ] `pnpm tauri dev` (app completa) — **obligatorio si tocaste Rust, SQLite o el escaneo**
- [ ] macOS
- [ ] Windows

## Comprobaciones

```bash
pnpm exec tsc --noEmit
pnpm test
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] Las cuatro pasan en local
- [ ] Hay pruebas para el comportamiento nuevo o corregido
- [ ] El PR hace **una** cosa (nada de arreglar un bug y reformatear medio archivo a la vez)
- [ ] Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/)
- [ ] Añadí una línea a `CHANGELOG.md` bajo `Sin publicar`
- [ ] Actualicé el `README.md` si cambió algo que ahí se describe

## Si tocaste la base de datos

- [ ] La migración es **aditiva** (`ALTER TABLE … ADD COLUMN`), sin borrar ni cambiar columnas existentes
- [ ] Una base creada con la versión anterior sigue abriendo sin perder datos
- [ ] Los campos que edita el usuario (`tono`, `bpm`, `ocasion`, `fav`, etiquetas) siguen sobreviviendo a un re-escaneo

## Si tocaste la interfaz

- [ ] Los colores salen de variables CSS (`var(--…)`), nunca de valores fijos
- [ ] Se ve bien en tema claro **y** oscuro
- [ ] Los controles nuevos son alcanzables con teclado y tienen `aria-label` cuando solo muestran un icono
- [ ] Me suscribí al store con selectores (`useStore(s => s.x)`), no con `useStore()` a secas

## Capturas

<!-- Antes / después, si el cambio se ve. Arrástralas aquí. -->

## Notas para quien revise

<!-- Decisiones discutibles, cosas que dejaste fuera a propósito, dudas abiertas. -->
