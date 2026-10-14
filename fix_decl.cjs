const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// I will just add it before 'const targetIngredientPrices'
s = s.replace(/const targetIngredientPrices/g, 'const requestedInventory = req.body.inventory || req.body.orders || [];\n    const targetIngredientPrices');
fs.writeFileSync('server.ts', s);
