const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `4. COMMERCIAL PACK CONVERSION & MATH SYNCHRONIZATION:`;

const newStr = `5. PRICE SPIKE CONDITION:
   - IF NO ingredient has a price increase >= 10%:
     Set "priceSpikeAlert": { "detected": false, "originalIngredient": "", "priceIncreasePct": 0, "recommendedSubstitute": "", "estimatedMarginSavingsUSD": 0, "confidenceScorePct": 0, "culinaryReasoning": "Prices are stable.", "kitchenPrepTip": "Proceed with baseline vendors." }
   - EVEN IF "detected" is false, you MUST STILL GENERATE valid "vendorDispatchNotes" and a "formattedSmsText" summarizing the total items to be ordered based on the requested orders.

4. COMMERCIAL PACK CONVERSION & MATH SYNCHRONIZATION:`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Fixed prompt conditions');
