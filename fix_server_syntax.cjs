const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(/      \}\],\n      \},\n      formattedSmsText:/g, '      }],\n      formattedSmsText:');

fs.writeFileSync('server.ts', s);
