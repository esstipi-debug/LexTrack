import { describe, test, expect } from "vitest";
import {
  calcularIndemnizacion,
  TOPE_REMUNERACION,
  TOPE_DIAS,
} from "./calculadora";

describe("calcularIndemnizacion", () => {
  test("basic indemnization: 5 years, $800.000", () => {
    const r = calcularIndemnizacion({ anios: 5, sueldo: 800_000 });
    // 5 years * 30 days = 150 days -> (150/30) * 800.000 = 4.000.000
    expect(r.totalAniosComputados).toBe(5);
    expect(r.diasIndemnizacion).toBe(150);
    expect(r.montoIndemnizacion).toBe(4_000_000);
    expect(r.topeAplicado).toBe(false);
    // No aviso previo -> 1 month = 800.000
    expect(r.montoAvisoPrevio).toBe(800_000);
    expect(r.total).toBe(4_800_000);
  });

  test("applies 11-year cap correctly (15 years should cap at 330 days)", () => {
    const r = calcularIndemnizacion({ anios: 15, sueldo: 800_000 });
    expect(r.totalAniosComputados).toBe(15);
    expect(r.diasIndemnizacion).toBe(TOPE_DIAS); // 330
    // (330/30) * 800.000 = 8.800.000
    expect(r.montoIndemnizacion).toBe(8_800_000);
  });

  test("applies 90 UF salary cap ($5.000.000 salary should cap)", () => {
    const sueldo = 5_000_000;
    const r = calcularIndemnizacion({ anios: 3, sueldo });
    expect(r.topeAplicado).toBe(true);
    expect(r.remuneracionCalculo).toBe(TOPE_REMUNERACION);
    // 3 years * 30 = 90 days -> (90/30) * TOPE_REMUNERACION
    expect(r.montoIndemnizacion).toBe(3 * TOPE_REMUNERACION);
  });

  test("aviso previo adds 1 month when not given", () => {
    const r = calcularIndemnizacion({
      anios: 2,
      sueldo: 600_000,
      avisoPrevioDado: false,
    });
    expect(r.montoAvisoPrevio).toBe(600_000);
    expect(r.total).toBe(r.montoIndemnizacion + 600_000);
  });

  test("aviso previo is 0 when given", () => {
    const r = calcularIndemnizacion({
      anios: 2,
      sueldo: 600_000,
      avisoPrevioDado: true,
    });
    expect(r.montoAvisoPrevio).toBe(0);
    expect(r.total).toBe(r.montoIndemnizacion);
  });

  test("fraction >= 6 months rounds up to next year", () => {
    const r = calcularIndemnizacion({ anios: 4, meses: 6, sueldo: 1_000_000 });
    // 4 years + 6 months -> 5 years computed
    expect(r.totalAniosComputados).toBe(5);
    expect(r.diasIndemnizacion).toBe(150);
    expect(r.montoIndemnizacion).toBe(5_000_000);
  });

  test("fraction < 6 months does not round up", () => {
    const r = calcularIndemnizacion({ anios: 4, meses: 5, sueldo: 1_000_000 });
    // 4 years + 5 months -> 4 years computed
    expect(r.totalAniosComputados).toBe(4);
    expect(r.diasIndemnizacion).toBe(120);
    expect(r.montoIndemnizacion).toBe(4_000_000);
  });

  test("zero years returns 0 indemnization", () => {
    const r = calcularIndemnizacion({ anios: 0, sueldo: 800_000 });
    expect(r.totalAniosComputados).toBe(0);
    expect(r.diasIndemnizacion).toBe(0);
    expect(r.montoIndemnizacion).toBe(0);
    // Aviso previo still applies
    expect(r.montoAvisoPrevio).toBe(800_000);
  });

  test("handles edge case: exactly 11 years", () => {
    const r = calcularIndemnizacion({ anios: 11, sueldo: 800_000 });
    expect(r.totalAniosComputados).toBe(11);
    expect(r.diasIndemnizacion).toBe(330); // exactly at cap
    expect(r.montoIndemnizacion).toBe(11 * 800_000);
  });

  test("aviso previo also respects 90 UF cap", () => {
    const sueldo = 5_000_000;
    const r = calcularIndemnizacion({ anios: 1, sueldo, avisoPrevioDado: false });
    expect(r.montoAvisoPrevio).toBe(TOPE_REMUNERACION);
  });
});
