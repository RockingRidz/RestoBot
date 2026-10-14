import { supabase } from './supabaseClient';
import { ownerError } from './displayText';

export async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  try { return await fetch(path, { ...options, headers }); }
  catch { throw new Error('Unable to connect. Check your connection and try again.'); }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(ownerError(body?.error, response.status));
  if (body === null) throw new Error('The service could not complete this request. Please try again.');
  return body;
}
