import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { prepareAiForecast } from '../lib/aiForecastService';
import { getMemorySnapshot } from '../lib/dataStore';
const now=new Date('2026-10-01T12:00:00Z');
let original:ReturnType<typeof getMemorySnapshot>;
beforeEach(()=>{
  const mem=getMemorySnapshot();original=structuredClone(mem);
  mem.profile.closedDates=[];
  mem.menuItems=[{id:'menu',name:'Dish',selling_price:10,is_active:true,recipes:[{ingredient_id:'ing',quantity_required:1,unit:'kg'}]} as any];
  mem.ingredients=[{id:'ing',name:'Ingredient',unit:'kg',current_stock:1,cost_per_unit:2} as any];
  mem.salesRecords=[{id:'sale',item_name:'Dish',quantity_sold:5,sold_at:'2026-09-30T12:00:00Z',transaction_type:'sale'} as any];
});
afterEach(()=>Object.assign(getMemorySnapshot(),original));
function provider(text=JSON.stringify({predictions:[{menuItemId:'menu',projectedUnits:5,explanation:'Fixture'}]})) {
  const generateContent=vi.fn(async()=>({text}));
  return {generateContent,ai:{models:{generateContent}} as unknown as GoogleGenAI};
}
describe('Shared manual and scheduled forecast generation',()=>{
  it('uses only validated output and returns an unsaved draft',async()=>{
    const p=provider(),orders=getMemorySnapshot().orderNotes.length;
    const result=await prepareAiForecast(p.ai,'fixture-model',now);
    expect(result.result.targetDate).toBe('2026-10-02');
    expect(result.result.totalProjectedMenuRevenue).toBe(50);
    expect(result.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(getMemorySnapshot().orderNotes).toHaveLength(orders);
  });
  it('skips a closed target without spending an AI request',async()=>{
    getMemorySnapshot().profile.closedDates=['2026-10-02'];
    const p=provider();
    await expect(prepareAiForecast(p.ai,'fixture',now)).rejects.toMatchObject({code:'closed_target_date'});
    expect(p.generateContent).not.toHaveBeenCalled();
  });
  it('rejects stale sales and malformed provider output',async()=>{
    const p=provider('not JSON');
    await expect(prepareAiForecast(p.ai,'fixture',now)).rejects.toThrow();
    p.generateContent.mockClear();getMemorySnapshot().salesRecords[0].sold_at='2025-01-01T12:00:00Z';
    await expect(prepareAiForecast(p.ai,'fixture',now)).rejects.toMatchObject({status:422});
    expect(p.generateContent).not.toHaveBeenCalled();
  });
  it('rejects a draft if inventory changes during provider generation',async()=>{
    const p=provider();p.generateContent.mockImplementation(async()=>{
      getMemorySnapshot().ingredients[0].current_stock=100;
      return {text:JSON.stringify({predictions:[{menuItemId:'menu',projectedUnits:5,explanation:'Fixture'}]})};
    });
    await expect(prepareAiForecast(p.ai,'fixture',now)).rejects.toMatchObject({status:409});
  });
});
