const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const targetStr = `        const requestPayload = {
          orders: [
            { ingredient: "Ground Beef (80/20)", quantity: "1 x 40 lb Box" },
            { ingredient: "Brioche Buns", quantity: "4 Cases" },
            { ingredient: "Refined Frying Oil", quantity: "3 x 35 lb Jugs" }
          ]
        };`;

const newStr = `        const requestPayload = {
          forecast: {
            targetCovers: 240,
            safetyBufferPct: 0.10
          },
          inventory: [
            {
              itemName: "Heavy Cream (40% Fat)",
              category: "Dairy",
              grossNeed: "4.5 gal",
              onHand: "0.5 gal",
              netOrderNeeded: "1 x 4 gal Case (9/quart)",
              vendor: "Gordon Food Service (GFS)",
              currentPrice: 82.00,
              baselinePrice: 70.00
            },
            {
              itemName: "Yellow Onions (Jumbo)",
              category: "Produce",
              grossNeed: "85.0 lbs",
              onHand: "10.0 lbs",
              netOrderNeeded: "2 x 50 lb Sacks",
              vendor: "GFS Produce Direct",
              currentPrice: 32.00,
              baselinePrice: 32.00
            },
            {
              itemName: "Pure Ghee (Clarified Butter)",
              category: "Oils & Fats",
              grossNeed: "30.0 lbs",
              onHand: "2.0 lbs",
              netOrderNeeded: "1 x 35 lb Tub",
              vendor: "US Foods Commercial Direct",
              currentPrice: 145.00,
              baselinePrice: 145.00
            }
          ]
        };`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed dashboard payload');
