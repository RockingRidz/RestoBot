const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const dynamicPromptSetup = `    const dynamicSystemPrompt = \`You are RestoBot AI, an enterprise supply chain and order automation engine.

CRITICAL TENANT RULES:
1. Strict User Context:
   - Active Restaurant: \${currentActiveProfile.restaurantName}
   - Location / ZIP: \${currentActiveProfile.location}
   - Active Cuisine: \${currentActiveProfile.cuisineType}
   - User / Manager: \${currentActiveProfile.userName}

2. Order Note Sender Integrity:
   - The "Order Placed By:" field in any generated dispatch note MUST strictly say "\${currentActiveProfile.restaurantName}".
   - NEVER default to fallback restaurant names like "Troy Grill & Diner" or "Calle Ocho".

3. Category-Locked Substitutions:
   - NEVER cross ingredient categories (Oils -> Oils only; Produce -> Produce only; Meats -> Meats only).
   - NEVER suggest meat or non-vegetarian items for pure-vegetarian/Vaishali concepts.

4. Strict Math Sync:
   - Use the exact net calculated quantities provided in the request payload. Do NOT alter case counts or unit numbers between the table and the text preview.
\`;`;

// Add dynamicSystemPrompt definition just before Task 1 JSON Margin Guard
const targetComment = '// Call 1: Task 1 JSON Margin Guard';
serverCode = serverCode.replace(targetComment, `${dynamicPromptSetup}\n\n    ${targetComment}`);

// Replace customAiSystemPrompt with dynamicSystemPrompt in generate-order
// But be careful to only replace it in generate-order.
const oldTask1 = '    const task1Prompt = `${customAiSystemPrompt}';
const newTask1 = '    const task1Prompt = `${dynamicSystemPrompt}';
// Since I already replaced the one in substitute-evaluation, the one at line 813 should be the first match if I start searching from generate-order.
// To be safe, I'll just use a regex that matches the one near // Call 1: Task 1 JSON Margin Guard

const oldBlock = `    // Call 1: Task 1 JSON Margin Guard
    const task1Prompt = \`\${customAiSystemPrompt}`;

const newBlock = `    // Call 1: Task 1 JSON Margin Guard
    const task1Prompt = \`\${dynamicSystemPrompt}`;

serverCode = serverCode.replace(oldBlock, newBlock);

const oldBlock2 = `    // Call 2: Task 2 Order Note String
    const task2Prompt = \`\${customAiSystemPrompt}`;

const newBlock2 = `    // Call 2: Task 2 Order Note String
    const task2Prompt = \`\${dynamicSystemPrompt}`;

serverCode = serverCode.replace(oldBlock2, newBlock2);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed generate-order prompts');
