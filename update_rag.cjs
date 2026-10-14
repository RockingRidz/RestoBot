const fs = require('fs');

let ragCode = fs.readFileSync('src/lib/supplierRag.ts', 'utf8');

// Update buildSupplierRagPromptContext to accept restaurantId
ragCode = ragCode.replace(
  /export function buildSupplierRagPromptContext\(\s*targetIngredients: \{ name: string; currentPrice: number \}\[\]\s*\): string \{/g,
  `export function buildSupplierRagPromptContext(
  targetIngredients: { name: string; currentPrice: number }[],
  restaurantId?: string
): string {`
);

ragCode = ragCode.replace(
  /const matches = querySupplierRag\(item.name, item.currentPrice, 2\);/g,
  `const matches = querySupplierRag(item.name, item.currentPrice, 2, restaurantId);`
);

ragCode = ragCode.replace(
  /export function querySupplierRag\(\s*ingredientQuery: string,\s*currentPrice: number = 0,\s*maxResults: number = 3\s*\): RagSearchResult\[\] \{/g,
  `export function querySupplierRag(
  ingredientQuery: string,
  currentPrice: number = 0,
  maxResults: number = 3,
  restaurantId?: string
): RagSearchResult[] {`
);

// Add filtering logic to querySupplierRag
const filterLogic = `  for (const supplier of MARKET_SUPPLIER_DIRECTORY) {`;
const newFilterLogic = `  for (const supplier of MARKET_SUPPLIER_DIRECTORY) {
    // Filter by restaurantId if provided (mock logic: sup_001, sup_002, sup_004, sup_006, sup_007 for rest_001, otherwise different ones)
    if (restaurantId && restaurantId === 'rest_001') {
      if (!['sup_001', 'sup_002', 'sup_004', 'sup_006', 'sup_007', 'sup_003', 'sup_005'].includes(supplier.id)) {
         // Actually, let's just make a rule that the restaurant is attached to these suppliers
      }
    }
    if (restaurantId && supplier.allowedRestaurants && !supplier.allowedRestaurants.includes(restaurantId)) {
        continue;
    }`;

// Wait, easier to just say if (restaurantId) filter. We will just pass it down and add some dummy filter or just ignore it if no schema exists, but let's add it to the prompt.
