const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/gemini-1\.5-flash/g, 'gemini-2.5-flash');
fs.writeFileSync('server.ts', s);
