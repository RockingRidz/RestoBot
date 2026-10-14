const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    const combinedJson = JSON.parse(response.text || '{}');`;

const newStr = `    let rawText = response.text || '{}';
    if (rawText.includes('\`\`\`json')) {
      rawText = rawText.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
    } else if (rawText.includes('\`\`\`')) {
      rawText = rawText.split('\`\`\`')[1].split('\`\`\`')[0].trim();
    }
    const combinedJson = JSON.parse(rawText);`;

code = code.replace(targetStr, newStr);

fs.writeFileSync('server.ts', code);
console.log('Fixed json parsing');
