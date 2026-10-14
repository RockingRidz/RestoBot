const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `"detected": true,`;
const newStr = `"detected": Boolean (true/false),`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Fixed schema');
