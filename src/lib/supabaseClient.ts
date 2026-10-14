import { createClient, SupabaseClient } from '@supabase/supabase-js';

const invitationMarker = 'restobot_invite_password_pending';

// Capture the invitation marker before Supabase consumes the URL fragment.
// The token itself is handled by supabase-js and is never stored here.
export const invitePasswordPending = (() => {
  if (typeof window === 'undefined') return false;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  if (['invite','recovery'].includes(fragment.get('type') || '') || ['invite','recovery'].includes(query.get('type') || '')) {
    sessionStorage.setItem(invitationMarker, '1');
  }
  return sessionStorage.getItem(invitationMarker) === '1';
})();

export function clearInvitePasswordPending(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(invitationMarker);
}

// Vite replaces direct import.meta.env references. Optional chaining on
// import.meta itself left the browser talking to the placeholder host.
const browserEnv = import.meta.env;
const serverEnv = typeof process !== 'undefined' ? process.env : {};
const supabaseUrl = browserEnv?.VITE_SUPABASE_URL || serverEnv.VITE_SUPABASE_URL || serverEnv.SUPABASE_URL || '';
const supabaseAnonKey = browserEnv?.VITE_SUPABASE_ANON_KEY || serverEnv.VITE_SUPABASE_ANON_KEY || serverEnv.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://missing-supabase-url.invalid',
  supabaseAnonKey || 'missing-anon-key',
);

export async function checkSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      connected: false,
      message: 'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const { error } = await supabase.from('restaurants').select('count', { count: 'exact', head: true });
    if (error) {
      return { connected: false, message: `Supabase notice: ${error.message}` };
    }
    return { connected: true, message: `Connected to Supabase (${supabaseUrl})` };
  } catch (err: any) {
    console.error('Supabase connection check failed:', err);
    return { connected: false, message: err?.message || 'Connection offline or restricted' };
  }
}
