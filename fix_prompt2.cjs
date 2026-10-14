const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `Return ONLY a valid JSON object matching the requested schema.
\`;`;

const newStr = `Return ONLY a valid JSON object matching the requested schema. DO NOT wrap the output in markdown \`\`\`json blocks.
\`;`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Fixed json wrap rules');
