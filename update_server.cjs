const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update Task 2 in the system prompt template (initial)
const oldTask2Initial = `TASK 2: DAILY SMART ORDER NOTE (FORMATTED FOR SMS / EMAIL COPY-PASTE)
When generating the final Daily Smart Order Note, strictly structure it as a respectful, natural-sounding text message directly to the rep, omitting AI metadata, headings, or analytics.

FORMAT REQUIREMENT:
Hey [Wholesaler],
For tomorrow morning's delivery, please send the following to [Restaurant Name]:

- [Quantity] [Package Size/Unit] [Ingredient Name]
- [Quantity] [Package Size/Unit] [Ingredient Name]
...

Thanks,
[Restaurant Name]`;

const newTask2 = `TASK 2: SUPPLIER DISPATCH NOTE (TEXT FOR SMS/EMAIL/WHATSAPP)
This is the ONLY text that will be copied to the clipboard. It must strictly contain vendor order instructions with NO internal data, metrics, or margins. Group the required items by their respective US Supplier.

FORMAT REQUIREMENT:
TO: [Supplier Name]
- [Ingredient Name]: [Quantity] x [Package Size] ([Total amount])
...

TO: [Another Supplier Name]
- [Ingredient Name]: [Quantity] x [Package Size] ([Total amount])
...

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: [Restaurant Name]`;

code = code.split(oldTask2Initial).join(newTask2);

// Update few shot example
const oldFewShot = `Hey US Foods,
For tomorrow morning's delivery, please send the following to Main Street Burger Co.:

- 1 Box (45 lb) Skirt Steak
- 1 Bag (50 lb) Potatoes
- 4 Cases (24ct) Brioche Buns
- 2 Jugs (35 lb) Frying Oil

Thanks,
Main Street Burger Co.`;

const newFewShot = `TO: US Foods
- Skirt Steak: 1 x 45 lb box (45 lbs total)
- Brioche Buns: 4 cases (24ct)

TO: GreenValley Produce
- Potatoes: 1 x 50 lb bag (50 lbs total)

TO: Sysco Wholesale
- Frying Oil: 2 x 35 lb jugs (70 lbs total)

Target Delivery Date: Saturday, June 13
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: Main Street Burger Co.`;

code = code.split(oldFewShot).join(newFewShot);

// Update mock response
const oldMockTask2 = `Hey Mike (US Foods),
For tomorrow morning's delivery, please send the following to \${activeAccountProfile.restaurantName}:

- 2 Cases Brioche Buns (48ct/case)
- 1 Bag (50 lb) Yukon Gold Potatoes
- 40 lbs Ground Beef (80/20)
- 2 Jugs (35 lb) Fryer Oil

Thanks,
\${activeAccountProfile.restaurantName}`;

const newMockTask2 = `TO: US Foods Commercial Direct
- Brioche Buns (48ct/case): 2 x cases (96 pcs total)

TO: GreenValley Farms US Produce
- Yukon Gold Potatoes: 1 x 50 lb bag (50 lbs total)

TO: PFG Meats US
- Ground Beef (80/20): 1 x 40 lb case (40 lbs total)

TO: Sysco
- Fryer Oil: 2 x 35 lb jugs (70 lbs total)

Target Delivery Date: Tomorrow
Delivery Window: Morning (5:00 AM - 10:00 AM)
Order Placed By: \${activeAccountProfile.restaurantName}`;

code = code.split(oldMockTask2).join(newMockTask2);

fs.writeFileSync('server.ts', code);
console.log("server.ts updated!");
