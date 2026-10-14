// One pinned default for advisor and grounded event lookup; deployments may override it.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}
