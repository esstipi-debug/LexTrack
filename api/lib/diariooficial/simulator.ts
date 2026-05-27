// ─── Diario Oficial — simulador en memoria ───────────────────────
// Genera 3-5 normas plausibles para cualquier query/fecha. Útil
// para desarrollo, demos y tests.

import type {
  BuscarNormasOpts,
  DiarioOficialNorma,
} from "./types";

const TIPOS = ["ley", "decreto", "resolucion", "circular", "instruccion"];
const ORGANISMOS = [
  "Ministerio del Trabajo y Previsión Social",
  "Dirección del Trabajo",
  "Ministerio de Hacienda",
  "Ministerio de Salud",
  "Servicio de Impuestos Internos",
  "Superintendencia de Seguridad Social",
];
const MATERIAS = ["laboral", "tributaria", "salud", "administrativa", "civil"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function simulateDelay(): Promise<void> {
  const ms = 150 + Math.floor(Math.random() * 300);
  return new Promise((r) => setTimeout(r, ms));
}

function buildNorma(seed: number, fecha: Date, query?: string): DiarioOficialNorma {
  const tipo = pick(TIPOS, seed);
  const organismo = pick(ORGANISMOS, seed + 1);
  const materia = pick(MATERIAS, seed + 2);
  const numero = `${20000 + seed}-${fecha.getFullYear()}`;
  const tituloBase = query
    ? `${tipo[0].toUpperCase()}${tipo.slice(1)} sobre ${query}`
    : `${tipo[0].toUpperCase()}${tipo.slice(1)} de ${materia}`;
  return {
    tipoNorma: tipo,
    numero,
    titulo: `${tituloBase} — N° ${numero}`,
    fechaPublicacion: toIso(fecha),
    organismo,
    materia,
    url: `https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php?date=${toIso(fecha)}&edition=${seed}`,
  };
}

export async function obtenerEdicionDelDia(
  fecha: Date = new Date(),
): Promise<DiarioOficialNorma[]> {
  await simulateDelay();
  const count = 3 + Math.floor(Math.random() * 3);
  const out: DiarioOficialNorma[] = [];
  for (let i = 0; i < count; i++) {
    out.push(buildNorma(i + fecha.getDate(), fecha));
  }
  return out;
}

export async function buscarNormas(
  query: string,
  opts: BuscarNormasOpts = {},
): Promise<DiarioOficialNorma[]> {
  await simulateDelay();
  const count = Math.min(opts.limit ?? 5, 5);
  const out: DiarioOficialNorma[] = [];
  const base = opts.fechaHasta ?? new Date();
  for (let i = 0; i < count; i++) {
    const f = new Date(base);
    f.setDate(f.getDate() - i * 7);
    const n = buildNorma(i + (query.length || 1), f, query);
    if (opts.materia) n.materia = opts.materia;
    out.push(n);
  }
  return out;
}
