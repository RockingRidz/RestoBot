const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(
  /priceSpikeAlerts: alertsArray,/g,
  `priceSpikeAlerts: alertsArray,\n      priceSpikeAlert: alertsArray[0] || { detected: false, originalIngredient: "", priceIncreasePct: 0, recommendedSubstitute: "", estimatedMarginSavingsUSD: 0, confidenceScorePct: 0, culinaryReasoning: "Prices are stable.", kitchenPrepTip: "Proceed with baseline vendors." },`
);

s = s.replace(
  /priceSpikeAlerts: \[\{/g,
  `priceSpikeAlert: {\n        detected: true,\n        originalIngredient: "Refined Frying Oil",\n        priceIncreasePct: 18.1,\n        recommendedSubstitute: "Canola Oil",\n        estimatedMarginSavingsUSD: 95.55,\n        confidenceScorePct: 95,\n        culinaryReasoning: "High smoke point alternative available at lower cost. Perfect drop-in replacement for deep frying.",\n        kitchenPrepTip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."\n      },\n      priceSpikeAlerts: [{`
);

// We should also make sure `vendorDispatchNotes` handles empty properly.
s = s.replace(
  /vendorDispatchNotes: \[\]/g,
  `vendorDispatchNotes: [{ vendorName: "Sysco", items: [] }]`
);

fs.writeFileSync('server.ts', s);
