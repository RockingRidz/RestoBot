import { beforeEach, describe, expect, it } from 'vitest';
import { aiRequestsAllowed, aiUsagePolicy, resetAiUsageForTests, withAiUsageLimit } from '../lib/aiUsage';

describe('AI usage policy', () => {
  beforeEach(() => resetAiUsageForTests());

  it('defaults to a hard zero-cost state', () => {
    const policy = aiUsagePolicy({} as NodeJS.ProcessEnv);
    expect(policy.enabled).toBe(false);
    expect(policy.dailyLimit).toBe(0);
    expect(aiRequestsAllowed({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('requires both explicit enablement and a positive daily cap', () => {
    expect(aiRequestsAllowed({ RESTOBOT_AI_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(aiRequestsAllowed({ RESTOBOT_AI_MAX_REQUESTS_PER_DAY: '10' } as NodeJS.ProcessEnv)).toBe(false);
    expect(aiRequestsAllowed({ RESTOBOT_AI_ENABLED: 'true', RESTOBOT_AI_MAX_REQUESTS_PER_DAY: '10' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('enforces per-minute and daily request caps before dispatch', async () => {
    const env = {
      RESTOBOT_AI_ENABLED: 'true',
      RESTOBOT_AI_MAX_REQUESTS_PER_DAY: '2',
      RESTOBOT_AI_MAX_REQUESTS_PER_MINUTE: '1',
      RESTOBOT_AI_MAX_CONCURRENT_REQUESTS: '1',
    } as NodeJS.ProcessEnv;
    let calls = 0;
    await withAiUsageLimit(async () => ++calls, env, new Date('2026-10-02T10:00:00Z'));
    await expect(withAiUsageLimit(async () => ++calls, env, new Date('2026-10-02T10:00:30Z'))).rejects.toMatchObject({ code: 'ai_minute_limit' });
    await withAiUsageLimit(async () => ++calls, env, new Date('2026-10-02T10:01:01Z'));
    await expect(withAiUsageLimit(async () => ++calls, env, new Date('2026-10-02T10:02:02Z'))).rejects.toMatchObject({ code: 'ai_daily_limit' });
    expect(calls).toBe(2);
  });
});
