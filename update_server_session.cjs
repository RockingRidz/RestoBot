const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Update generate-order to enforce session and replace prompt
const oldBlock = `app.post('/api/generate-order', async (req, res) => {
  try {
    const ai = getGeminiClient();`;

const newBlock = `app.post('/api/generate-order', async (req, res) => {
  try {
    // 1. DYNAMIC IDENTITY OVERRIDE (CRITICAL)
    const sessionHeader = req.headers['x-resto-session'];
    let sessionData = null;
    if (sessionHeader) {
      try {
        sessionData = typeof sessionHeader === 'string' ? JSON.parse(sessionHeader) : null;
      } catch (e) {}
    }

    if (!sessionData || !sessionData.restaurant_name || !sessionData.is_authenticated) {
      return res.status(401).json({ error: "Unauthorized: Active restaurant session not found." });
    }

    const currentActiveProfile = {
      restaurantName: sessionData.restaurant_name,
      location: sessionData.zip_code || activeAccountProfile.location,
      wholesaler: activeAccountProfile.wholesaler,
      userName: sessionData.user_name || "Manager",
      cuisineType: sessionData.cuisine_type || "Restaurant"
    };

    const ai = getGeminiClient();`;

serverCode = serverCode.replace(oldBlock, newBlock);

// Now update how we pass prompt and context
const oldTargetPrices = `const ragSupplierContext = buildSupplierRagPromptContext(targetIngredientPrices);`;
const newTargetPrices = `const ragSupplierContext = buildSupplierRagPromptContext(targetIngredientPrices, sessionData.restaurant_id);`;
serverCode = serverCode.replace(oldTargetPrices, newTargetPrices);

const oldTask1Prompt = `const task1Prompt = \`\${customAiSystemPrompt}`;
const newTask1Prompt = `let sessionPrompt = customAiSystemPrompt.replace(/Troy Grill & Diner/gi, currentActiveProfile.restaurantName);
    sessionPrompt = sessionPrompt.replace(/48084 \\(Troy, MI\\)/gi, currentActiveProfile.location);
    sessionPrompt += \`\n\nDYNAMIC TENANT OVERRIDE RULES:\n1. Active Restaurant Name: \${currentActiveProfile.restaurantName}\n2. Active Location / ZIP: \${currentActiveProfile.location}\n3. Active Cuisine / Concept: \${currentActiveProfile.cuisineType}\n4. Active Manager / Chef: \${currentActiveProfile.userName}\n5. The "Order Placed By:" field in the supplier dispatch note MUST match \${currentActiveProfile.restaurantName} EXACTLY.\`;

    const task1Prompt = \`\${sessionPrompt}`;
serverCode = serverCode.replace(oldTask1Prompt, newTask1Prompt);

const oldTask2Prompt = `const task2Prompt = \`\${customAiSystemPrompt}`;
const newTask2Prompt = `const task2Prompt = \`\${sessionPrompt}`;
serverCode = serverCode.replace(oldTask2Prompt, newTask2Prompt);

// Also fix fallback response
const oldFallback = "Order Placed By: ${activeAccountProfile.restaurantName}`";
const newFallback = "Order Placed By: ${currentActiveProfile.restaurantName}`";
serverCode = serverCode.replace(oldFallback, newFallback);
serverCode = serverCode.replace(oldFallback, newFallback);

fs.writeFileSync('server.ts', serverCode);
console.log('Updated server.ts with session logic');
