const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/task1Data\.ingredient_at_risk/g, 'task1Data.originalIngredient');
code = code.replace(/task1Data\.price_increase_percentage/g, 'task1Data.priceIncreasePct');

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed fields in Dashboard.tsx');
