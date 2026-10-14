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

// Replace `const task1Prompt = \`\${customAiSystemPrompt}`
serverCode = serverCode.replace(
    'const task1Prompt = `${customAiSystemPrompt}',
    `${dynamicPromptSetup}\n    const task1Prompt = \`\${dynamicSystemPrompt}`
);

serverCode = serverCode.replace(
    'const task2Prompt = `${customAiSystemPrompt}',
    'const task2Prompt = `${dynamicSystemPrompt}'
);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed prompts');
