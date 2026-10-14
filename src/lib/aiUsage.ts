type UsageState = {
  day: string;
  dailyCount: number;
  minuteStartedAt: number;
  minuteCount: number;
  inFlight: number;
};

const state: UsageState = {
  day: '',
  dailyCount: 0,
  minuteStartedAt: 0,
  minuteCount: 0,
  inFlight: 0,
};

function nonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export type AiUsagePolicy = {
  enabled: boolean;
  dailyLimit: number;
  perMinuteLimit: number;
  concurrentLimit: number;
};

export function aiUsagePolicy(env: NodeJS.ProcessEnv = process.env): AiUsagePolicy {
  return {
    enabled: env.RESTOBOT_AI_ENABLED === 'true',
    // Zero is deliberately the default: no provider request can be billed accidentally.
    dailyLimit: nonNegativeInteger(env.RESTOBOT_AI_MAX_REQUESTS_PER_DAY, 0),
    perMinuteLimit: nonNegativeInteger(env.RESTOBOT_AI_MAX_REQUESTS_PER_MINUTE, 2),
    concurrentLimit: nonNegativeInteger(env.RESTOBOT_AI_MAX_CONCURRENT_REQUESTS, 1),
  };
}

export function aiRequestsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const policy = aiUsagePolicy(env);
  return policy.enabled && policy.dailyLimit > 0 && policy.perMinuteLimit > 0 && policy.concurrentLimit > 0;
}

export function aiAvailability(env: NodeJS.ProcessEnv = process.env) {
  const policy = aiUsagePolicy(env);
  if (!env.GEMINI_API_KEY?.trim()) return { available:false as const, reason:'missing_credential' as const };
  if (!policy.enabled) return { available:false as const, reason:'disabled' as const };
  if (policy.dailyLimit === 0) return { available:false as const, reason:'zero_daily_limit' as const };
  if (policy.perMinuteLimit === 0) return { available:false as const, reason:'zero_minute_limit' as const };
  if (policy.concurrentLimit === 0) return { available:false as const, reason:'zero_concurrent_limit' as const };
  return { available:true as const, reason:null };
}

export function aiUnavailableMessage(env: NodeJS.ProcessEnv = process.env): string {
  const status = aiAvailability(env);
  if (status.reason === 'missing_credential') return 'AI assistant unavailable: the server credential is missing.';
  if (status.reason === 'disabled') return 'AI assistant unavailable: AI requests are disabled by server policy.';
  return 'AI assistant unavailable: the server usage limit must be greater than zero.';
}

function refreshWindows(now: Date) {
  const day = now.toISOString().slice(0, 10);
  if (state.day !== day) {
    state.day = day;
    state.dailyCount = 0;
  }
  if (!state.minuteStartedAt || now.getTime() - state.minuteStartedAt >= 60_000) {
    state.minuteStartedAt = now.getTime();
    state.minuteCount = 0;
  }
}

export async function withAiUsageLimit<T>(request: () => Promise<T>, env: NodeJS.ProcessEnv = process.env, now = new Date()): Promise<T> {
  const policy = aiUsagePolicy(env);
  refreshWindows(now);
  if (!policy.enabled || policy.dailyLimit === 0) throw Object.assign(new Error('AI requests are disabled by the zero-cost policy.'), { status: 429, code: 'ai_disabled' });
  if (state.dailyCount >= policy.dailyLimit) throw Object.assign(new Error('The daily AI request limit has been reached.'), { status: 429, code: 'ai_daily_limit' });
  if (state.minuteCount >= policy.perMinuteLimit) throw Object.assign(new Error('The AI request rate limit has been reached.'), { status: 429, code: 'ai_minute_limit' });
  if (state.inFlight >= policy.concurrentLimit) throw Object.assign(new Error('An AI request is already in progress.'), { status: 429, code: 'ai_concurrency_limit' });

  // Reserve before dispatch so overlapping calls cannot pass the same limit.
  state.dailyCount += 1;
  state.minuteCount += 1;
  state.inFlight += 1;
  try {
    return await request();
  } finally {
    state.inFlight -= 1;
  }
}

export function aiUsageSnapshot(env: NodeJS.ProcessEnv = process.env) {
  refreshWindows(new Date());
  const policy = aiUsagePolicy(env);
  return {
    enabled: aiRequestsAllowed(env),
    zeroCostDefault: !policy.enabled || policy.dailyLimit === 0,
    usedToday: state.dailyCount,
    remainingToday: Math.max(0, policy.dailyLimit - state.dailyCount),
    dailyLimit: policy.dailyLimit,
    perMinuteLimit: policy.perMinuteLimit,
    concurrentLimit: policy.concurrentLimit,
  };
}

export function resetAiUsageForTests() {
  state.day = '';
  state.dailyCount = 0;
  state.minuteStartedAt = 0;
  state.minuteCount = 0;
  state.inFlight = 0;
}
