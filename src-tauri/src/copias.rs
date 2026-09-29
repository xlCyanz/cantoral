// Copias automáticas de la base antes de lo que no se puede deshacer (#143).
//
// Quitar una carpeta, restaurar un respaldo y fusionar duplicados borran lo
// más costoso de la biblioteca —favoritos, ocasiones, artistas corregidos y
// letras escritas a mano— y la única red era una copia manual que casi nadie
// recuerda hacer. Antes de cada una, el núcleo guarda aquí una copia de la
// base; restaurarla desde Configuración es el «deshacer».
//
// Las copias viven en `<datos de la app>/respaldos/`, junto a la base: no
// sustituyen una copia a otro disco, y Configuración lo dice.

use anyhow::{anyhow, Result};
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Cuántas copias automáticas se conservan. Una base de una iglesia pesa pocos
/// MB; cinco copias no se notan en el disco.
pub const CONSERVAR: usize = 5;

/// Carpeta de las copias, junto a la base de datos.
pub fn carpeta(db_path: &Path) -> PathBuf {
    db_path.parent().unwrap_or_else(|| Path::new(".")).join("respaldos")
}

/// Qué acción llevó a hacer la copia. Va en el nombre del archivo, para que la
/// lista de Configuración pueda decir «antes de quitar una carpeta».
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Motivo {
    QuitarCarpeta,
    Restaurar,
    Fusionar,
}

impl Motivo {
    const TODOS: [Motivo; 3] = [Motivo::QuitarCarpeta, Motivo::Restaurar, Motivo::Fusionar];

    fn clave(self) -> &'static str {
        match self {
            Motivo::QuitarCarpeta => "quitar-carpeta",
            Motivo::Restaurar => "restaurar",
            Motivo::Fusionar => "fusionar",
        }
    }

    /// Lo que no llegó a hacerse, para el error de una copia fallida.
    fn no_hecho(self) -> &'static str {
        match self {
            Motivo::QuitarCarpeta => "no se quitó la carpeta",
            Motivo::Restaurar => "no se restauró el respaldo",
            Motivo::Fusionar => "no se fusionaron las copias",
        }
    }
}

/// Una copia automática, tal como la enseña Configuración.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopiaAutomatica {
    pub ruta: String,
    /// Hora local en que se hizo, `YYYY-MM-DDTHH:MM:SS` (sin zona: es la del
    /// equipo, igual que la del nombre del archivo).
    pub fecha: String,
    /// `quitar-carpeta`, `restaurar` o `fusionar`.
    pub motivo: String,
    pub tamano: u64,
}

const PREFIJO: &str = "cantoral-";
const EXTENSION: &str = ".db";
/// `YYYY-MM-DD-HHMMSS`: ordena igual como texto que como fecha.
const FORMATO_FECHA: &str = "%Y-%m-%d-%H%M%S";
const LARGO_FECHA: usize = "2026-09-29-143005".len();

/// La fecha, el motivo y el número de desempate que lleva el nombre de una
/// copia nuestra, o `None` si el archivo no es una copia automática.
///
/// Dos copias en el mismo segundo llevan un sufijo `-2`, `-3`…; el número
/// cuenta para ordenarlas, porque como texto `-2` quedaría antes que nada.
fn leer_nombre(nombre: &str) -> Option<(chrono::NaiveDateTime, u32, Motivo)> {
    let resto = nombre.strip_prefix(PREFIJO)?.strip_suffix(EXTENSION)?;
    let fecha = resto.get(..LARGO_FECHA)?;
    let fecha = chrono::NaiveDateTime::parse_from_str(fecha, FORMATO_FECHA).ok()?;
    let cola = resto.get(LARGO_FECHA..)?.strip_prefix('-')?;
    Motivo::TODOS.into_iter().find_map(|m| {
        let tras = cola.strip_prefix(m.clave())?;
        if tras.is_empty() {
            return Some((fecha, 1, m));
        }
        let n = tras.strip_prefix('-')?.parse::<u32>().ok()?;
        Some((fecha, n, m))
    })
}

