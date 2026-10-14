const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/_mode: "error_fallback"/g, '_mode: "error_fallback", errorMsg: err.message');
fs.writeFileSync('server.ts', s);
