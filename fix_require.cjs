const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/require\('fs'\)\.appendFileSync\('gemini_errors\.log', err\.toString\(\) \+ '\\n'\);/g, '');
s = s.replace(/gemini-3\.5-flash/g, 'gemini-2.5-flash');
fs.writeFileSync('server.ts', s);
