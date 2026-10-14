import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let warnedMissing = false;
let authClient: SupabaseClient | null = null;

export async function verifyAccessToken(token: string): Promise<{ id: string } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !token) return null;
  if (!authClient) {
    authClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const { data, error } = await authClient.auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id };
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function persistenceMode(): 'supabase' | 'memory' {
  return process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL ? 'supabase' : 'memory';
}

export function getAdminClient(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    if (!warnedMissing) {
      console.warn('[supabase] Missing server-only SUPABASE_SERVICE_ROLE_KEY — using memory store');
      warnedMissing = true;
    }
    return null;
  }
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export async function checkAdminConnection(): Promise<{ connected: boolean; message: string; mode: string }> {
  const mode = persistenceMode();
  const client = getAdminClient();
  if (!client) {
    return { connected: false, message: 'Supabase not configured', mode };
  }
  try {
    const { error } = await client.from('restaurants').select('id', { count: 'exact', head: true });
    if (error) return { connected: false, message: error.message, mode };
    return { connected: true, message: `Connected (${process.env.SUPABASE_URL})`, mode };
  } catch (err: any) {
    return { connected: false, message: err?.message || 'Connection failed', mode };
  }
}

export async function checkOperationalSchema(client = getAdminClient()):Promise<{ready:boolean;missing:string[]}>{
  if(!client)return {ready:false,missing:['Supabase configuration']};
  const tables=[['restaurants','id,closed_dates'],['ingredients','id,procurement'],['recipe_ingredients','id,quantity_basis,yield_percent,culinary_role,substitutes'],['forecasts','id,forecast_explanation'],['order_notes','id,lines,channel,status']];
  const results=await Promise.all(tables.map(async([table,columns])=>{
    try{const {error}=await client.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(10000));return error?table:null;}catch{return table;}
  }));
  const missing=results.filter((name):name is string=>!!name);
  return {ready:missing.length===0,missing};
}
