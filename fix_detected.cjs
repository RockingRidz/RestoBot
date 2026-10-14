const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/\) : task1Data \? \(/g, ') : (task1Data && task1Data.detected) ? (');

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed detected condition');
