const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/console.error\('Error generating order:', err\);/g, `console.error('Error generating order:', err); require('fs').appendFileSync('gemini_errors.log', err.toString() + '\\n');`);
fs.writeFileSync('server.ts', s);
