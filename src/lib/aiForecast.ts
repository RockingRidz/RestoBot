import type { MenuItem, SalesRecord } from '../types';
import type { MenuDemandPrediction } from './forecastEngine';

// Model output is untrusted. Require exactly one usable prediction per active item.
export function validateAiDemand(text: string, menus: MenuItem[], sales: SalesRecord[]): MenuDemandPrediction[] {
  const body = JSON.parse(text);
  const active = menus.filter(m => m.is_active !== false);
  if (!Array.isArray(body.predictions) || body.predictions.length !== active.length) throw new Error('AI returned incomplete menu predictions');
  const seen = new Set<string>();
  return body.predictions.map((p: any) => {
    const menu = active.find(m => m.id === p.menuItemId);
    if (!menu || seen.has(p.menuItemId) || typeof p.projectedUnits !== 'number' || !Number.isFinite(p.projectedUnits) || p.projectedUnits < 0 || p.projectedUnits > 1000000 || typeof p.explanation !== 'string' || !p.explanation.trim()) throw new Error('AI returned invalid menu predictions');
    seen.add(p.menuItemId);
    return { menuItemId: menu.id, menuItemName: menu.name, projectedUnits: Math.round(p.projectedUnits * 10) / 10, confidence: 'low', recordsUsed: sales.filter(s => s.item_name.toLowerCase() === menu.name.toLowerCase()).length, explanation: p.explanation.slice(0, 2000) };
  });
}