/// Las copias automáticas de `dir`, de la más nueva a la más antigua.
///
/// Una carpeta que no existe es que todavía no hay ninguna, no un error.
pub fn listar(dir: &Path) -> Result<Vec<CopiaAutomatica>> {
    let entradas = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(err.into()),
    };
    let mut copias: Vec<((chrono::NaiveDateTime, u32), CopiaAutomatica)> = Vec::new();
    for entrada in entradas.flatten() {
        let nombre = entrada.file_name().to_string_lossy().to_string();
        let Some((fecha, n, motivo)) = leer_nombre(&nombre) else { continue };
        let tamano = entrada.metadata().map(|m| m.len()).unwrap_or(0);
        copias.push((
            (fecha, n),
            CopiaAutomatica {
                ruta: entrada.path().to_string_lossy().to_string(),
                fecha: fecha.format("%Y-%m-%dT%H:%M:%S").to_string(),
                motivo: motivo.clave().to_string(),
                tamano,
            },
        ));
    }
    copias.sort_by_key(|c| std::cmp::Reverse(c.0));
    Ok(copias.into_iter().map(|(_, c)| c).collect())
}

/// Borra las copias más antiguas hasta dejar `conservar`.
///
/// `proteger` no se borra nunca aunque le toque: es el respaldo que se está
/// restaurando, y borrarlo antes de copiarlo sería perder las dos cosas.
pub fn rotar(dir: &Path, conservar: usize, proteger: Option<&Path>) -> Result<()> {
    let protegido = proteger.map(|p| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf()));
    for copia in listar(dir)?.into_iter().skip(conservar) {
        let ruta = PathBuf::from(&copia.ruta);
        let ruta_real = std::fs::canonicalize(&ruta).unwrap_or_else(|_| ruta.clone());
        if protegido.as_ref() == Some(&ruta_real) {
            continue;
        }
        if let Err(err) = std::fs::remove_file(&ruta) {
            log::error!("could not remove the old automatic backup {}: {err}", ruta.display());
        }
    }
    Ok(())
}

