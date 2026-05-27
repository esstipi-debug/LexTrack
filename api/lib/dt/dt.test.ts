import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as simulator from "./simulator";
import { _resetDtScraper, getDtScraper } from "./index";

describe("DT simulator", () => {
  it("buscarDictamenes returns 3-5 DtDictamen DTOs with required fields", async () => {
    const out = await simulator.buscarDictamenes("jornada");
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(5);
    for (const d of out) {
      expect(d.ordinario).toMatch(/^\d+\/\d{2,4}$/);
      expect(d.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.materia).toBe("string");
      expect(typeof d.sumario).toBe("string");
      expect(d.url).toMatch(/^https?:\/\//);
    }
  });

  it("obtenerDictamen returns a dictamen with texto for a valid ordinario", async () => {
    const d = await simulator.obtenerDictamen("1234/2024");
    expect(d).not.toBeNull();
    expect(d!.ordinario).toBe("1234/2024");
    expect(typeof d!.texto).toBe("string");
    expect(d!.texto!.length).toBeGreaterThan(0);
  });
});

describe("DT facade env routing", () => {
  const prev = process.env.DT_SCRAPER;
  beforeEach(() => _resetDtScraper());
  afterEach(() => {
    if (prev === undefined) delete process.env.DT_SCRAPER;
    else process.env.DT_SCRAPER = prev;
    _resetDtScraper();
  });

  it("defaults to the simulator when DT_SCRAPER is unset", async () => {
    delete process.env.DT_SCRAPER;
    const impl = getDtScraper();
    const out = await impl.buscarDictamenes("feriado");
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the simulator on unknown values (not 'playwright')", async () => {
    process.env.DT_SCRAPER = "garbage";
    const impl = getDtScraper();
    const out = await impl.buscarDictamenes("");
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});

describe("DT playwright impl (mocked)", () => {
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

  it("buscarDictamenes returns [] when no rows match", async () => {
    const mod = await import("./playwright-scraper");
    const out = await mod.buscarDictamenes("nada");
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(0);
    await mod.closeBrowser();
  });
});
