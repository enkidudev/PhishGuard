import test from 'node:test'
import assert from 'node:assert/strict'
import { safeTemplateHtml } from '../src/lib/template-safety'
import { signToken, verifyToken } from '../src/lib/session'
import { csvCell, participantAlias } from '../src/lib/privacy'
import { orderAssessment } from '../src/lib/assessment-order'
import { questionsFor } from '../src/lib/learning'
process.env.SESSION_SECRET = 'test-only-secret-not-for-deployment-123456789'
test('template sanitizer strips executable HTML and external resources', () => {
 const clean = safeTemplateHtml('<img src="https://tracker.invalid" onerror="alert(1)"><script>alert(2)</script><form action="https://evil.invalid"><input name="password"></form><a href="javascript:alert(3)">Continue</a><div style="background-image:url(https://tracker.invalid)">Hello</div>')
 assert.doesNotMatch(clean, /script|onerror|<img|<form|<input|https:|javascript:|url\(/i)
 assert.match(clean, /href="#"/)
})
test('signed sessions reject tampering, expiry and invitation replay as session', () => {
 const p={role:'admin' as const,sub:'admin',purpose:'session' as const,exp:Date.now()+10000}
 const token=signToken(p)
 assert.equal(verifyToken(token)?.role,'admin')
 assert.equal(verifyToken(token+'x'),null)
 assert.equal(verifyToken(signToken({...p,exp:0})),null)
 assert.equal(verifyToken(signToken({...p,purpose:'invite'})),null)
})
test('CSV neutralizes spreadsheet formulas and escapes delimiters',()=>{
 for(const value of ['=SUM(1,2)','+cmd','-cmd','@SUM(1)','  =1','\t=1']) assert.ok(csvCell(value).includes("'"))
 assert.equal(csvCell('a,"b"'), '"a,""b"""')
})
test('export aliases are keyed, stable and do not contain participant identity',()=>{
 const first=participantAlias('alice@example.test');assert.equal(first,participantAlias('alice@example.test'));assert.doesNotMatch(first,/alice|example/)
 process.env.SESSION_SECRET+='rotated';assert.notEqual(first,participantAlias('alice@example.test'))
})
test('baseline and follow-up use different scenarios with valid answer keys',()=>{
 for(const title of ['Spotting Phishing Red Flags','Urgency & Pressure Tactics','Safe Link Hygiene','Reporting: Your Superpower','Executive Impersonation & BEC']){
  const before=questionsFor(title,'baseline'),after=questionsFor(title,'followup');assert.equal(before.length,3);assert.notEqual(before[1].question,after[1].question)
  for(const q of [...before,...after])assert.ok(q.answer>=0&&q.answer<q.options.length)
 }
})

test('origin checks keep production strict and allow only same-host local development', async () => {
 const {validRequestOrigin: valid}=await import('../src/lib/request-origin');
 assert.equal(valid('http://127.0.0.1:3000','http://127.0.0.1:3000/api/auth/login','http://localhost:3000',true),true);
 assert.equal(valid('http://127.0.0.1:3000','http://127.0.0.1:3000/api/auth/login','http://localhost:3000',false),false);
 for(const origin of [null,'null','https://evil.test','http://localhost:3001','http://localhost:3000.evil.test','http://127.0.0.1:3000/path']) assert.equal(valid(origin,'http://127.0.0.1:3000/api/auth/login','http://127.0.0.1:3000',true),false);
 assert.equal(valid('https://training.example','http://internal:3000/api/auth/login','https://training.example/',false),true);
});

test('server-side quiz ordering varies positions and preserves the answer key', () => {
 const questions = questionsFor('Safe Link Hygiene', 'followup');
 const scope = 'participant|lesson|followup';
 const orders = Array.from({length:16}, (_,i) => orderAssessment(questions, scope, String(i)));
 assert.ok(new Set(orders.map(order => order[0].answer)).size > 1);
 for (const order of orders) order.forEach((q,i) => assert.equal(q.options[q.answer], questions[i].options[questions[i].answer]));
 assert.deepEqual(orders[0], orderAssessment(questions, scope, '0'));
});

test('the eleven core templates have distinct decisions and landing titles', async () => {
 const { trainingCatalog } = await import('../src/lib/training-catalog');
 const { catalogExercises } = await import('../src/lib/catalog-exercises');
 assert.equal(trainingCatalog.length, 11);
 const exercises = trainingCatalog.map(template => catalogExercises[template.id]);
 assert.equal(new Set(exercises.map(exercise => exercise.heading)).size, 11);
 assert.equal(new Set(exercises.map(exercise => exercise.action)).size, 11);
});
