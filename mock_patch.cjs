const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace('if (requestedInventory && requestedInventory.length === 2', 'const requestedInventory = req.body.inventory || req.body.orders || [];\nif (requestedInventory && requestedInventory.length === 2');
fs.writeFileSync('server.ts', s);
