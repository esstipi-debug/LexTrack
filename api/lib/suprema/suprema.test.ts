import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Tests del simulador ─────────────────────────────────────────

import { buscarFallos as simBuscar, obtenerFallo as simObtener } from "./simulator";
import { SupremaNotFoundError } from "./types";

describe("suprema/simulator", () => {
  it("returns DTO with the expected shape", async () => {
    const fallos = await simBuscar("indemnización despido");
    expect(fallos.length).toBeGreaterThan(0);
    expect(fallos.length).toBeLessThanOrEqual(5);
    const f = fallos[0];
    expect(f).toEqual(
      expect.objectContaining({
        rol: expect.any(String),
        fechaSentencia: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        sala: expect.any(String),
        materia: expect.any(String),
        caratula: expect.any(String),
        resumen: expect.any(String),
        url: expect.stringContaining("suprema.pjud.cl"),
      }),
    );
  });

  it("applies materia filter", async () => {
    const fallos = await simBuscar("acoso", { materia: "laboral" });
    expect(fallos.every((f) => f.materia === "laboral")).toBe(true);
  });

  it("obtenerFallo throws SupremaNotFoundError on invalid rol", async () => {
    await expect(simObtener("not-a-rol")).rejects.toBeInstanceOf(SupremaNotFoundError);
  });
});

// ─── Facade env routing ──────────────────────────────────────────

describe("suprema/facade env routing", () => {
  const ORIGINAL_ENV = process.env.SUPREMA_SCRAPER;
  afterEach(() => {
    process.env.SUPREMA_SCRAPER = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("defaults to simulator when env is unset", async () => {
    delete process.env.SUPREMA_SCRAPER;
    vi.resetModules();
    const facade = await import("./index");
    facade._resetSupremaScraper();
    const fallos = await facade.buscarFallos("indemnización");
    expect(Array.isArray(fallos)).toBe(true);
    expect(fallos[0]?.url).toContain("suprema.pjud.cl");
  });

  it("routes to playwright impl when SUPREMA_SCRAPER=playwright", async () => {
    process.env.SUPREMA_SCRAPER = "playwright";
    vi.resetModules();
    vi.doMock("playwright", () => ({
      chromium: { launch: vi.fn(async () => ({ newContext: vi.fn(), close: vi.fn() })) },
    }));
    const facade = await import("./index");
    facade._resetSupremaScraper();
    const scraper = facade.getSupremaScraper();
    const pw = await import("./playwright-scraper");
    expect(scraper.buscarFallos).toBe(pw.buscarFallos);
    expect(scraper.obtenerFallo).toBe(pw.obtenerFallo);
  });
});

// ─── Playwright impl (mocked) ────────────────────────────────────

interface MockState {
  selectorText: Record<string, string | null>;
  rowCounts: Record<string, number>;
  rowText: Record<string, string[]>;
  gotoUrls: string[];
}

const state: MockState = {
  selectorText: {},
  rowCounts: {},
  rowText: {},
  gotoUrls: [],
};

function makeElement(text: string | null) {
  return {
    textContent: async () => text,
    getAttribute: async () => "",
    $: async (sel: string) => {
      const arr = state.rowText[sel];
      if (!arr || arr.length === 0) return null;
      const t = arr.shift()!;
      return makeElement(t);
    },
  };
}

function makePage() {
  return {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    goto: vi.fn(async (url: string) => { state.gotoUrls.push(url); }),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    selectOption: vi.fn(async () => {}),
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

describe("suprema/playwright-scraper", () => {
  beforeEach(() => {
    state.selectorText = {};
    state.rowCounts = {};
    state.rowText = {};
    state.gotoUrls = [];
  });

  it("navigates to SUPREMA_BASE_URL when buscarFallos is called", async () => {
    const { buscarFallos, SUPREMA_BASE_URL, closeBrowser } = await import("./playwright-scraper");
    const fallos = await buscarFallos("despido");
    expect(state.gotoUrls).toContain(SUPREMA_BASE_URL);
    expect(Array.isArray(fallos)).toBe(true);
    await closeBrowser();
  });
});
