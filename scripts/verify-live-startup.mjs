// Read-only opt-in live startup probe. Does not start the scheduler or call Gemini.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['dist/server.mjs'],{
  cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',PORT:'0',HOST:'127.0.0.1',RESTOBOT_TEST_BUILD:'false',RESTOBOT_SCHEDULER_ENABLED:'false'},
  windowsHide:true,stdio:['ignore','pipe','pipe'],
});
let output='';
const closed=new Promise(resolve=>child.once('close',resolve));
try {
  const url=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Live startup timed out')),45000);
    const fail=()=>{clearTimeout(timer);reject(new Error('Live startup failed'));};
    child.once('error',fail);child.once('exit',fail);
    child.stderr.on('data',()=>{}); // Never echo raw provider/database diagnostics.
    child.stdout.on('data',chunk=>{
      output=(output+chunk.toString()).slice(-4000);
      const match=output.match(/RestoBot server listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if(match){clearTimeout(timer);resolve(match[1]);}
    });
  });
  assert.equal((await fetch(url+'/healthz',{signal:AbortSignal.timeout(5000)})).status,200);
  for(const route of ['/api/ingredients','/api/operations/daily-forecast']) {
    assert.equal((await fetch(url+route,{signal:AbortSignal.timeout(5000)})).status,401);
  }
  const html=await fetch(url,{signal:AbortSignal.timeout(5000)});
  assert.equal(html.status,200);assert.match(await html.text(),/<div id="root"><\/div>/);
  console.log('PASS: compiled production startup loaded the configured live database; liveness/HTML work and anonymous data/operations access is denied. Scheduler disabled; no AI generation or data writes.');
} catch {
  console.error('FAIL: live startup or endpoint checks failed; inspect configuration and dependency availability.');process.exitCode=1;
} finally {
  child.kill();await closed;
}
