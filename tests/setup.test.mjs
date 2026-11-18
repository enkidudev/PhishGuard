import test from 'node:test';
import assert from 'node:assert/strict';
import {updateEnv,defaults} from '../scripts/env-config.mjs';
test('setup preserves chosen origin and secrets, removes duplicates and is idempotent',()=>{
 const before='DATABASE_URL="file:existing.db"\nAPP_ORIGIN="https://training.example"\nSESSION_SECRET="keep-me"\nADMIN_PASSWORD_HASH="keep-hash"\nAPP_ORIGIN="http://localhost:3000"\n';
 const after=updateEnv(before,defaults);
 assert.match(after,/https:\/\/training.example/);assert.doesNotMatch(after,/localhost/);
 assert.match(after,/file:existing.db/);assert.match(after,/keep-me/);assert.match(after,/keep-hash/);
 assert.equal(updateEnv(after,defaults),after);
 const repaired=updateEnv(after,defaults,{APP_ORIGIN:defaults.APP_ORIGIN});
 assert.match(repaired,/127.0.0.1:3000/);assert.match(repaired,/keep-hash/);
});
