const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `const combinedJson = JSON.parse(rawText);`;
const newStr = `console.log("RAW TEXT FROM GEMINI:");\nconsole.log(rawText);\nconst combinedJson = JSON.parse(rawText);`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Added logging');
