import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generarEstadoCuenta,
  generarCartaCobranza,
  generarReporteCobranza,
} from "./reportes";
import type { Honorario } from "@db/schema";

// Helper to build minimal Honorario-shaped objects for testing.
// Only the fields used by reportes.ts matter.
function makeHonorario(overrides: Partial<Honorario> & Pick<Honorario, "id" | "cliente" | "concepto" | "monto">): Honorario {
  return {
    causaId: null,
    expedienteId: null,
    tipo: "honorario",
    montoPagado: 0,
    moneda: "CLP",
    estado: "pendiente",
    formaPago: null,
    numCuotas: 1,
    cuotaActual: 0,
    fechaVencimiento: null,
    fechaPago: null,
    facturado: false,
    numeroFactura: null,
    observaciones: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Honorario;
}

describe("generarEstadoCuenta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("estado de cuenta includes client name and totals", () => {
    const honorarios: Honorario[] = [
      makeHonorario({
        id: 1,
        cliente: "Juan Pérez",
        concepto: "Causa laboral C-1234",
        monto: 1_500_000,
        montoPagado: 500_000,
        estado: "pagado_parcial",
        fechaVencimiento: "2026-02-15",
      }),
      makeHonorario({
        id: 2,
        cliente: "Juan Pérez",
        concepto: "Asesoría Ley Karin",
        monto: 800_000,
        montoPagado: 0,
        estado: "pendiente",
        fechaVencimiento: "2026-04-01",
      }),
      makeHonorario({
        id: 3,
        cliente: "Juan Pérez",
        concepto: "Consulta general",
        monto: 200_000,
        montoPagado: 200_000,
        estado: "pagado",
      }),
    ];

    const out = generarEstadoCuenta("Juan Pérez", honorarios);
    expect(out).toContain("Juan Pérez");
    // Total facturado: 1.500.000 + 800.000 + 200.000 = 2.500.000
    expect(out).toContain("2.500.000");
    // Total pagado: 500.000 + 0 + 200.000 = 700.000
    expect(out).toContain("700.000");
    // Total pendiente: 1.800.000
    expect(out).toContain("1.800.000");
  });

  test("estado de cuenta includes concepto details", () => {
    const honorarios: Honorario[] = [
      makeHonorario({
        id: 1,
        cliente: "María González",
        concepto: "Demanda despido injustificado",
        monto: 500_000,
        estado: "pendiente",
      }),
    ];

    const out = generarEstadoCuenta("María González", honorarios);
    expect(out).toContain("Demanda despido injustificado");
    expect(out).toContain("Estado de Cuenta");
  });
});

describe("generarCartaCobranza", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const honorarioMoroso = makeHonorario({
    id: 10,
    cliente: "María González",
    concepto: "Honorarios causa laboral",
    monto: 1_000_000,
    montoPagado: 0,
    estado: "moroso",
    fechaVencimiento: "2026-04-01",
  });

  test("carta cobranza 1st notice is formal but not threatening", () => {
    const out = generarCartaCobranza(honorarioMoroso, 1);
    expect(out).toContain("María González");
    expect(out).toContain("PRIMERA CARTA DE COBRANZA");
    expect(out).toContain("recordarle");
    // 1st notice should NOT mention judicial action
    expect(out).not.toContain("acciones judiciales");
  });

  test("carta cobranza 2nd notice escalates tone", () => {
    const out = generarCartaCobranza(honorarioMoroso, 2);
    expect(out).toContain("SEGUNDA CARTA DE COBRANZA");
    expect(out).toContain("regularizar");
  });

  test("carta cobranza 3rd notice mentions judicial action", () => {
    const out = generarCartaCobranza(honorarioMoroso, 3);
    expect(out).toContain("TERCERA");
    expect(out).toContain("acciones judiciales");
    expect(out).toContain("costas");
  });
});

describe("generarReporteCobranza (aging report)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("aging report classifies buckets correctly", () => {
    const honorarios: Honorario[] = [
      // 0 days mora (current, vencimiento = today)
      makeHonorario({
        id: 10,
        cliente: "A",
        concepto: "Corriente",
        monto: 100_000,
        estado: "pendiente",
        fechaVencimiento: "2026-05-26",
      }),
      // 15 days mora -> 0-30 bucket
      makeHonorario({
        id: 11,
        cliente: "B",
        concepto: "15 días",
        monto: 200_000,
        estado: "pendiente",
        fechaVencimiento: "2026-05-11",
      }),
      // 45 days mora -> 31-60 bucket
      makeHonorario({
        id: 12,
        cliente: "C",
        concepto: "45 días",
        monto: 300_000,
        estado: "pendiente",
        fechaVencimiento: "2026-04-11",
      }),
      // 75 days mora -> 61-90 bucket
      makeHonorario({
        id: 13,
        cliente: "D",
        concepto: "75 días",
        monto: 400_000,
        estado: "pendiente",
        fechaVencimiento: "2026-03-12",
      }),
      // 120 days mora -> 90+ bucket
      makeHonorario({
        id: 14,
        cliente: "E",
        concepto: "120 días",
        monto: 500_000,
        estado: "pendiente",
        fechaVencimiento: "2026-01-26",
      }),
    ];

    const result = generarReporteCobranza(honorarios);

    expect(result.aging).toHaveLength(4);

    // 0-30 bucket: includes "Corriente" (0 dias) and "15 dias"
    const b030 = result.aging.find((b) => b.label === "0-30 dias")!;
    expect(b030.count).toBe(2);
    expect(b030.monto).toBe(300_000); // 100k + 200k

    // 31-60 bucket: "45 dias"
    const b3160 = result.aging.find((b) => b.label === "31-60 dias")!;
    expect(b3160.count).toBe(1);
    expect(b3160.monto).toBe(300_000);

    // 61-90 bucket: "75 dias"
    const b6190 = result.aging.find((b) => b.label === "61-90 dias")!;
    expect(b6190.count).toBe(1);
    expect(b6190.monto).toBe(400_000);

    // 90+ bucket: "120 dias"
    const b90 = result.aging.find((b) => b.label === "90+ dias")!;
    expect(b90.count).toBe(1);
    expect(b90.monto).toBe(500_000);
  });

  test("aging report excludes paid honorarios", () => {
    const honorarios: Honorario[] = [
      makeHonorario({
        id: 20,
        cliente: "X",
        concepto: "Pagado",
        monto: 100_000,
        montoPagado: 100_000,
        estado: "pagado",
        fechaVencimiento: "2026-02-01",
      }),
    ];

    const result = generarReporteCobranza(honorarios);
    const totalCount = result.aging.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(0);
    expect(result.totalPendiente).toBe(0);
  });
});