/// Guarda una copia de la base abierta en `conn` dentro de `dir`, y deja las
/// últimas `CONSERVAR`.
///
/// Con `VACUUM INTO`: SQLite escribe una foto coherente de lo confirmado,
/// incluido lo que aún está en el WAL, sin cerrar la conexión ni hacer
/// checkpoint. Se escribe a un nombre provisional y se renombra al final, para
/// que una copia a medias —disco lleno— nunca aparezca en la lista como buena.
///
/// Si la copia falla, el error dice que la acción no se hizo: quien llama no
/// debe seguir. Si falla solo la rotación, la copia ya está y basta anotarlo.
pub fn guardar(
    conn: &Connection,
    dir: &Path,
    motivo: Motivo,
    proteger: Option<&Path>,
) -> Result<PathBuf> {
    let falla = |causa: &dyn std::fmt::Display| {
        anyhow!(
            "No se pudo guardar la copia automática de la biblioteca, así que {}. ({causa})",
            motivo.no_hecho()
        )
    };

    std::fs::create_dir_all(dir).map_err(|err| falla(&err))?;
    let sello = chrono::Local::now().format(FORMATO_FECHA).to_string();
    // El desempate cuenta entre todos los motivos: dos copias del mismo segundo
    // tienen que quedar ordenadas aunque una sea de fusionar y otra de quitar.
    let nombre = |m: Motivo, n: u32| match n {
        1 => format!("{PREFIJO}{sello}-{}{EXTENSION}", m.clave()),
        n => format!("{PREFIJO}{sello}-{}-{n}{EXTENSION}", m.clave()),
    };
    let mut n = 1;
    while Motivo::TODOS.into_iter().any(|m| dir.join(nombre(m, n)).exists()) {
        n += 1;
    }
    let destino = dir.join(nombre(motivo, n));
    let provisional = dir.join(format!(
        ".{}.tmp",
        destino.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
    ));
    let _ = std::fs::remove_file(&provisional);

    let escrita = conn
        .execute("VACUUM INTO ?1", [provisional.to_string_lossy().as_ref()])
        .map_err(|err| falla(&err))
        .and_then(|_| std::fs::rename(&provisional, &destino).map_err(|err| falla(&err)));
    if let Err(err) = escrita {
        let _ = std::fs::remove_file(&provisional);
        return Err(err);
    }
    log::info!("automatic backup written to {}", destino.display());

    if let Err(err) = rotar(dir, CONSERVAR, proteger) {
        log::error!("could not rotate the automatic backups: {err}");
    }
    Ok(destino)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    struct Dir(PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("cantoral-copias-{name}"));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Dir(dir)
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn con_pistas(n: usize) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(db::SCHEMA).unwrap();
        let fid = db::add_folder(&conn, "/m", "m", true).unwrap();
        for i in 0..n {
            db::upsert_track(
                &conn,
                fid,
                &format!("/m/{i}.mp3"),
                "t",
                "a",
                "al",
                1,
                "MP3",
                false,
                1,
                1,
            )
            .unwrap();
        }
        conn
    }

    fn falsa(dir: &Path, nombre: &str) -> PathBuf {
        let p = dir.join(nombre);
        std::fs::write(&p, b"x").unwrap();
        p
    }

    #[test]
    fn the_copy_holds_the_library_as_it_was() {
        let dir = Dir::new("contenido");
        let conn = con_pistas(3);
        let copia = guardar(&conn, &dir.0, Motivo::QuitarCarpeta, None).unwrap();

        let info = db::inspect_backup(&copia).unwrap();
        assert_eq!(info.tracks, 3);
        assert_eq!(info.folders, 1);
        let lista = listar(&dir.0).unwrap();
        assert_eq!(lista.len(), 1);
        assert_eq!(lista[0].motivo, "quitar-carpeta");
        assert!(lista[0].tamano > 0);
        // Nada provisional se queda por ahí.
        assert_eq!(std::fs::read_dir(&dir.0).unwrap().count(), 1);
    }

    #[test]
    fn never_more_than_the_limit_are_kept() {
        let dir = Dir::new("rotacion");
        let conn = con_pistas(1);
        for _ in 0..(CONSERVAR + 3) {
            guardar(&conn, &dir.0, Motivo::Fusionar, None).unwrap();
        }
        assert_eq!(listar(&dir.0).unwrap().len(), CONSERVAR);
    }

    #[test]
    fn rotation_drops_the_oldest_first_and_leaves_other_files_alone() {
        let dir = Dir::new("antiguas");
        let vieja = falsa(&dir.0, "cantoral-2026-01-01-080000-restaurar.db");
        let media = falsa(&dir.0, "cantoral-2026-02-01-080000-fusionar.db");
        let nueva = falsa(&dir.0, "cantoral-2026-03-01-080000-quitar-carpeta.db");
        let ajena = falsa(&dir.0, "mi-respaldo.db");

        rotar(&dir.0, 2, None).unwrap();

        assert!(!vieja.exists());
        assert!(media.exists() && nueva.exists());
        assert!(ajena.exists(), "lo que no es una copia automática no se toca");
    }

    #[test]
    fn the_backup_being_restored_is_never_rotated_away() {
        let dir = Dir::new("protegida");
        let vieja = falsa(&dir.0, "cantoral-2026-01-01-080000-restaurar.db");
        falsa(&dir.0, "cantoral-2026-02-01-080000-fusionar.db");

        rotar(&dir.0, 1, Some(&vieja)).unwrap();

        assert!(vieja.exists());
    }

    #[test]
    fn the_list_comes_newest_first_with_its_date_and_reason() {
        let dir = Dir::new("lista");
        falsa(&dir.0, "cantoral-2026-01-01-080000-restaurar.db");
        falsa(&dir.0, "cantoral-2026-03-01-213005-quitar-carpeta.db");
        falsa(&dir.0, "cantoral-2026-03-01-213005-quitar-carpeta-2.db");
        falsa(&dir.0, "cantoral-backup.db");

        let lista = listar(&dir.0).unwrap();
        assert!(
            lista[0].ruta.ends_with("quitar-carpeta-2.db"),
            "la segunda del mismo segundo va primero"
        );
        let fechas: Vec<&str> = lista.iter().map(|c| c.fecha.as_str()).collect();
        assert_eq!(fechas, ["2026-03-01T21:30:05", "2026-03-01T21:30:05", "2026-01-01T08:00:00"]);
        assert_eq!(lista[2].motivo, "restaurar");
    }

    #[test]
    fn no_folder_yet_is_an_empty_list() {
        let dir = Dir::new("sin-carpeta");
        assert!(listar(&dir.0.join("respaldos")).unwrap().is_empty());
    }

    #[test]
    fn a_copy_that_cannot_be_written_says_what_was_not_done() {
        let dir = Dir::new("sin-sitio");
        // Un archivo donde tendría que ir la carpeta: no se puede crear.
        let bloqueo = falsa(&dir.0, "respaldos");
        let err = guardar(&con_pistas(1), &bloqueo, Motivo::QuitarCarpeta, None).unwrap_err();
        assert!(err.to_string().contains("no se quitó la carpeta"), "{err}");
    }
}
