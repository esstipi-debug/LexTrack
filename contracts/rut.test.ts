import { describe, expect, it } from "vitest";
import { cleanRut, computeDv, formatRut, isValidRut, rutSchema } from "./rut";

describe("cleanRut", () => {
  it("strips dots, dashes and spaces", () => {
    expect(cleanRut("12.345.678-5")).toBe("123456785");
    expect(cleanRut(" 12 345 678 - 5 ")).toBe("123456785");
  });
  it("uppercases lowercase k", () => {
    expect(cleanRut("12.345.670-k")).toBe("12345670K");
  });
  it("returns empty for non-string", () => {
    // @ts-expect-error testing runtime guard
    expect(cleanRut(null)).toBe("");
  });
});

describe("computeDv", () => {
  it("returns the verifier digit for numeric RUTs", () => {
    expect(computeDv("11111111")).toBe("1");
    expect(computeDv("12345678")).toBe("5");
    expect(computeDv("7654321")).toBe("6");
  });
  it("returns K when mod-11 yields 10", () => {
    expect(computeDv("12345670")).toBe("K");
  });
});

describe("isValidRut", () => {
  it("accepts known-valid RUTs in canonical form", () => {
    expect(isValidRut("11.111.111-1")).toBe(true);
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("7.654.321-6")).toBe(true);
  });
  it("accepts compact form", () => {
    expect(isValidRut("111111111")).toBe(true);
    expect(isValidRut("123456785")).toBe(true);
  });
  it("accepts uppercase and lowercase K DV", () => {
    expect(isValidRut("12.345.670-K")).toBe(true);
    expect(isValidRut("12.345.670-k")).toBe(true);
  });
  it("rejects bad DV", () => {
    expect(isValidRut("11.111.111-2")).toBe(false);
    expect(isValidRut("12.345.678-9")).toBe(false);
  });
  it("rejects malformed strings", () => {
    expect(isValidRut("")).toBe(false);
    expect(isValidRut("abc")).toBe(false);
    expect(isValidRut("123")).toBe(false);
    expect(isValidRut("1234567890123")).toBe(false);
    expect(isValidRut("12.345.67A-5")).toBe(false);
  });
  it("rejects non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(isValidRut(null)).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(isValidRut(12345678)).toBe(false);
  });
});

describe("formatRut", () => {
  it("returns canonical 12.345.678-9 form", () => {
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("12345670k")).toBe("12.345.670-K");
    expect(formatRut("7654321-6")).toBe("7.654.321-6");
  });
});

describe("rutSchema", () => {
  it("parses and normalizes valid RUTs", () => {
    expect(rutSchema.parse("123456785")).toBe("12.345.678-5");
    expect(rutSchema.parse("12.345.670-k")).toBe("12.345.670-K");
  });
  it("rejects invalid RUTs with the expected message", () => {
    const result = rutSchema.safeParse("11.111.111-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("RUT inválido");
    }
  });
  it("rejects empty strings", () => {
    expect(rutSchema.safeParse("").success).toBe(false);
  });
});
