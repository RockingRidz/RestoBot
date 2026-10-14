const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const oldReturn = `    const task1Json = {
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
    });`;

const newReturn = `    return res.json({
      priceSpikeAlert: combinedJson.priceSpikeAlert,
      vendorDispatchNotes: combinedJson.vendorDispatchNotes,
      formattedSmsText: combinedJson.formattedSmsText
    });`;

serverCode = serverCode.replace(oldReturn, newReturn);

const oldFallback = `    // Fallback if AI quota exceeded or other error
    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);
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
      task2_text: \`TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb Box

TO: Gordon Food Service - GFS Bakery
- Brioche Buns: 4 Cases

TO: US Foods Commercial Direct
- Refined Frying Oil: 3 x 35 lb Jugs

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`,
      _mode: "error_fallback"
    });`;

const newFallback = `    // Fallback if AI quota exceeded or other error
    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);
    return res.json({
      priceSpikeAlert: {
        detected: true,
        originalIngredient: "Refined Frying Oil",
        priceIncreasePct: 18.1,
        recommendedSubstitute: "Canola Oil",
        estimatedMarginSavingsUSD: 95.55,
        confidenceScorePct: 95,
        culinaryReasoning: "High smoke point alternative available at lower cost. Perfect drop-in replacement for deep frying.",
        kitchenPrepTip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."
      },
      formattedSmsText: \`TO: PFG Meats US\\n- Ground Beef (80/20): 1 x 40 lb Box\\n\\nTO: Gordon Food Service - GFS Bakery\\n- Brioche Buns: 4 Cases\\n\\nTO: US Foods Commercial Direct\\n- Refined Frying Oil: 3 x 35 lb Jugs\\n\\nTarget Delivery Date: Tomorrow\\nDelivery Window: Morning (5:00 AM - 10:00 AM)\\nOrder Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`,
      vendorDispatchNotes: [],
      _mode: "error_fallback"
    });`;

serverCode = serverCode.replace(oldFallback, newFallback);

// Also need to fix mock response when AI is not configured
const oldMock = `    if (!ai) {
      // Mock Response when AI is not configured
      return res.json({
        task1_json: {
          ingredient_at_risk: priceCreeps[0]?.ingredient_name || "Flank Steak",
          alert_type: "HIGH_PRICE_ALERT",
          price_increase_percentage: priceCreeps[0]?.increase_percent || 32,
          recommended_substitute: "Skirt Steak",
          confidence_score: 0.95,
          reasoning: "Matches texture and fat content while being 15% cheaper.",
          estimated_margin_saved_percentage: 4.2,
          dollar_savings_estimate: 184.00,
          kitchen_action_tip: "Marinate 2 hours longer to ensure tenderness."
        },
        task2_text: \`TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb box

TO: Gordon Food Service - GFS Bakery
- Brioche Buns: 4 cases (72 pcs/case - 288 pcs total)
- Tortilla Wraps (10 inch): 1 case (144 pcs/case)

TO: US Foods Commercial Direct
- Refined Frying Oil: 3 x 35 lb jugs (~14 gal total)

TO: DairyCraft USA Creamery Direct
- Mozzarella & Cheddar Blend: 5 x 5 lb bags (25 lbs total)
- Paneer Blocks: 3 x 5 lb blocks (15 lbs total)

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`
      });
    }`;

const newMock = `    if (!ai) {
      // Mock Response when AI is not configured
      return res.json({
        priceSpikeAlert: {
          detected: true,
          originalIngredient: priceCreeps[0]?.ingredient_name || "Flank Steak",
          priceIncreasePct: priceCreeps[0]?.increase_percent || 32,
          recommendedSubstitute: "Skirt Steak",
          estimatedMarginSavingsUSD: 184.00,
          confidenceScorePct: 95,
          culinaryReasoning: "Matches texture and fat content while being 15% cheaper.",
          kitchenPrepTip: "Marinate 2 hours longer to ensure tenderness."
        },
        formattedSmsText: \`TO: PFG Meats US\\n- Ground Beef (80/20): 1 x 40 lb Box\\n\\nTO: Gordon Food Service - GFS Bakery\\n- Brioche Buns: 4 Cases\\n\\nTO: US Foods Commercial Direct\\n- Refined Frying Oil: 3 x 35 lb Jugs\\n\\nTarget Delivery Date: Tomorrow\\nDelivery Window: Morning (5:00 AM - 10:00 AM)\\nOrder Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`,
        vendorDispatchNotes: []
      });
    }`;

serverCode = serverCode.replace(oldMock, newMock);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed server format');
