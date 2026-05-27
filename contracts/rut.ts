import { z } from "zod";

/**
 * Strips dots, dashes and whitespace from a RUT string and
 * uppercases the verifier digit (DV).
 */
export function cleanRut(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(/[.\-\s]/g, "").toUpperCase();
}

/**
 * Computes the mod-11 verifier digit for the numeric portion of a RUT.
 * @param numeric digits-only string (no DV).
 * @returns "0"-"9" or "K".
 */
export function computeDv(numeric: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = numeric.length - 1; i >= 0; i--) {
    const digit = Number(numeric[i]);
    if (Number.isNaN(digit)) return "";
    sum += digit * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "K";
  return String(mod);
}

/**
 * Validates a Chilean RUT. Accepts dotted/dashed or compact forms,
 * lowercase or uppercase k. Returns false for empty / malformed inputs.
 */
export function isValidRut(input: string): boolean {
  if (typeof input !== "string") return false;
  const clean = cleanRut(input);
  if (clean.length < 8 || clean.length > 10) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 9) return false;
  if (!/^[0-9K]$/.test(dv)) return false;
  return computeDv(body) === dv;
}

/**
 * Returns the canonical "12.345.678-9" form. If the input cannot be
 * cleanly parsed as a RUT-shaped string, returns the cleaned input
 * unchanged (validation should be performed separately).
 */
export function formatRut(input: string): string {
  const clean = cleanRut(input);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return clean;
  // Insert dots every 3 digits from the right.
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

/**
 * Zod schema for RUT inputs. Validates via mod-11 and normalizes
 * to canonical "12.345.678-9" form on parse.
 */
export const rutSchema = z
  .string()
  .refine(isValidRut, { message: "RUT inválido" })
  .transform(formatRut);
