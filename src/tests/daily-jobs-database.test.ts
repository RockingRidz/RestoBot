import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
let db: PGlite;
const tenant='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
  db=await PGlite.create({extensions:{pgcrypto}});
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const name of ['001_restobot_production.sql','007_daily_forecast_jobs.sql','007_daily_forecast_jobs.sql']) {
    await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
  }
  await db.query('INSERT INTO restaurants(id,name) VALUES ($1,$2),($3,$4)',[tenant,'Scheduler test',other,'Other tenant']);
},30000);
afterAll(async()=>{await db?.close();});
async function claim(date:string,restaurant=tenant) {
  return (await db.query<any>('SELECT restobot_claim_daily_forecast($1,$2) AS run',[restaurant,date])).rows[0].run;
}
async function complete(run:any,forecast:any,restaurant=tenant,skip:string|null=null) {
  return (await db.query<any>('SELECT restobot_complete_daily_forecast($1,$2,$3,$4::jsonb,$5) AS id',[restaurant,run.id,run.lease_token,forecast===null?null:JSON.stringify(forecast),skip])).rows[0].id;
}
function forecast(restaurant=tenant) {
  return {restaurant_id:restaurant,target_date:'2026-10-02',generated_at:new Date().toISOString(),forecast_summary:'Fixture',forecast_explanation:{inputFingerprint:'fixture',result:{source:'ai',lines:[]}}};
}
describe('Durable daily job transactions',()=>{
  it('allows one concurrent claim and atomically commits a forecast once on response retries',async()=>{
    const claims=await Promise.all([claim('2026-10-01'),claim('2026-10-01')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const run=claims.find(Boolean);
    const id=await complete(run,forecast());
    expect(await complete(run,forecast())).toBe(id);
    expect(await claim('2026-10-01')).toBeNull();
    expect((await db.query('SELECT id FROM forecasts')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM order_notes')).rows).toHaveLength(0);
  });
  it('rolls back a bad snapshot and denies another tenant and stale worker',async()=>{
    const run=await claim('2026-10-02');
    await expect(complete(run,forecast(other))).rejects.toThrow(/Invalid forecast/);
    await expect(complete(run,forecast(),other)).rejects.toThrow(/Invalid job lease/);
    await db.query("UPDATE daily_forecast_runs SET lease_until=now()-interval '1 second' WHERE id=$1",[run.id]);
    await expect(complete(run,forecast())).rejects.toThrow(/Expired job lease/);
    const replacement=await claim('2026-10-02');
    expect(replacement.attempts).toBe(2);
    expect(replacement.lease_token).not.toBe(run.lease_token);
    await expect(complete(run,forecast())).rejects.toThrow(/Invalid job lease/);
    await complete(replacement,null,tenant,'closed_target_date');
    expect(await claim('2026-10-02')).toBeNull();
  });
  it('waits before retrying and stops after three attempts',async()=>{
    let run=await claim('2026-10-03');
    for(let attempt=1;attempt<=3;attempt++) {
      expect(run.attempts).toBe(attempt);
      await db.query('SELECT restobot_fail_daily_forecast($1,$2,$3,$4,true)',[tenant,run.id,run.lease_token,'provider_unavailable']);
      expect(await claim('2026-10-03')).toBeNull();
      await db.query("UPDATE daily_forecast_runs SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[run.id]);
      run=await claim('2026-10-03');
    }
    expect(run).toBeNull();
    expect((await db.query<any>("SELECT status FROM daily_forecast_runs WHERE local_date='2026-10-03'")).rows[0].status).toBe('failed');
  });
  it('does not loop on quota failures and isolates the same date for another restaurant',async()=>{
    const run=await claim('2026-10-04');
    await db.query('SELECT restobot_fail_daily_forecast($1,$2,$3,$4,false)',[tenant,run.id,run.lease_token,'provider_quota']);
    expect(await claim('2026-10-04')).toBeNull();
    expect((await claim('2026-10-04',other)).restaurant_id).toBe(other);
  });
  it('denies direct authenticated/anonymous reads and scheduler RPCs',async()=>{
    for(const role of ['authenticated','anon']) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await expect(db.query('SELECT * FROM daily_forecast_runs')).rejects.toThrow(/permission denied/);
        await expect(claim('2026-10-05')).rejects.toThrow(/permission denied/);
      } finally { await db.exec('RESET ROLE'); }
    }
    await db.exec('SET ROLE service_role');
    try { expect(await claim('2026-10-05')).toBeTruthy(); }
    finally { await db.exec('RESET ROLE'); }
  });
  it('retains completed identities and crashed leases through an isolated backup restore',async()=>{
    const run=await claim('2026-10-06');
    const backup=await db.dumpDataDir();
    const restored=await PGlite.create({extensions:{pgcrypto},loadDataDir:backup});
    try {
      expect((await restored.query<any>("SELECT restobot_claim_daily_forecast($1,'2026-10-01') AS run",[tenant])).rows[0].run).toBeNull();
      await restored.query("UPDATE daily_forecast_runs SET lease_until=now()-interval '1 second' WHERE id=$1",[run.id]);
      const recovered=(await restored.query<any>("SELECT restobot_claim_daily_forecast($1,'2026-10-06') AS run",[tenant])).rows[0].run;
      expect(recovered.attempts).toBe(2);expect(recovered.lease_token).not.toBe(run.lease_token);
    } finally { await restored.close(); }
  },30000);
});
