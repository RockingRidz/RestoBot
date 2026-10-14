const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const oldFallbackText = `      task2_text: \`TO: PFG Meats US
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
Order Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`,`;

const newFallbackText = `      task2_text: \`TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb Box

TO: Gordon Food Service - GFS Bakery
- Brioche Buns: 4 Cases

TO: US Foods Commercial Direct
- Refined Frying Oil: 3 x 35 lb Jugs

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName}\`,`;

serverCode = serverCode.replace(oldFallbackText, newFallbackText);
fs.writeFileSync('server.ts', serverCode);
console.log('Fixed fallback math sync');
