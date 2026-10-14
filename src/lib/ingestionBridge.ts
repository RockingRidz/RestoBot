import { SalesRecord, Ingredient } from '../types';

/**
 * THE UNIVERSAL INGESTION BRIDGE
 * Solves the "Manual CSV Barrier" by allowing data to enter via 
 * Natural Language, Structured CSV, or Manual Tally.
 */
export interface IngestionResult {
  records: SalesRecord[];
  parsedItems: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export async function parseNaturalLanguageSales(
  text: string, 
  ai: any, 
  restaurantId: string = 'rest_001'
): Promise<IngestionResult> {
  if (!text || text.trim().length < 5) {
    return { records: [], parsedItems: 0, confidence: 'low', warnings: ['Input text too short to parse.'] };
  }

  const prompt = `
    You are a professional restaurant data analyst. Convert the following natural language sales report into a structured JSON array of SalesRecords.
    
    INPUT TEXT: "${text}"
    
    REQUIRED JSON FORMAT:
    [
      { "item_name": "string", "quantity_sold": number, "unit_price": number, "sold_at": "ISO Date" }
    ]
    
    RULES:
    1. If price is not mentioned, use a reasonable estimate or 0.
    2. If date is not mentioned, use today's date.
    3. Return ONLY the JSON array. No conversational text.
  `;

  try {
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
    });
    const responseText = result.text || '';
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const records: SalesRecord[] = parsed.map((item: any, idx: number) => ({
      id: `sale_nl_${Date.now()}_${idx}`,
      restaurant_id: restaurantId,
      order_id: `ord_nl_${Date.now()}_${idx}`,
      item_name: item.item_name,
      quantity_sold: Number(item.quantity_sold),
      unit_price: Number(item.unit_price),
      total_amount: Number(item.quantity_sold) * Number(item.unit_price),
      sold_at: item.sold_at || new Date().toISOString(),
    }));

    return {
      records,
      parsedItems: records.length,
      confidence: 'medium',
      warnings: []
    };
  } catch (err: any) {
    return {
      records: [],
      parsedItems: 0,
      confidence: 'low',
      warnings: ['AI Parsing failed: ' + err.message]
    };
  }
}

export function processQuickTally(
  tally: Record<string, number>, 
  prices: Record<string, number>,
  restaurantId: string = 'rest_001'
): IngestionResult {
  const records: SalesRecord[] = [];
  let count = 0;

  for (const [itemName, qty] of Object.entries(tally)) {
    if (qty <= 0) continue;
    const price = prices[itemName] || 0;
    records.push({
      id: `sale_tally_${Date.now()}_${count}`,
      restaurant_id: restaurantId,
      order_id: `ord_tally_${Date.now()}_${count}`,
      item_name: itemName,
      quantity_sold: qty,
      unit_price: price,
      total_amount: qty * price,
      sold_at: new Date().toISOString(),
    });
    count++;
  }

  return {
    records,
    parsedItems: count,
    confidence: 'high',
    warnings: []
  };
}
