const fs = require('fs');
let s = fs.readFileSync('src/tests/generate-order.test.ts', 'utf8');
s = s.replace(/const res = await fetch\(ENDPOINT/g, 'await new Promise(r => setTimeout(r, 4000));\n  const res = await fetch(ENDPOINT');
fs.writeFileSync('src/tests/generate-order.test.ts', s);
