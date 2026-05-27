import { describe, it, expect } from "vitest";
import {
  feriadoProporcional,
  avisoPrevio,
  vacacionesPendientes,
  indemnizacionAnosServicio,
  calcularFiniquito,
  formatCLP,
} from "./calculos-laborales";

describe("feriadoProporcional", () => {
  it("calcula los días proporcionales para un año completo (~15 días)", () => {
    const result = feriadoProporcional({
      fechaInicio: new Date("2024-01-01"),
      fechaTermino: new Date("2024-12-31"),
      sueldoMensual: 900000,
    });
    // 365 días → 15 días exactos. Como usamos floor, da ~14.95.
    expect(result.dias).toBeGreaterThan(14.9);
    expect(result.dias).toBeLessThanOrEqual(15);
    // 900000 / 30 * 15 = 450000 aprox
    expect(result.monto).toBeGreaterThan(440_000);
    expect(result.monto).toBeLessThanOrEqual(450_000);
  });

  it("retorna 0 días y 0 monto cuando las fechas son iguales (edge)", () => {
    const same = new Date("2024-05-01");
    const result = feriadoProporcional({
      fechaInicio: same,
      fechaTermino: same,
      sueldoMensual: 1_000_000,
    });
    expect(result.dias).toBe(0);
    expect(result.monto).toBe(0);
  });
});

describe("avisoPrevio", () => {
  it("retorna el sueldo mensual completo redondeado", () => {
    expect(avisoPrevio(850_000)).toBe(850_000);
    expect(avisoPrevio(1_234_567.4)).toBe(1_234_567);
  });

  it("retorna 0 con sueldo 0 (edge)", () => {
    expect(avisoPrevio(0)).toBe(0);
  });
});

describe("vacacionesPendientes", () => {
  it("calcula el valor de los días pendientes a tarifa diaria", () => {
    // 900000 / 30 = 30000 por día → 10 días = 300000
    expect(
      vacacionesPendientes({ diasPendientes: 10, sueldoMensual: 900_000 })
    ).toBe(300_000);
  });

  it("retorna 0 si no hay días pendientes o sueldo es 0 (edge)", () => {
    expect(vacacionesPendientes({ diasPendientes: 0, sueldoMensual: 900_000 })).toBe(0);
    expect(vacacionesPendientes({ diasPendientes: 10, sueldoMensual: 0 })).toBe(0);
  });
});

describe("indemnizacionAnosServicio", () => {
  it("calcula 1 sueldo por año trabajado (ceil)", () => {
    // ~4 años y medio → ceil → 5 años
    const result = indemnizacionAnosServicio({
      fechaInicio: new Date("2019-06-01"),
      fechaTermino: new Date("2024-01-01"),
      sueldoMensual: 1_000_000,
    });
    expect(result.anos).toBe(5);
    expect(result.monto).toBe(5_000_000);
  });

  it("aplica tope de 11 años aunque trabaje más", () => {
    const result = indemnizacionAnosServicio({
      fechaInicio: new Date("2000-01-01"),
      fechaTermino: new Date("2024-01-01"),
      sueldoMensual: 500_000,
    });
    expect(result.anos).toBe(11);
    expect(result.monto).toBe(5_500_000);
  });

  it("aplica tope de sueldo cuando se pasa el parámetro", () => {
    const result = indemnizacionAnosServicio({
      fechaInicio: new Date("2022-01-01"),
      fechaTermino: new Date("2024-01-01"),
      sueldoMensual: 5_000_000,
      tope: 3_000_000,
    });
    expect(result.anos).toBe(2);
    expect(result.monto).toBe(6_000_000);
  });

  it("retorna 0 cuando las fechas son iguales (edge)", () => {
    const same = new Date("2024-01-01");
    const result = indemnizacionAnosServicio({
      fechaInicio: same,
      fechaTermino: same,
      sueldoMensual: 1_000_000,
    });
    expect(result.anos).toBe(0);
    expect(result.monto).toBe(0);
  });
});

describe("calcularFiniquito", () => {
  const baseArgs = {
    fechaInicio: new Date("2020-01-01"),
    fechaTermino: new Date("2024-01-01"),
    sueldoMensual: 900_000,
    diasVacacionesPendientes: 10,
  };

  it("renuncia: solo incluye vacaciones y feriado proporcional", () => {
    const r = calcularFiniquito({ ...baseArgs, motivo: "renuncia" });
    const nombres = r.conceptos.map((c) => c.nombre);
    expect(nombres).toContain("Vacaciones pendientes");
    expect(nombres).toContain("Feriado proporcional");
    expect(nombres).not.toContain("Indemnización por años de servicio");
    expect(nombres).not.toContain("Indemnización sustitutiva aviso previo");
    expect(r.total).toBeGreaterThan(0);
  });

  it("mutuo_acuerdo: solo incluye vacaciones y feriado proporcional", () => {
    const r = calcularFiniquito({ ...baseArgs, motivo: "mutuo_acuerdo" });
    const nombres = r.conceptos.map((c) => c.nombre);
    expect(nombres).toContain("Vacaciones pendientes");
    expect(nombres).toContain("Feriado proporcional");
    expect(nombres).not.toContain("Indemnización por años de servicio");
    expect(nombres).not.toContain("Indemnización sustitutiva aviso previo");
  });

  it("despido_injustificado: incluye todos los conceptos", () => {
    const r = calcularFiniquito({ ...baseArgs, motivo: "despido_injustificado" });
    const nombres = r.conceptos.map((c) => c.nombre);
    expect(nombres).toContain("Vacaciones pendientes");
    expect(nombres).toContain("Feriado proporcional");
    expect(nombres).toContain("Indemnización por años de servicio");
    expect(nombres).toContain("Indemnización sustitutiva aviso previo");
    // sanity: total = suma
    const sum = r.conceptos.reduce((acc, c) => acc + c.monto, 0);
    expect(r.total).toBe(sum);
  });

  it("necesidades_empresa: incluye todos los conceptos", () => {
    const r = calcularFiniquito({ ...baseArgs, motivo: "necesidades_empresa" });
    const nombres = r.conceptos.map((c) => c.nombre);
    expect(nombres).toContain("Vacaciones pendientes");
    expect(nombres).toContain("Feriado proporcional");
    expect(nombres).toContain("Indemnización por años de servicio");
    expect(nombres).toContain("Indemnización sustitutiva aviso previo");
  });

  it("edge: sin días de vacaciones y misma fecha → total 0 o solo aviso previo según motivo", () => {
    const same = new Date("2024-01-01");
    const r = calcularFiniquito({
      fechaInicio: same,
      fechaTermino: same,
      sueldoMensual: 900_000,
      diasVacacionesPendientes: 0,
      motivo: "renuncia",
    });
    expect(r.total).toBe(0);
    expect(r.conceptos).toHaveLength(0);
  });
});

describe("formatCLP", () => {
  it("formatea un número como CLP sin decimales", () => {
    const out = formatCLP(1_234_567);
    expect(out).toMatch(/1\.234\.567/);
    expect(out).toContain("$");
  });

  it("redondea y maneja 0 (edge)", () => {
    expect(formatCLP(0)).toContain("0");
  });
});
