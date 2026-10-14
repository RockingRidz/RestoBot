const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Fix /api/ai/advisor
serverCode = serverCode.replace(
  'const ragSupplierContext = buildSupplierRagPromptContext(targetIngredientPrices, sessionData.restaurant_id);',
  'const ragSupplierContext = buildSupplierRagPromptContext(targetIngredientPrices);'
);

// Fix /api/ai/substitute-evaluation
const subEvalBadBlock = `    let sessionPrompt = customAiSystemPrompt.replace(/Troy Grill & Diner/gi, currentActiveProfile.restaurantName);
    sessionPrompt = sessionPrompt.replace(/48084 \\(Troy, MI\\)/gi, currentActiveProfile.location);
    sessionPrompt += \`

DYNAMIC TENANT OVERRIDE RULES:
1. Active Restaurant Name: \${currentActiveProfile.restaurantName}
2. Active Location / ZIP: \${currentActiveProfile.location}
3. Active Cuisine / Concept: \${currentActiveProfile.cuisineType}
4. Active Manager / Chef: \${currentActiveProfile.userName}
5. The "Order Placed By:" field in the supplier dispatch note MUST match \${currentActiveProfile.restaurantName} EXACTLY.\`;

    const task1Prompt = \`\${sessionPrompt}`;

const subEvalGoodBlock = `    const task1Prompt = \`\${customAiSystemPrompt}`;

serverCode = serverCode.replace(subEvalBadBlock, subEvalGoodBlock);

// Fix /api/ai/format-daily-note
serverCode = serverCode.replace(
  'const task2Prompt = `${sessionPrompt}',
  'const task2Prompt = `${customAiSystemPrompt}'
);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed endpoints');
