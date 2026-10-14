const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const oldEndpoint = serverCode.substring(
    serverCode.indexOf('// Call 1: Task 1 JSON Margin Guard'),
    serverCode.indexOf('} catch (err: any) {', serverCode.indexOf('// Call 1: Task 1 JSON Margin Guard'))
);

const newEndpoint = `    const requestedOrders = req.body.orders || [];
    
    const singlePrompt = \`\${getDynamicPrompt(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile)}
    
=== CURRENT INVENTORY AND PRICE ALERT CONTEXT ===
PRICE ALERTS: \${JSON.stringify(priceCreeps)}
RAG SUPPLIER CONTEXT: \${ragSupplierContext}

=== INPUT DATA PAYLOAD (Strict quantities to order) ===
\${JSON.stringify(requestedOrders, null, 2)}

Based on the prompt instructions and the context above, evaluate the highest risk ingredient to generate the priceSpikeAlert, AND generate the vendorDispatchNotes and formattedSmsText.
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

serverCode = serverCode.replace(oldEndpoint, newEndpoint);

fs.writeFileSync('server.ts', serverCode);
console.log('Endpoint updated.');
