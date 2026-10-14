export interface SupplierVendor {
  id: string;
  name: string;
  category: string;
  ingredientsSupplied: string[];
  unitPrices: { [key: string]: number };
  unitTypes: { [key: string]: string };
  qualityRating: number;
  deliveryLeadTimeDays: number;
  minOrderValue: number;
  certifications: string[];
  contactEmail: string;
  contactPhone: string;
  region: string;
  isVerified: boolean;
  notes: string;
}

export const MARKET_SUPPLIER_DIRECTORY: SupplierVendor[] = [
  {
    id: 'sup_001',
    name: 'Sysco',
    category: 'Pantry',
    ingredientsSupplied: ['Oil', 'Flour', 'Salt'],
    unitPrices: { 'Oil': 2.1, 'Flour': 0.6, 'Salt': 0.4 },
    unitTypes: { 'Oil': 'gal', 'Flour': 'lb', 'Salt': 'lb' },
    qualityRating: 4.8,
    deliveryLeadTimeDays: 1,
    minOrderValue: 150,
    certifications: ['USDA'],
    contactEmail: 'orders@sysco.com',
    contactPhone: '+1-800-555-7972',
    region: 'US',
    isVerified: true,
    notes: 'Distributor'
  },
  {
    id: 'sup_003',
    name: 'Restaurant Depot',
    category: 'Dairy',
    ingredientsSupplied: ['Mozzarella', 'Cream Cheese'],
    unitPrices: { 'Mozzarella': 3.35, 'Cream Cheese': 2.8 },
    unitTypes: { 'Mozzarella': 'lb', 'Cream Cheese': 'lb' },
    qualityRating: 4.7,
    deliveryLeadTimeDays: 1,
    minOrderValue: 100,
    certifications: ['USDA'],
    contactEmail: 'supply@rd.com',
    contactPhone: '+1-800-545-3376',
    region: 'US',
    isVerified: true,
    notes: 'Direct'
  }
];

export interface RagSearchResult {
  supplier: SupplierVendor;
  matchedIngredient: string;
  offeredUnitPrice: number;
  unitType: string;
  priceSavingsPercentage: number;
  relevanceScore: number;
}

export function querySupplierRag(ingredientQuery: string, currentPrice: number = 0, maxResults: number = 3): RagSearchResult[] {
  const queryLower = ingredientQuery.toLowerCase().trim();
  const results: RagSearchResult[] = [];
  const forbiddenPairs: Record<string, string[]> = {
    'mozzarella': ['cream cheese', 'ricotta', 'feta'],
    'heavy cream': ['milk', 'half and half']
  };

  for (const supplier of MARKET_SUPPLIER_DIRECTORY) {
    for (const [ingredientName, price] of Object.entries(supplier.unitPrices)) {
      const ingLower = ingredientName.toLowerCase();
      let isForbidden = false;
      for (const [target, forbidden] of Object.entries(forbiddenPairs)) {
        if (queryLower.includes(target) && forbidden.some(f => ingLower.includes(f))) {
          isForbidden = true;
          break;
        }
      }
      if (isForbidden) continue;

      let matchScore = 0;
      if (ingLower === queryLower) matchScore = 100;
      else if (ingLower.includes(queryLower) || queryLower.includes(ingLower)) matchScore = 70;

      if (matchScore > 0) {
        let savingsPct = currentPrice > 0 ? Math.round(((currentPrice - price) / currentPrice) * 100 * 10) / 10 : 0;
        let score = matchScore * 0.6 + (supplier.qualityRating * 4);
        results.push({
          supplier,
          matchedIngredient: ingredientName,
          offeredUnitPrice: price,
          unitType: supplier.unitTypes[ingredientName] || 'unit',
          priceSavingsPercentage: savingsPct,
          relevanceScore: Math.round(score)
        });
      }
    }
  }
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, maxResults);
}

export function buildSupplierRagPromptContext(targetIngredients: { name: string; currentPrice: number }[]): string {
  let ragText = 'AI MARKET SUPPLIER RAG DIRECTORY:\n';
  let matchCount = 0;
  for (const item of targetIngredients) {
    const matches = querySupplierRag(item.name, item.currentPrice, 2);
    if (matches.length > 0) {
      matchCount++;
      ragText += `\nIngredient: "${item.name}" (Current: $${item.currentPrice.toFixed(2)}):\n`;
      matches.forEach((m, idx) => {
        ragText += `  ${idx + 1}. ${m.supplier.name} | ${m.matchedIngredient} | $${m.offeredUnitPrice.toFixed(2)}/${m.unitType}\n`;
      });
    }
  }
  if (matchCount === 0) ragText += 'No overrides found.\n';
  return ragText;
}