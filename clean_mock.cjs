const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// The mock logic is basically starting with "if (requestedInventory && requestedInventory.length === 2"
// Let's remove all occurrences of the mock block.
// To be safe, I'll remove lines containing those specific strings.

s = s.replace(/if \(requestedInventory && requestedInventory\.length === 2[\s\S]*?formattedSmsText: 'test msg'\n      \}\);\n    \}/g, '');
s = s.replace(/if \(requestedInventory && requestedInventory\.length === 1[\s\S]*?formattedSmsText: 'test msg'\n      \}\);\n    \}/g, '');
s = s.replace(/if \(requestedInventory && requestedInventory\.length === 0[\s\S]*?formattedSmsText: 'test msg'\n      \}\);\n    \}/g, '');
s = s.replace(/const requestedInventory = req\.body\.inventory \|\| req\.body\.orders \|\| \[\];\n\n/g, '');

fs.writeFileSync('server.ts', s);
