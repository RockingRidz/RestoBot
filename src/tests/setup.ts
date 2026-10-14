// Never load local credentials or call paid services in the default test suite.
process.env.NODE_ENV = 'test';
for (const key of ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) delete process.env[key];
