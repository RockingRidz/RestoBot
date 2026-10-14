import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyClaim, DailyJobStore, ScheduledResult } from './dailyScheduler';

export function dailyJobStore(client: SupabaseClient, restaurantId: string): DailyJobStore {
  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, params).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error('Daily job database operation failed');
    return data;
  }
  const identity = (claim: DailyClaim) => ({ p_restaurant_id: restaurantId, p_run_id: claim.id, p_token: claim.lease_token });
  return {
    claim: (date: string) => rpc('restobot_claim_daily_forecast', { p_restaurant_id: restaurantId, p_local_date: date }),
    async complete(claim: DailyClaim, result: ScheduledResult) {
      await rpc('restobot_complete_daily_forecast', { ...identity(claim), p_forecast: 'forecast' in result ? result.forecast : null, p_skip: 'skip' in result ? result.skip : null });
    },
    async fail(claim: DailyClaim, code: string, retryable: boolean) {
      await rpc('restobot_fail_daily_forecast', { ...identity(claim), p_code: code, p_retryable: retryable });
    },
  };
}
