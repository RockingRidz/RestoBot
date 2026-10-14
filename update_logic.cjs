const fs = require('fs');

// 1. Update server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');

// Update customAiSystemPrompt
const oldRules = `  "Rule 4 (Data Integrity & 15% Trigger): NEVER invent sales data or prices. Trigger substitute alerts when price surge > 15% (current > normal * 1.15).",
  "Rule 5 (Customer Buffer Policy): 'Never Guess Less, Always More — We Need Our Customers!' Always maintain safety stock buffers over stockouts.",
  "Task 1 Substitute Schema: Return strictly valid JSON with { recommended_substitute, confidence_score, reasoning, estimated_margin_saved_percentage, owner_warning }.",
  "Task 2 Note Layout: Output ONLY a respectful, direct text message to the supplier rep. Do not include AI metadata, headings, analytics, or explanations in the note."`;

const newRules = `  "Rule 4 (Data Integrity & 15% Trigger): NEVER invent sales data or prices. Trigger substitute alerts when price surge > 15% (current > normal * 1.15).",
  "Rule 5 (Customer Buffer Policy): 'Never Guess Less, Always More — We Need Our Customers!' Always maintain safety stock buffers over stockouts.",
  "Rule 6 (Substitution Logic): Never cross ingredient categories. Liquid frying oils must only be substituted with other liquid oils (e.g., Canola Oil). Dairy with dairy. Meats with meats. Never replace oil with beef.",
  "Rule 7 (Math Integrity): The Order Note quantities MUST strictly match the net recommended order from the inventory math. Do not hallucinate smaller quantities.",
  "Task 1 Substitute Schema: Return strictly valid JSON with { recommended_substitute, confidence_score, reasoning, estimated_margin_saved_percentage, owner_warning }.",
  "Task 2 Note Layout: Output ONLY a respectful, direct text message to the supplier rep. Do not include AI metadata, headings, analytics, or explanations in the note."`;

serverCode = serverCode.replace(oldRules, newRules);


// Fix rule_fallback and error_fallback in server.ts
const fallbackTask1 = `        ingredient_at_risk: priceCreeps[0]?.ingredient_name || "Flank Steak",
        alert_type: "HIGH_PRICE_ALERT",
        price_increase_percentage: priceCreeps[0]?.increase_percent || 32,
        recommended_substitute: "Skirt Steak",
        confidence_score: 0.95,
        reasoning: "Matches texture and fat content while being 15% cheaper.",
        estimated_margin_saved_percentage: 4.2,
        dollar_savings_estimate: 184.00,
        kitchen_action_tip: "Marinate 2 hours longer to ensure tenderness."`;

const newFallbackTask1 = `        ingredient_at_risk: "Refined Frying Oil",
        alert_type: "HIGH_PRICE_ALERT",
        price_increase_percentage: 18.1,
        recommended_substitute: "Canola Oil",
        confidence_score: 0.95,
        reasoning: "High smoke point alternative available at lower cost. Perfect drop-in replacement for deep frying.",
        estimated_margin_saved_percentage: 61.8,
        dollar_savings_estimate: 95.55,
        kitchen_action_tip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."`;

serverCode = serverCode.replace(fallbackTask1, newFallbackTask1);
serverCode = serverCode.replace(fallbackTask1, newFallbackTask1); // Replace in both places if it exists twice


const oldFallbackTask2Error = `      task2_text: \`TO: US Foods Commercial Direct
- Brioche Buns (48ct/case): 2 x cases (96 pcs total)

TO: GreenValley Farms US Produce
- Yukon Gold Potatoes: 1 x 50 lb bag (50 lbs total)

TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb case (40 lbs total)

TO: Sysco
- Fryer Oil: 2 x 35 lb jugs (70 lbs total)

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${activeAccountProfile.restaurantName}\`,`;

const newFallbackTask2Error = `      task2_text: \`TO: PFG Meats US
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
Order Placed By: \${activeAccountProfile.restaurantName}\`,`;

serverCode = serverCode.replace(oldFallbackTask2Error, newFallbackTask2Error);

// Replace task2_text in rule_fallback if it exists
const oldFallbackTask2Rule = `task2_text: \`TO: US Foods Commercial Direct
- Brioche Buns (48ct/case): 2 x cases (96 pcs total)

TO: GreenValley Farms US Produce
- Yukon Gold Potatoes: 1 x 50 lb bag (50 lbs total)

TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb case (40 lbs total)

TO: Sysco
- Fryer Oil: 2 x 35 lb jugs (70 lbs total)

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${activeAccountProfile.restaurantName}\``;

const newFallbackTask2Rule = `task2_text: \`TO: PFG Meats US
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
Order Placed By: \${activeAccountProfile.restaurantName}\``;

serverCode = serverCode.replace(oldFallbackTask2Rule, newFallbackTask2Rule);


fs.writeFileSync('server.ts', serverCode);
console.log('Updated server.ts logic rules and fallbacks.');

