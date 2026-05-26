// Chilean UF (Unidad de Fomento) — inflation-indexed unit
// Updated daily by the Banco Central de Chile

const UF_FALLBACK = 38847.46; // UF al 26-mayo-2026 (fallback si API falla)
const UF_API_URL = "https://mindicador.cl/api/uf";

let cachedUF: { valor: number; fecha: string; fetchedAt: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function getUFActual(): Promise<{ valor: number; fecha: string; fuente: string }> {
  // Return cache if fresh
  if (cachedUF && Date.now() - cachedUF.fetchedAt < CACHE_TTL) {
    return { valor: cachedUF.valor, fecha: cachedUF.fecha, fuente: "cache" };
  }

  try {
    const res = await fetch(UF_API_URL);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const serie = data.serie?.[0];
    if (serie?.valor) {
      cachedUF = { valor: serie.valor, fecha: serie.fecha?.split("T")[0] || new Date().toISOString().split("T")[0], fetchedAt: Date.now() };
      return { valor: cachedUF.valor, fecha: cachedUF.fecha, fuente: "mindicador.cl" };
    }
  } catch {
    // API failed — use fallback
  }

  return { valor: UF_FALLBACK, fecha: "2026-05-26", fuente: "fallback" };
}

export function getUFSync(): number {
  return cachedUF?.valor ?? UF_FALLBACK;
}
