const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = "DO NOT wrap the output in markdown ```json blocks.";
code = code.replace(targetStr, "DO NOT wrap the output in markdown blocks. Output raw JSON only.");
fs.writeFileSync('server.ts', code);
