import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { calcularInteresMora } from "./intereses";

describe("calcularInteresMora", () => {
  beforeEach(() => {
    // Fix "today" to 2026-05-01 so tests are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("calculates basic monthly interest at 1.5%", () => {
    const r = calcularInteresMora({
      monto: 1_000_000,
      montoPagado: 0,
      fechaVencimiento: "2026-04-01",
    });
    // 30 days of mora -> 1 month -> 1.000.000 * 1.5/100 * (30/30) = 15.000
    expect(r.montoPendiente).toBe(1_000_000);
    expect(r.diasMora).toBe(30);
    expect(r.interesCalculado).toBe(15_000);
    expect(r.totalConInteres).toBe(1_015_000);
  });

  test("calculates interest for partial month", () => {
    const r = calcularInteresMora({
      monto: 1_000_000,
      montoPagado: 0,
      fechaVencimiento: "2026-04-16",
    });
    // 15 days of mora -> 1.000.000 * 0.015 * (15/30) = 7.500
    expect(r.diasMora).toBe(15);
    expect(r.interesCalculado).toBe(7_500);
  });

  test("returns 0 interest when not overdue", () => {
    const r = calcularInteresMora({
      monto: 500_000,
      montoPagado: 0,
      fechaVencimiento: "2026-06-01",
    });
    expect(r.diasMora).toBe(0);
    expect(r.interesCalculado).toBe(0);
    expect(r.totalConInteres).toBe(500_000);
  });

  test("handles fully paid honorario", () => {
    const r = calcularInteresMora({
      monto: 1_000_000,
      montoPagado: 1_000_000,
      fechaVencimiento: "2026-04-01",
    });
    expect(r.montoPendiente).toBe(0);
    expect(r.interesCalculado).toBe(0);
    expect(r.totalConInteres).toBe(0);
  });

  test("custom interest rate works", () => {
    const r = calcularInteresMora({
      monto: 1_000_000,
      montoPagado: 0,
      fechaVencimiento: "2026-04-01",
      tasaMensual: 2.0, // 2% mensual
    });
    // 30 days -> 1.000.000 * 2/100 * (30/30) = 20.000
    expect(r.interesCalculado).toBe(20_000);
    expect(r.totalConInteres).toBe(1_020_000);
  });

  test("includes correct normative base", () => {
    const r = calcularInteresMora({
      monto: 500_000,
      montoPagado: 0,
      fechaVencimiento: "2026-04-01",
    });
    expect(r.baseNormativa).toContain("Art. 63 CT");
    expect(r.baseNormativa).toContain("Art. 1559 CC");
  });
});
