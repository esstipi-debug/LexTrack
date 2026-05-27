import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Playwright mock plumbing ────────────────────────────────────
// We build a small in-memory "page" that drives the scraper. Each
// test can pre-program selector results (text / presence) and we
// expose a navigation log + a counter so we can assert retries and
// URL targeting without booting a real browser.

interface MockState {
  /** selector → text content (or null when missing) */
  selectorText: Record<string, string | null>;
  /** selector → number of matching rows; defaults to 0 unless set */
  rowCounts: Record<string, number>;
  /** per-row textContent per selector key */
  rowText: Record<string, string[]>;
  /** URLs page.goto was called with */
  gotoUrls: string[];
  /** how many times page.goto should throw before succeeding */
  transientFailures: number;
}

const state: MockState = {
  selectorText: {},
  rowCounts: {},
  rowText: {},
  gotoUrls: [],
  transientFailures: 0,
};

function makeElement(text: string | null) {
  return {
    textContent: async () => text,
    $: async (sel: string) => {
      // For row-level look-ups, just return an element whose textContent
      // is the matching entry in `rowText[sel]` cycling through. To keep
      // this simple we'll return a singleton-per-call backed by the next
      // value in the array.
      const arr = state.rowText[sel];
      if (!arr || arr.length === 0) return null;
      const t = arr.shift()!;
      return makeElement(t);
    },
    $$: async () => [],
  };
}

function makePage() {
  return {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    goto: vi.fn(async (url: string) => {
      state.gotoUrls.push(url);
      if (state.transientFailures > 0) {
        state.transientFailures -= 1;
        throw new Error("net::ERR_CONNECTION_RESET");
      }
    }),
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

function makeContext() {
  return {
    newPage: vi.fn(async () => makePage()),
    close: vi.fn(async () => {}),
  };
}

const browser = {
  newContext: vi.fn(async () => makeContext()),
  close: vi.fn(async () => {}),
};

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => browser),
  },
}));

// ─── Tests ───────────────────────────────────────────────────────

import {
  consultarCausa,
  closeBrowser,
  PJUD_BASE_URL,
  PjudNotFoundError,
  PjudUnavailableError,
  SELECTORS,
} from "./playwright-scraper";

beforeEach(() => {
  state.selectorText = {};
  state.rowCounts = {};
  state.rowText = {};
  state.gotoUrls = [];
  state.transientFailures = 0;
  browser.newContext.mockClear();
});

afterEach(async () => {
  await closeBrowser();
});

describe("playwright-scraper", () => {
  it("navigates to the PJUD base URL", async () => {
    // Program a successful response.
    state.selectorText[SELECTORS.resultsContainer] = "ok";
    state.selectorText[SELECTORS.causaCaratula] = "GONZALEZ con ACME";
    state.selectorText[SELECTORS.causaRuc] = "2025-1-L";
    state.selectorText[SELECTORS.causaTribunal] = "1er JLT Santiago";
    state.selectorText[SELECTORS.causaEstado] = "Tramitacion";
    state.selectorText[SELECTORS.causaEtapa] = "Discusion";
    state.selectorText[SELECTORS.causaFechaIngreso] = "2025-01-15";

    await consultarCausa("O-1234-2025");

    expect(state.gotoUrls).toContain(PJUD_BASE_URL);
  });

  it("retries on transient failures and eventually succeeds", async () => {
    state.transientFailures = 2; // first two goto() calls throw
    state.selectorText[SELECTORS.resultsContainer] = "ok";
    state.selectorText[SELECTORS.causaCaratula] = "PEREZ con ACME";
    state.selectorText[SELECTORS.causaRuc] = "2025-2-L";
    state.selectorText[SELECTORS.causaTribunal] = "1er JLT Santiago";
    state.selectorText[SELECTORS.causaEstado] = "Tramitacion";
    state.selectorText[SELECTORS.causaEtapa] = "Discusion";
    state.selectorText[SELECTORS.causaFechaIngreso] = "2025-02-01";

    const result = await consultarCausa("O-5678-2025");

    expect(state.gotoUrls.length).toBe(3); // 2 failures + 1 success
    expect(result).not.toBeNull();
    expect(result?.caratula).toBe("PEREZ con ACME");
  });

  it("gives up after MAX_RETRIES with PjudUnavailableError", async () => {
    state.transientFailures = 10; // always fail
    await expect(consultarCausa("O-9999-2025")).rejects.toBeInstanceOf(
      PjudUnavailableError,
    );
  });

  it("throws PjudNotFoundError when the result selector is empty", async () => {
    // resultsContainer missing → not found
    state.selectorText[SELECTORS.resultsContainer] = null;
    await expect(consultarCausa("O-0001-2025")).rejects.toBeInstanceOf(
      PjudNotFoundError,
    );
  });

  it("returns the DTO shape on success", async () => {
    state.selectorText[SELECTORS.resultsContainer] = "ok";
    state.selectorText[SELECTORS.causaCaratula] = "DIAZ con PACIFICO";
    state.selectorText[SELECTORS.causaRuc] = "2025-9-L";
    state.selectorText[SELECTORS.causaTribunal] = "JLT Valparaiso";
    state.selectorText[SELECTORS.causaEstado] = "Prueba";
    state.selectorText[SELECTORS.causaEtapa] = "Prueba";
    state.selectorText[SELECTORS.causaFechaIngreso] = "2025-03-10";

    const result = await consultarCausa("O-4242-2025", "JLT Valparaiso");

    expect(result).toEqual({
      rit: "O-4242-2025",
      ruc: "2025-9-L",
      caratula: "DIAZ con PACIFICO",
      tribunal: "JLT Valparaiso",
      estado: "Prueba",
      etapa: "Prueba",
      fechaIngreso: "2025-03-10",
      ultimoMovimiento: null,
      litigantes: [],
    });
    // sanity: structural keys all present
    expect(Object.keys(result!).sort()).toEqual(
      [
        "caratula",
        "estado",
        "etapa",
        "fechaIngreso",
        "litigantes",
        "rit",
        "ruc",
        "tribunal",
        "ultimoMovimiento",
      ].sort(),
    );
  });
});
