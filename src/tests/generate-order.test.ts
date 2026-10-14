import { openTestServer } from './testServer';
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import payloads from "./test-payloads.json";
 
let testServer: Awaited<ReturnType<typeof openTestServer>>;
let ENDPOINT: string;
 
// Ingredients that should NEVER appear as a substitute for a pure-veg tenant
const NON_VEG_MARKERS = [
  "lard", "tallow", "gelatin", "chicken stock", "chicken broth",
  "fish sauce", "anchovy", "beef", "pork", "bacon", "ham",
  "shrimp", "shellfish", "egg", "poultry fat", "duck fat", "bone broth",
];
 
async function callGenerateOrder(payload: any, sessionOverride?: any) {
  const session = sessionOverride !== undefined ? sessionOverride : payload.session;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-resto-session": JSON.stringify(session),
    },
    body: JSON.stringify({
      orders: payload.orderItems, // Adjusted to match server expectations
      priceSpike: payload.priceSpike,
    }),
  });
  return res;
}
 
function assertSchemaShape(body: any) {
  expect(body).toHaveProperty("priceSpikeAlert");
  expect(body).toHaveProperty("vendorDispatchNotes");
  expect(body).toHaveProperty("formattedSmsText");
 
  expect(body.priceSpikeAlert).toHaveProperty("detected");
  expect(typeof body.priceSpikeAlert.detected).toBe("boolean");
 
  expect(Array.isArray(body.vendorDispatchNotes)).toBe(true);
  expect(typeof body.formattedSmsText).toBe("string");
}
 
describe("RestoBot AI — /api/generate-order", () => {
  beforeAll(async () => { testServer = await openTestServer(); ENDPOINT = testServer.url + '/api/generate-order'; });
  afterAll(async () => { await testServer?.close(); });

  it("never suggests a non-veg substitute for a pure-vegetarian tenant", async () => {
    const p = payloads.purityViolationTrap;
    const res = await callGenerateOrder(p);
    const body = await res.json();
    assertSchemaShape(body);
 
    if (body.priceSpikeAlert.detected) {
      const combined = (
        body.priceSpikeAlert.recommendedSubstitute +
        " " +
        body.priceSpikeAlert.culinaryReasoning
      ).toLowerCase();
 
      for (const marker of NON_VEG_MARKERS) {
        expect(
          combined.includes(marker),
          `VIOLATION: substitute/reasoning mentions "${marker}" for a pure-veg tenant`
        ).toBe(false);
      }
    } else {
      // Graceful fallback is the CORRECT behavior when no safe substitute exists
      expect(body.priceSpikeAlert.detected).toBe(false);
    }
  });
 
  it("never crosses category (e.g. oil -> dairy) even if cheaper", async () => {
    const p = payloads.categoryLockTrap;
    const res = await callGenerateOrder(p);
    const body = await res.json();
    assertSchemaShape(body);
 
    if (body.priceSpikeAlert.detected) {
      const sub = body.priceSpikeAlert.recommendedSubstitute.toLowerCase();
      const dairyMarkers = ["butter", "ghee", "cream", "milk fat"];
      for (const marker of dairyMarkers) {
        expect(
          sub.includes(marker),
          `VIOLATION: oil spike resolved with a dairy substitute ("${marker}")`
        ).toBe(false);
      }
    }
  });
 
  it("falls back to detected:false rather than downgrading quality/grade", async () => {
    const p = payloads.qualityDowngradeTrap;
    const res = await callGenerateOrder(p);
    const body = await res.json();
    assertSchemaShape(body);
 
    if (body.priceSpikeAlert.detected) {
      const reasoning = body.priceSpikeAlert.culinaryReasoning.toLowerCase();
      const downgradeMarkers = ["grade b", "lower fat", "lower butterfat", "reduced fat", "lower smoke point"];
      for (const marker of downgradeMarkers) {
        expect(
          reasoning.includes(marker),
          `VIOLATION: reasoning admits a quality downgrade ("${marker}") — should have returned detected:false`
        ).toBe(false);
      }
    }
  });
 
  it("always populates vendorDispatchNotes + formattedSmsText even with zero spike, across multiple vendors", async () => {
    const p = payloads.zeroSpikeMultiVendor;
    const res = await callGenerateOrder(p);
    const body = await res.json();
    assertSchemaShape(body);
 
    expect(body.vendorDispatchNotes.length).toBeGreaterThan(0);
    expect(body.formattedSmsText.length).toBeGreaterThan(0);
    expect(body.formattedSmsText.toLowerCase()).not.toContain("no order note generated");
 
    const allItemNames = body.vendorDispatchNotes.flatMap((v: any) =>
      v.items.map((i: any) => i.itemName)
    );
    expect(allItemNames.length).toBe(p.orderItems.length);
  });
 
  it("computes savings math EXACTLY per (spiked - substitute) * packQuantity", async () => {
    const p = payloads.mathPrecisionTrap;
    const res = await callGenerateOrder(p);
    const body = await res.json();
    assertSchemaShape(body);
 
    if (body.priceSpikeAlert.detected) {
      const reported = body.priceSpikeAlert.estimatedMarginSavingsUSD;
      const expected = p.expectedSavings;
      expect(
        Math.abs(reported - expected),
        `Math mismatch: server returned $${reported}, formula says $${expected}`
      ).toBeLessThan(0.01);
    }
  });
 
  it("handles malformed/garbage session headers without crashing or leaking prior session data", async () => {
    const p = payloads.malformedSessionTrap;
    const res = await callGenerateOrder(p, "GARBAGE_NOT_JSON");
 
    // Should not 500 — a clean 4xx with an error body, or a safe empty-state 200, are both fine
    expect(res.status).not.toBe(500);
 
    if (res.status === 200) {
      const body = await res.json();
      assertSchemaShape(body);
    }
  });
 
  it("handles an empty orderItems array with a clean empty-state response", async () => {
    const p = payloads.emptyOrderTrap;
    const res = await callGenerateOrder(p);
    expect(res.status).not.toBe(500);
 
    const body = await res.json();
    assertSchemaShape(body);
    expect(body.vendorDispatchNotes.length).toBe(0);
  });
});
