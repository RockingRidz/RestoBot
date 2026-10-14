const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

// The original serverCode probably has `const dynamicSystemPrompt = \`...` blocks that try to use `currentActiveProfile` or `dynamicSystemPrompt`. Let's remove them or replace them with `getDynamicPrompt`.

serverCode = serverCode.replace(/const dynamicSystemPrompt = `[\s\S]*?`;/g, '');

serverCode = serverCode.replace(/const task1Prompt = `\$\{dynamicSystemPrompt\}/g, 'const task1Prompt = `${getDynamicPrompt(currentActiveProfile)}');
serverCode = serverCode.replace(/const task2Prompt = `\$\{dynamicSystemPrompt\}/g, 'const task2Prompt = `${getDynamicPrompt(currentActiveProfile)}');
serverCode = serverCode.replace(/const task2Prompt = `\$\{sessionPrompt\}/g, 'const task2Prompt = `${getDynamicPrompt(currentActiveProfile)}');
serverCode = serverCode.replace(/const task1Prompt = `\$\{sessionPrompt\}/g, 'const task1Prompt = `${getDynamicPrompt(currentActiveProfile)}');

// Fix buildSupplierRagPromptContext to remove the extra argument
serverCode = serverCode.replace(/buildSupplierRagPromptContext\(targetIngredientPrices, sessionData\.restaurant_id\)/g, 'buildSupplierRagPromptContext(targetIngredientPrices)');

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed more errors');
