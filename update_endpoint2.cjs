const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const targetEndpoint = serverCode.substring(
    serverCode.indexOf('// NEW ENDPOINT: /api/generate-order'),
    serverCode.indexOf('} catch (err: any) {', serverCode.indexOf('// NEW ENDPOINT: /api/generate-order'))
);

// I'll rewrite this whole endpoint block up to the catch block to be safe.
const newEndpoint = `// NEW ENDPOINT: /api/generate-order
app.post('/api/generate-order', async (req, res) => {
    const sessionHeader = req.headers['x-resto-session'];
    let sessionData: any = null;
    if (sessionHeader) {
      try {
        sessionData = typeof sessionHeader === 'string' ? JSON.parse(sessionHeader) : null;
      } catch (e) {}
    }

    if (!sessionData || !sessionData.restaurant_name || !sessionData.is_authenticated) {
      return res.status(401).json({ error: "Unauthorized: Active restaurant session not found." });
    }

    currentActiveProfile = {
      restaurantName: sessionData.restaurant_name,
      location: sessionData.zip_code || activeAccountProfile.location,
      wholesaler: (typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).wholesaler,
      userName: sessionData.user_name || "Manager",
      cuisineType: sessionData.cuisine_type || "Restaurant"
    };

  try {

    const ai = getGeminiClient();
    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);
    const targetIngredientPrices = dbIngredients.map(i => ({ name: i.name, currentPrice: i.cost_per_unit, normalPrice: (i as any).normal_price || i.cost_per_unit, stock: i.current_stock, unit: i.unit }));
    const ragSupplierContext = buildSupplierRagPromptContext(targetIngredientPrices);

    if (!ai) {
      // Mock Response when AI is not configured
      return res.json({
        task1_json: {
          ingredient_at_risk: "Refined Frying Oil",
          alert_type: "HIGH_PRICE_ALERT",
          price_increase_percentage: 18.1,
          recommended_substitute: "Canola Oil",
          confidence_score: 0.95,
          reasoning: "High smoke point alternative available at lower cost. Perfect drop-in replacement for deep frying.",
          estimated_margin_saved_percentage: 61.8,
          dollar_savings_estimate: 95.55,
          kitchen_action_tip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."
        },
        task2_text: \`TO: PFG Meats US\\n- Ground Beef (80/20): 1 x 40 lb Box\\n\\nTO: Gordon Food Service - GFS Bakery\\n- Brioche Buns: 4 Cases\\n\\nTO: US Foods Commercial Direct\\n- Refined Frying Oil: 3 x 35 lb Jugs\\n\\nTarget Delivery Date: Tomorrow\\nDelivery Window: Morning (5:00 AM - 10:00 AM)\\nOrder Placed By: \${currentActiveProfile.restaurantName}\`,
        _mode: "error_fallback"
      });
    }

    const requestedOrders = req.body.orders || [];
    
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
\`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: singlePrompt,
      config: { responseMimeType: 'application/json' }
    });
    
    const combinedJson = JSON.parse(response.text || '{}');
    const alert = combinedJson.priceSpikeAlert || {};
    
    const task1Json = {
        ingredient_at_risk: alert.originalIngredient || "Refined Frying Oil",
        alert_type: "HIGH_PRICE_ALERT",
        price_increase_percentage: alert.priceIncreasePct || 15,
        recommended_substitute: alert.recommendedSubstitute || "Canola Oil",
        confidence_score: (alert.confidenceScorePct || 95) / 100,
        reasoning: alert.culinaryReasoning || "Alternative available.",
        estimated_margin_saved_percentage: 0,
        dollar_savings_estimate: alert.estimatedMarginSavingsUSD || 0,
        kitchen_action_tip: alert.kitchenPrepTip || "No adjustments needed."
    };
    
    const task2Text = combinedJson.formattedSmsText || '';

    return res.json({
      task1_json: task1Json,
      task2_text: task2Text
    });
`;

serverCode = serverCode.replace(targetEndpoint, newEndpoint);

fs.writeFileSync('server.ts', serverCode);
console.log('Endpoint payload injection updated.');
