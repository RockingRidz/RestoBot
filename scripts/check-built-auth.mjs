// Opt-in release check. Compare locally without printing any configured values.
import dotenv from 'dotenv';
import {readFileSync, readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
dotenv.config({path:'.env.local',quiet:true});
const publicKeys=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'];
const javascript=readdirSync('dist/assets').filter(name=>name.endsWith('.js')).map(name=>readFileSync('dist/assets/'+name,'utf8')).join('\n');
for(const name of publicKeys){
  assert.ok(process.env[name]?.trim(),`${name} must be configured before building`);
  assert.ok(javascript.includes(process.env[name]),`${name} was not embedded in the browser build`);
}
for(const name of ['SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY']){
  if(process.env[name]) assert.ok(!javascript.includes(process.env[name]),`Server-only credential found in browser build: ${name}`);
}
console.log('PASS: browser build has public login configuration and contains no configured server-only credentials.');
