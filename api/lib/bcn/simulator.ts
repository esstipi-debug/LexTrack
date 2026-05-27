// ─── BCN Simulator ───────────────────────────────────────────────
// In-memory simulator for the BCN LeyChile search. Returns plausible
// mock data so the dev loop and CI work without spawning a headless
// browser. Same surface as playwright-scraper.ts so they're
// interchangeable behind the facade.

import type { BcnNorma } from "./types";
import { BcnNotFoundError } from "./types";

interface SeedNorma {
  numero: string;
  titulo: string;
  tipo: string;
  fechaPublicacion: string;
}

const SEED: SeedNorma[] = [
  {
    numero: "21.643",
    titulo: "Modifica el Código del Trabajo y otros cuerpos legales, en materia de prevención, investigación y sanción del acoso laboral, sexual y la violencia en el trabajo (Ley Karin)",
    tipo: "ley",
    fechaPublicacion: "2024-01-15",
  },
  {
    numero: "20.940",
    titulo: "Moderniza el sistema de relaciones laborales",
    tipo: "ley",
    fechaPublicacion: "2016-09-08",
  },
  {
    numero: "21.561",
    titulo: "Reduce la jornada laboral en forma gradual, de cuarenta y cinco a cuarenta horas semanales",
    tipo: "ley",
    fechaPublicacion: "2023-04-26",
  },
  {
    numero: "19.728",
    titulo: "Establece un seguro de desempleo",
    tipo: "ley",
    fechaPublicacion: "2001-05-14",
  },
  {
    numero: "DFL-1",
    titulo: "Fija el texto refundido, coordinado y sistematizado del Código del Trabajo",
    tipo: "DFL",
    fechaPublicacion: "2003-01-16",
  },
  {
    numero: "21.431",
    titulo: "Modifica el Código del Trabajo regulando el contrato de trabajadores de empresas de plataformas digitales de servicios",
    tipo: "ley",
    fechaPublicacion: "2022-03-11",
  },
  {
    numero: "16.744",
    titulo: "Establece normas sobre accidentes del trabajo y enfermedades profesionales",
    tipo: "ley",
    fechaPublicacion: "1968-02-01",
  },
];

function urlFor(numero: string): string {
  return `https://www.bcn.cl/leychile/navegar?idNorma=${encodeURIComponent(numero)}`;
}

function score(query: string, n: SeedNorma): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = `${n.numero} ${n.titulo} ${n.tipo}`.toLowerCase();
  let s = 0;
  for (const tok of q.split(/\s+/).filter(Boolean)) {
    if (hay.includes(tok)) s += 2;
  }
  if (n.numero.toLowerCase() === q) s += 10;
  return s;
}

export async function buscarNormas(
  query: string,
  opts?: { limite?: number },
): Promise<BcnNorma[]> {
  const limite = Math.min(Math.max(opts?.limite ?? 5, 1), 10);
  const ranked = SEED
    .map((n) => ({ n, s: score(query, n) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(3, Math.min(limite, 5)))
    .map(({ n }) => ({ ...n, url: urlFor(n.numero) }));
  return ranked;
}

export async function obtenerNorma(numero: string): Promise<BcnNorma | null> {
  if (!numero || !numero.trim()) {
    throw new BcnNotFoundError(`Número de norma inválido: ${numero}`);
  }
  const norm = numero.trim();
  const hit = SEED.find((n) => n.numero.toLowerCase() === norm.toLowerCase());
  if (!hit) {
    return {
      numero: norm,
      titulo: `Norma ${norm}`,
      tipo: "ley",
      fechaPublicacion: "2020-01-01",
      url: urlFor(norm),
      texto: `Texto íntegro simulado de la norma ${norm}.`,
    };
  }
  return {
    ...hit,
    url: urlFor(hit.numero),
    texto: `Texto íntegro simulado de la ${hit.tipo} ${hit.numero}: ${hit.titulo}.`,
  };
}
