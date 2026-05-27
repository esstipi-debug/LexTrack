// ─── Corte Suprema — simulador en memoria ────────────────────────
// Genera 3-5 fallos plausibles para cualquier query. Útil para
// desarrollo, demos y tests.

import type { BuscarFallosOpts, FalloSuprema } from "./types";
import { SupremaNotFoundError } from "./types";

const SALAS = [
  "Primera Sala (Civil)",
  "Segunda Sala (Penal)",
  "Tercera Sala (Constitucional)",
  "Cuarta Sala (Laboral y Previsional)",
];
const MATERIAS = ["laboral", "civil", "penal", "previsional", "tributaria"];
const MINISTROS = [
  "Andrea Muñoz Sánchez",
  "Ricardo Blanco Herrera",
  "Mauricio Silva Cancino",
  "Gloria Ana Chevesich Ruiz",
  "Jean Pierre Matus Acuña",
];
const CARATULAS = [
  "GONZÁLEZ con BANCO ESTADO",
  "PÉREZ con SUPERMERCADOS LTDA",
  "MUÑOZ con AFP HABITAT",
  "ROJAS con MINISTERIO DEL TRABAJO",
  "DÍAZ con CONSTRUCTORA PACIFICO",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function simulateDelay(): Promise<void> {
  const ms = 150 + Math.floor(Math.random() * 300);
  return new Promise((r) => setTimeout(r, ms));
}

function buildFallo(seed: number, fecha: Date, query?: string): FalloSuprema {
  const sala = pick(SALAS, seed);
  const materia = pick(MATERIAS, seed + 1);
  const caratula = pick(CARATULAS, seed + 2);
  const ministro = pick(MINISTROS, seed + 3);
  const rol = `${10000 + seed}-${fecha.getFullYear()}`;
  const tema = query ? query : materia;
  return {
    rol,
    fechaSentencia: toIso(fecha),
    sala,
    materia,
    caratula,
    ministroRedactor: ministro,
    resumen: `La Corte Suprema, conociendo del recurso sobre ${tema}, resolvió acoger/rechazar el recurso de unificación de jurisprudencia, sentando el criterio aplicable en materia ${materia}.`,
    url: `https://suprema.pjud.cl/SITSUPPORWEB/InicioAplicacion.do?rol=${rol}`,
  };
}

export async function buscarFallos(
  query: string,
  opts: BuscarFallosOpts = {},
): Promise<FalloSuprema[]> {
  await simulateDelay();
  const count = Math.min(opts.limit ?? 5, 5);
  const out: FalloSuprema[] = [];
  const base = opts.fechaHasta ?? new Date();
  for (let i = 0; i < count; i++) {
    const f = new Date(base);
    f.setDate(f.getDate() - i * 30);
    const fallo = buildFallo(i + (query.length || 1), f, query);
    if (opts.materia) fallo.materia = opts.materia;
    out.push(fallo);
  }
  return out;
}

export async function obtenerFallo(rol: string): Promise<FalloSuprema> {
  await simulateDelay();
  if (!rol || !/^\d+-\d{4}$/.test(rol)) {
    throw new SupremaNotFoundError(`Rol inválido: ${rol}`);
  }
  const seed = rol.length;
  const year = parseInt(rol.split("-")[1], 10);
  const fecha = new Date(`${year}-06-15`);
  return { ...buildFallo(seed, fecha), rol };
}
