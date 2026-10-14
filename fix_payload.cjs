const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    const requestedOrders = req.body.orders || [];
    
    const sessionPayload = {
      restaurantName: currentActiveProfile.restaurantName,
      cuisineType: currentActiveProfile.cuisineType,
      managerName: currentActiveProfile.userName,
      isPureVegetarian: currentActiveProfile.cuisineType.toLowerCase().includes("vegetarian")
    };

    const singlePrompt = \`\${customAiSystemPrompt}
    
=== INPUT DATA PAYLOAD ===
{
  "session": \${JSON.stringify(sessionPayload, null, 2)},
  "inventory": \${JSON.stringify(requestedOrders, null, 2)},
  "priceAlerts": \${JSON.stringify(priceCreeps, null, 2)},
  "supplierContext": \${JSON.stringify(ragSupplierContext, null, 2)}
}

Based on the prompt instructions and the INPUT DATA PAYLOAD above, evaluate the highest risk ingredient to generate the priceSpikeAlert, AND generate the vendorDispatchNotes and formattedSmsText.
Return ONLY a valid JSON object matching the requested schema.
\`;`;

const newStr = `    const requestedInventory = req.body.inventory || req.body.orders || [];
    const requestedForecast = req.body.forecast || {};
    
    const sessionPayload = {
      restaurantName: currentActiveProfile.restaurantName,
      cuisineType: currentActiveProfile.cuisineType,
      managerName: currentActiveProfile.userName,
      isPureVegetarian: currentActiveProfile.cuisineType.toLowerCase().includes("vegetarian")
    };

    const singlePrompt = \`\${customAiSystemPrompt}
    
=== INPUT DATA PAYLOAD ===
{
  "session": \${JSON.stringify(sessionPayload, null, 2)},
  "forecast": \${JSON.stringify(requestedForecast, null, 2)},
  "inventory": \${JSON.stringify(requestedInventory, null, 2)},
  "priceAlerts": \${JSON.stringify(priceCreeps, null, 2)},
  "supplierContext": \${JSON.stringify(ragSupplierContext, null, 2)}
}

Based on the prompt instructions and the INPUT DATA PAYLOAD above, evaluate the highest risk ingredient to generate the priceSpikeAlert, AND generate the vendorDispatchNotes and formattedSmsText.
Return ONLY a valid JSON object matching the requested schema.
\`;`;

serverCode = serverCode.replace(targetStr, newStr);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed payload structure');
