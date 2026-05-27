import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buscarNormas as simBuscar,
  obtenerEdicionDelDia as simEdicion,
} from "./simulator";

describe("diariooficial/simulator", () => {
  it("returns DTO with the expected shape", async () => {
    const normas = await simBuscar("ley karin");
    expect(normas.length).toBeGreaterThan(0);
    expect(normas.length).toBeLessThanOrEqual(5);
    const n = normas[0];
    expect(n).toEqual(
      expect.objectContaining({
        tipoNorma: expect.any(String),
        numero: expect.any(String),
        titulo: expect.any(String),
        fechaPublicacion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        organismo: expect.any(String),
        materia: expect.any(String),
        url: expect.stringContaining("diariooficial.interior.gob.cl"),
      }),
    );
  });

  it("obtenerEdicionDelDia returns 3-5 normas", async () => {
    const normas = await simEdicion(new Date("2025-01-15"));
    expect(normas.length).toBeGreaterThanOrEqual(3);
    expect(normas.length).toBeLessThanOrEqual(5);
  });
});

describe("diariooficial/facade env routing", () => {
  const ORIGINAL_ENV = process.env.DIARIO_OFICIAL_SCRAPER;
  afterEach(() => {
    process.env.DIARIO_OFICIAL_SCRAPER = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("defaults to simulator when env is unset", async () => {
    delete process.env.DIARIO_OFICIAL_SCRAPER;
    vi.resetModules();
    const facade = await import("./index");
    facade._resetDiarioOficialScraper();
    const normas = await facade.buscarNormas("hello");
    expect(Array.isArray(normas)).toBe(true);
    expect(normas[0]?.url).toContain("diariooficial.interior.gob.cl");
  });

  it("routes to playwright impl when DIARIO_OFICIAL_SCRAPER=playwright", async () => {
    process.env.DIARIO_OFICIAL_SCRAPER = "playwright";
    vi.resetModules();
    vi.doMock("playwright", () => ({
      chromium: { launch: vi.fn(async () => ({ newContext: vi.fn(), close: vi.fn() })) },
    }));
    const facade = await import("./index");
    facade._resetDiarioOficialScraper();
    const scraper = facade.getDiarioOficialScraper();
    const pw = await import("./playwright-scraper");
    expect(scraper.obtenerEdicionDelDia).toBe(pw.obtenerEdicionDelDia);
    expect(scraper.buscarNormas).toBe(pw.buscarNormas);
  });
});

// ─── Playwright impl (mocked) ────────────────────────────────────

interface MockState {
  selectorText: Record<string, string | null>;
  rowCounts: Record<string, number>;
  gotoUrls: string[];
}

const state: MockState = { selectorText: {}, rowCounts: {}, gotoUrls: [] };

function makeElement(text: string | null) {
  return {
    textContent: async () => text,
    getAttribute: async () => "",
    $: async () => null,
  };
}

function makePage() {
  return {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    goto: vi.fn(async (url: string) => { state.gotoUrls.push(url); }),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    waitForLoadState: vi.fn(async () => {}),
    $: vi.fn(async (sel: string) => {
      const t = state.selectorText[sel];
      if (t === undefined || t === null) return null;
      return makeElement(t);
    }),
    $$: vi.fn(async (sel: string) => {
      const n = state.rowCounts[sel] || 0;
      return Array.from({ length: n }, () => makeElement(""));
    }),
  };
}

const browser = {
  newContext: vi.fn(async () => ({
    newPage: vi.fn(async () => makePage()),
    close: vi.fn(async () => {}),
  })),
  close: vi.fn(async () => {}),
};

vi.mock("playwright", () => ({
  chromium: { launch: vi.fn(async () => browser) },
}));

describe("diariooficial/playwright-scraper", () => {
  beforeEach(() => {
    state.selectorText = {};
    state.rowCounts = {};
    state.gotoUrls = [];
  });

  it("navigates to DIARIO_OFICIAL_BASE_URL when buscarNormas is called", async () => {
    const { buscarNormas, DIARIO_OFICIAL_BASE_URL, closeBrowser } = await import("./playwright-scraper");
    const normas = await buscarNormas("despido");
    expect(state.gotoUrls.some((u) => u.startsWith(DIARIO_OFICIAL_BASE_URL))).toBe(true);
    expect(Array.isArray(normas)).toBe(true);
    await closeBrowser();
  });
});
