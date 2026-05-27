// ─── DT Simulator ────────────────────────────────────────────────
// In-memory simulator for the Dirección del Trabajo dictámenes
// search. Returns plausible mock data so the dev loop and CI work
// without spawning a headless browser. Same surface as
// playwright-scraper.ts so they're interchangeable behind the facade.

import type { DtDictamen } from "./types";
import { DtNotFoundError } from "./types";

const MATERIAS = [
  "Jornada de trabajo",
  "Remuneraciones",
  "Feriado anual",
  "Indemnización por años de servicio",
  "Ley Karin — acoso laboral",
  "Subcontratación",
  "Sindicatos y negociación colectiva",
  "Protección a la maternidad",
  "Contrato a plazo fijo",
  "Permisos legales",
  "Cotizaciones previsionales",
  "Trabajo a distancia y teletrabajo",
];

const SUMARIOS: Record<string, string> = {
  "Jornada de trabajo":
    "Sostiene que las horas extraordinarias deben pactarse por escrito y solo proceden cuando existan necesidades transitorias de la empresa, conforme al Art. 32 del Código del Trabajo.",
  "Remuneraciones":
    "Concluye que las gratificaciones legales (Art. 47 CT) constituyen remuneración para todos los efectos legales y deben ser consideradas en el cálculo de la indemnización por años de servicio.",
  "Feriado anual":
    "Reitera que el feriado básico es de 15 días hábiles continuos, y que el feriado progresivo requiere 10 años de trabajo, continuos o no, para uno o más empleadores.",
  "Indemnización por años de servicio":
    "Reafirma que la base de cálculo de la indemnización del Art. 163 CT incluye toda cantidad que el trabajador estuviere percibiendo en forma fija y permanente.",
  "Ley Karin — acoso laboral":
    "Precisa que el plazo de investigación de la Ley 21.643 es de 30 días corridos desde la recepción de la denuncia, prorrogable solo por causa justificada documentada.",
  "Subcontratación":
    "Concluye que la empresa principal responde solidariamente de las obligaciones laborales y previsionales del contratista respecto de los trabajadores que ejecuten obras en régimen de subcontratación.",
  "Sindicatos y negociación colectiva":
    "Sostiene que los trabajadores con fuero sindical no pueden ser despedidos sin autorización judicial previa, salvo por las causales de los Arts. 159 N° 4 y 5 y 160 CT.",
  "Protección a la maternidad":
    "Reitera que el fuero maternal (Art. 201 CT) se extiende hasta un año después de expirado el descanso post-natal, y que la trabajadora despedida sin autorización judicial debe ser reincorporada.",
  "Contrato a plazo fijo":
    "Concluye que la renovación de un contrato a plazo fijo por más de dos veces, o que la prestación de servicios exceda los 12 meses, lo transforma de pleno derecho en indefinido (Art. 159 N° 4 CT).",
  "Permisos legales":
    "Recuerda que el permiso por matrimonio o acuerdo de unión civil (Art. 207 bis CT) es de 5 días hábiles continuos, adicional al feriado, e irrenunciable.",
  "Cotizaciones previsionales":
    "Confirma que el no pago oportuno de cotizaciones previsionales al momento del despido vicia la separación y la sigue produciendo efectos remuneratorios (Ley Bustos — Art. 162 inc. 5° CT).",
  "Trabajo a distancia y teletrabajo":
    "Precisa que el empleador debe proveer los equipos, insumos y servicios necesarios para el trabajo a distancia (Art. 152 quáter G CT), salvo pacto en contrario fundado.",
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickMateria(query: string, idx: number): string {
  const q = query.toLowerCase();
  const matched = MATERIAS.find((m) => q && m.toLowerCase().includes(q.split(" ")[0]));
  if (matched) return matched;
  return MATERIAS[(hashSeed(query) + idx) % MATERIAS.length];
}

function fakeOrdinario(seed: number, idx: number): string {
  const year = 2024 - (idx % 2);
  const num = 1000 + ((seed + idx * 137) % 8999);
  return `${num}/${year}`;
}

function fakeFecha(seed: number, idx: number): string {
  const baseYear = 2024 - (idx % 2);
  const month = ((seed + idx) % 12) + 1;
  const day = ((seed + idx * 7) % 28) + 1;
  return `${baseYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fakeUrl(ordinario: string): string {
  return `https://www.dt.gob.cl/legislacion/1611/w3-article-${encodeURIComponent(ordinario)}.html`;
}

function buildOne(query: string, idx: number): DtDictamen {
  const seed = hashSeed(query + ":" + idx);
  const materia = pickMateria(query, idx);
  const ordinario = fakeOrdinario(seed, idx);
  return {
    ordinario,
    fecha: fakeFecha(seed, idx),
    materia,
    sumario: SUMARIOS[materia] ?? `Pronunciamiento sobre ${materia.toLowerCase()} solicitado por consulta de ${query}.`,
    url: fakeUrl(ordinario),
  };
}

export async function buscarDictamenes(
  query: string,
  opts?: { limite?: number },
): Promise<DtDictamen[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 5, 1), 10);
  const n = Math.max(3, Math.min(limite, 5));
  const out: DtDictamen[] = [];
  for (let i = 0; i < n; i++) out.push(buildOne(query || "general", i));
  return out;
}

export async function obtenerDictamen(ordinario: string): Promise<DtDictamen | null> {
  if (!ordinario || !/^\d+\/\d{2,4}$/.test(ordinario.trim())) {
    throw new DtNotFoundError(`Ordinario inválido: ${ordinario}`);
  }
  const base = buildOne(ordinario, 0);
  return {
    ...base,
    ordinario,
    url: fakeUrl(ordinario),
    texto: `Texto íntegro del dictamen ordinario ${ordinario} sobre ${base.materia}. ${base.sumario}`,
  };
}
