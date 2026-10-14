const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace('=== INPUT DATA PAYLOAD ===', `=== PRICE SPIKE CONDITION ===
- IF NO ingredient has a price increase >= 10%:
  Set "priceSpikeAlert": { "detected": false, "originalIngredient": "", "priceIncreasePct": 0, "recommendedSubstitute": "", "estimatedMarginSavingsUSD": 0, "confidenceScorePct": 0, "culinaryReasoning": "Prices are stable.", "kitchenPrepTip": "Proceed with baseline vendors." }
- EVEN IF "detected" is false, you MUST STILL GENERATE valid "vendorDispatchNotes" and a "formattedSmsText" summarizing the total items to be ordered.

=== INPUT DATA PAYLOAD ===`);

fs.writeFileSync('server.ts', s);
