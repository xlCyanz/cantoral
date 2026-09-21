#!/usr/bin/env node
// El manifiesto que `tauri-plugin-updater` va a leer.
//
// Tauri no lo genera: lo que deja cada compilación son los instaladores y un
// `.sig` al lado de cada uno. Esto los junta en el `latest.json` que se publica
// como asset del release, con las URLs que GitHub dará a esos mismos assets.
//
// Se ejecuta en el job de release, pero es una función pura de «qué archivos
// hay» → «qué manifiesto sale», y por eso vive aquí y está probado.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A qué plataforma del manifiesto corresponde cada artefacto firmado.
 *
 * Solo se construye para la arquitectura del runner, así que macOS sale
 * `aarch64`: los runners de GitHub son Apple Silicon. Un Mac Intel no se
 * actualizará solo hasta que la compilación use `universal-apple-darwin`.
 */
export function plataformaDe(nombre) {
  if (nombre.endsWith(".app.tar.gz")) return "darwin-aarch64";
  if (nombre.endsWith("-setup.exe")) return "windows-x86_64";
  return null;
}

/** Todos los archivos bajo `dir`, en orden estable. */
export function archivos(dir, leer = readdirSync, esDir = (p) => statSync(p).isDirectory()) {
  const out = [];
  const walk = (d) => {
    for (const nombre of [...leer(d)].sort()) {
      const p = join(d, nombre);
      if (esDir(p)) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

/**
 * Armar el manifiesto.
 *
 * `firmas` es un mapa de ruta de artefacto → contenido de su `.sig`. Un `.sig`
 * cuyo artefacto no está se ignora en vez de romper: publicar un manifiesto que
 * apunta a una descarga inexistente dejaría a cada instalación intentando
 * actualizarse y fallando.
 */
export function manifiesto({ version, notas, fecha, repo, tag, artefactos, firmas }) {
  const platforms = {};
  for (const ruta of artefactos) {
    const nombre = ruta.split("/").pop();
    const plataforma = plataformaDe(nombre);
    if (!plataforma) continue;
    const firma = firmas[ruta];
    if (!firma?.trim()) continue;
    // El .app.tar.gz de macOS y el -setup.exe de Windows son lo que el
    // actualizador descarga; el .dmg y el .msi son para instalar a mano.
    platforms[plataforma] = {
      signature: firma.trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(nombre)}`,
    };
  }
  if (Object.keys(platforms).length === 0) {
    throw new Error("ningún artefacto firmado que publicar en latest.json");
  }
  return { version, notes: notas, pub_date: fecha, platforms };
}

/** La sección del CHANGELOG de esta versión, o una nota genérica. */
export function notasDe(changelog, version) {
  const lineas = changelog.split("\n");
  const inicio = lineas.findIndex((l) => l.startsWith(`## [${version}]`));
  if (inicio === -1) return `Cantoral ${version}`;
  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((l) => l.startsWith("## ["));
  const cuerpo = (fin === -1 ? resto : resto.slice(0, fin)).join("\n").trim();
  return cuerpo || `Cantoral ${version}`;
}

// ---------------------------------------------------------------- entrada

function main() {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const repo = process.env.REPO ?? "";
  const tag = process.env.TAG ?? `v${version}`;
  const todos = archivos("artifacts");
  const firmados = todos.filter((f) => f.endsWith(".sig"));
  const firmas = {};
  for (const sig of firmados) {
    firmas[sig.slice(0, -".sig".length)] = readFileSync(sig, "utf8");
  }
  let notas;
  try {
    notas = notasDe(readFileSync("CHANGELOG.md", "utf8"), version);
  } catch {
    notas = `Cantoral ${version}`;
  }
  const salida = manifiesto({
    version,
    notas,
    fecha: new Date().toISOString(),
    repo,
    tag,
    artefactos: todos,
    firmas,
  });
  process.stdout.write(`${JSON.stringify(salida, null, 2)}\n`);
}

// Solo corre cuando lo invoca el workflow; al importarlo desde las pruebas, no.
if (process.argv[1] && process.argv[1].endsWith("latest-json.mjs")) main();
