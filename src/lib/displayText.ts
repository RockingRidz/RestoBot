// Presentation only: never change stored units, identifiers, or approval records.
export function unitLabel(unit: string): string {
  return ({ fl_oz: 'fl oz', pcs: 'pieces' } as Record<string, string>)[unit] || unit.replace(/_/g, ' ');
}

const technicalText = /```|[{}]|<\/?[a-z][^>]*>|(?:^|\n)\s*:\w+|\b(?:SELECT|INSERT|UPDATE|DELETE)\s+.+\b(?:FROM|INTO|SET)\b|\b(?:const|let|var|function)\s+\w+\s*[=(]|=>|\b(?:TypeError|SyntaxError|ReferenceError)\b|\bat\s+\S+\s*\([^\n]+:\d+|\b(?:GEMINI_API_KEY|SUPABASE_\w+|GEMINI_MODEL)\b/i;

export function ownerText(value: unknown, fallback = 'This information could not be displayed. Please try again.'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  // A structured/model-code response is a failed presentation, not a successful answer.
  if (technicalText.test(value) || /^\s*\[\s*(?:"|\{)/.test(value)) return fallback;
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\bfl_oz\b/g, 'fl oz')
    .replace(/\b(?:ing|menu|rest|forecast)_[\w-]+\b/g, 'the linked record')
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/g, text => text.replace(/_/g, ' '))
    .trim();
}

export function ownerError(error: unknown, status?: number): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/invalid login|invalid.*password|email.*not confirmed/i.test(message)) return 'Check your email and password, and confirm your email before signing in.';
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 403) return 'Your account does not have permission to make this change.';
  if (status === 429) return 'The service is busy. Please wait a moment and try again.';
  if (/schema|migration|column|relation|PGRST|SQLSTATE/i.test(message)) return 'The saved-data service needs an update. Please contact support before saving again.';
  if (/GEMINI_API_KEY|GEMINI_MODEL|Gemini.*credential|server configuration/i.test(message)) return 'The AI service needs attention. Please contact support and try again later.';
  if (/fetch|network|ECONN|ENOTFOUND/i.test(message)) return 'Unable to connect. Check your connection and try again.';
  return ownerText(message, 'The request could not be completed. Please try again or contact support.');
}
