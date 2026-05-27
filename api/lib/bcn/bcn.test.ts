import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as simulator from "./simulator";
import { _resetBcnScraper, getBcnScraper } from "./index";

describe("BCN simulator", () => {
  it("buscarNormas returns 3-5 BcnNorma DTOs with required fields", async () => {
    const out = await simulator.buscarNormas("Ley Karin");
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(5);
    for (const n of out) {
      expect(typeof n.numero).toBe("string");
      expect(typeof n.titulo).toBe("string");
      expect(typeof n.tipo).toBe("string");
      expect(n.fechaPublicacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.url).toMatch(/^https?:\/\//);
    }
  });

  it("obtenerNorma returns a norma with texto when found by number", async () => {
    const n = await simulator.obtenerNorma("21.643");
    expect(n).not.toBeNull();
    expect(n!.numero).toBe("21.643");
    expect(typeof n!.texto).toBe("string");
    expect(n!.texto!.length).toBeGreaterThan(0);
  });
});

describe("BCN facade env routing", () => {
  const prev = process.env.BCN_SCRAPER;
  beforeEach(() => _resetBcnScraper());
  afterEach(() => {
    if (prev === undefined) delete process.env.BCN_SCRAPER;
    else process.env.BCN_SCRAPER = prev;
    _resetBcnScraper();
  });

  it("defaults to the simulator when BCN_SCRAPER is unset", async () => {
    delete process.env.BCN_SCRAPER;
    const impl = getBcnScraper();
    const out = await impl.buscarNormas("jornada");
    // Simulator returns 3-5 deterministic results.
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the simulator on unknown values (not 'playwright')", async () => {
    process.env.BCN_SCRAPER = "garbage";
    const impl = getBcnScraper();
    const out = await impl.buscarNormas("");
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});

describe("BCN playwright impl (mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("playwright", () => ({
      chromium: {
        launch: vi.fn(async () => ({
          newContext: vi.fn(async () => ({
            newPage: vi.fn(async () => ({
              setDefaultNavigationTimeout: vi.fn(),
              setDefaultTimeout: vi.fn(),
              goto: vi.fn(async () => {}),
              fill: vi.fn(async () => {}),
              click: vi.fn(async () => {}),
              waitForLoadState: vi.fn(async () => {}),
              $: vi.fn(async () => null),
              $$: vi.fn(async () => []),
            })),
            close: vi.fn(async () => {}),
          })),
          close: vi.fn(async () => {}),
        })),
      },
    }));
  });
  afterEach(() => {
    vi.doUnmock("playwright");
  });

  it("buscarNormas returns [] when results container is empty (no rows match)", async () => {
    const mod = await import("./playwright-scraper");
    const out = await mod.buscarNormas("nada");
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(0);
    await mod.closeBrowser();
  });
});
