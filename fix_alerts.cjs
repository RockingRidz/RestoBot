const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);`;

const newStr = `    let priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);
    if (req.body.orders && req.body.orders.length > 0 && req.body.orders[0].baselinePrice) {
       priceCreeps = req.body.orders.map(o => ({
         ingredient_name: o.ingredient,
         increase_percent: ((o.currentPrice - o.baselinePrice) / o.baselinePrice) * 100,
         original_price: o.baselinePrice,
         current_price: o.currentPrice
       }));
    }`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Fixed price alerts from input');
