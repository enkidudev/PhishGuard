import { questionsFor } from '../../src/lib/learning'
import { test, expect, request as requestFactory } from '@playwright/test'
const base = 'http://localhost:3000'
const password = process.env.TEST_ADMIN_PASSWORD || ''
const headers = { Origin: base }

test('authorization, safe tracking, consent, learning and privacy boundaries', async ({ request }) => {
 expect((await request.get('/api/participants')).status()).toBe(401)
 expect((await request.post('/api/auth/login',{data:{password},headers:{Origin:'https://untrusted.invalid'}})).status()).toBe(403)
 expect((await request.post('/api/auth/login',{data:{password},headers})).ok()).toBeTruthy()
 const participants=(await (await request.get('/api/participants')).json()).participants
 const templates=(await (await request.get('/api/templates')).json()).templates
 const own=participants.find((p:any)=>p.active&&p.consented), other=participants.find((p:any)=>p.id!==own.id&&p.active&&p.consented)
 const denied=await request.post('/api/campaigns',{headers,data:{name:'Blocked audience',templateId:templates[0].id,participantIds:[participants.find((p:any)=>!p.consented).id]}})
 expect(denied.status()).toBe(400)
 const campaign=(await (await request.post('/api/campaigns',{headers,data:{name:'Verified test campaign',templateId:templates[0].id,participantIds:[own.id,other.id]}})).json()).campaign
 expect(campaign.id).toBeTruthy()
 expect((await request.patch(`/api/campaigns/${campaign.id}`,{headers,data:{action:'launch'}})).ok()).toBeTruthy()
 expect((await request.patch(`/api/campaigns/${campaign.id}`,{headers,data:{action:'launch'}})).status()).toBe(409)
 const invitation=(await (await request.post('/api/invitations',{headers,data:{participantId:own.id}})).json()).url
 const token=new URLSearchParams(new URL(invitation).hash.slice(1)).get('invite')
 const learner=await requestFactory.newContext({baseURL:base,extraHTTPHeaders:headers})
 expect((await learner.post('/api/auth/accept',{data:{token,consent:false}})).status()).toBe(400)
 expect((await learner.post('/api/auth/accept',{data:{token,consent:true}})).ok()).toBeTruthy()
 expect((await learner.post('/api/auth/accept',{data:{token,consent:true}})).status()).toBe(400)
 expect((await learner.get('/api/participants')).ok()).toBeTruthy()
 expect((await (await learner.get('/api/participants')).json()).participants).toHaveLength(1)
 for(const endpoint of ['/api/export?entity=participants','/api/compliance','/api/analytics/report','/api/live','/api/assurance']) expect((await learner.get(endpoint)).status()).toBe(403)
 expect((await learner.get(`/api/inbox?participantId=${other.id}`)).status()).toBe(403)
 const inbox=(await (await learner.get(`/api/inbox?participantId=${own.id}`)).json()).inbox
 const e=inbox.find((x:any)=>x.campaignId===campaign.id).enrollmentId
 const otherInbox=(await (await request.get(`/api/inbox?participantId=${other.id}`)).json()).inbox
 expect((await learner.post('/api/track',{data:{enrollmentId:otherInbox[0].enrollmentId,type:'CLICK'}})).status()).toBe(403)
 for(const extra of [{password:'CANARY_NEVER_STORE'},{note:'CANARY_NEVER_STORE'},{profile:{secret:'CANARY_NEVER_STORE'}}]) expect((await learner.post('/api/track',{data:{enrollmentId:e,type:'SUBMITTED',...extra}})).status()).toBe(400)
 const responses=await Promise.all(Array.from({length:5},()=>learner.post('/api/track',{data:{enrollmentId:e,type:'SUBMITTED'}})))
 expect(responses.some(r=>r.ok())).toBeTruthy()
 expect((await (await learner.post('/api/track',{data:{enrollmentId:e,type:'SUBMITTED'}})).json()).already).toBe(true)
 const lateReport = await learner.post('/api/track', { data: { enrollmentId: e, type: 'REPORT' } })
 expect(lateReport.status()).toBe(409)
 expect((await lateReport.json()).error).toContain('recorded outcome')
 const live=(await (await request.get('/api/live')).json()).events
 expect(live.filter((x:any)=>x.campaign==='Verified test campaign'&&x.type==='SUBMITTED')).toHaveLength(1)
 expect((await learner.post('/api/training/complete',{data:{participantId:own.id,moduleId:'any'}})).status()).toBe(409)
 const training=await (await learner.get('/api/training')).json()
 const lesson=training.modules.find((m:any)=>m.title==='Safe Link Hygiene')
 expect((await learner.post('/api/training/assessment',{data:{participantId:other.id,moduleId:lesson.id,phase:'baseline'}})).status()).toBe(403)
 expect((await learner.post('/api/training/assessment',{data:{participantId:own.id,moduleId:lesson.id,phase:'followup',answers:[0,0]}})).status()).toBe(409)
 const assess = async (phase: 'baseline' | 'followup') => {
  const data = { participantId: own.id, moduleId: lesson.id, phase };
  const quiz = await (await learner.post('/api/training/assessment', { data })).json();
  expect(quiz.questions.every((q: { answer?: number }) => q.answer === undefined)).toBe(true);
  const expected = questionsFor(lesson.title, phase);
  const answers = quiz.questions.map((q: { options: string[] }, i: number) =>
   q.options.indexOf(expected[i].options[expected[i].answer]));
  return await learner.post('/api/training/assessment', { data: { ...data, quizId: quiz.quizId, answers } });
 };
 expect((await assess('baseline')).ok()).toBeTruthy()
 const after=await (await assess('followup')).json()
 expect(after.passed).toBe(true)
 expect((await (await learner.get('/api/training')).json()).completions.some((c:any)=>c.moduleId===lesson.id)).toBeTruthy()
 const report=(await (await request.get('/api/analytics/report')).json()).report
 expect(report.repeatClickers).toHaveLength(0)
 expect(report.departments.every((d:any)=>d.participants>=3)).toBeTruthy()
 const exported=await (await request.get('/api/export?entity=participants')).text()
 expect(exported).not.toContain(own.email);expect(exported).not.toContain(own.name);expect(exported).toContain('Learner-')
 expect((await learner.post('/api/consent',{data:{}})).ok()).toBeTruthy()
 expect((await learner.get('/api/training')).status()).toBe(401)
 expect((await request.post('/api/track',{headers,data:{enrollmentId:e,type:'REPORT'}})).status()).toBe(409)
 expect((await request.post('/api/assurance',{headers,data:{}})).ok()).toBeTruthy()
 expect((await request.post('/api/track',{headers,data:{enrollmentId:otherInbox[0].enrollmentId,type:'REPORT'}})).status()).toBe(409)
 await learner.dispose()
})

test('desktop and mobile UI, isolated preview and browser-only exercise inputs',async({page,request})=>{
 await request.post('/api/auth/login',{headers,data:{password}})
 const people=(await (await request.get('/api/participants')).json()).participants
 const person=people.find((p:any)=>p.active&&p.consented)
 const templates=(await (await request.get('/api/templates')).json()).templates
 const passwordTemplate=templates.find((t:any)=>t.subject.includes('password expires'));
 const c=(await (await request.post('/api/campaigns',{headers,data:{name:'Browser exercise',templateId:passwordTemplate.id,participantIds:[person.id]}})).json()).campaign
 await request.patch(`/api/campaigns/${c.id}`,{headers,data:{action:'launch'}})
 await page.goto('/')
 await page.getByLabel('Administrator passphrase').fill(password)
 await page.getByRole('button',{name:'Open workspace'}).click()
 await expect(page.getByText('A safer mistake.')).toBeVisible()
 await page.screenshot({path:'test-results/desktop-overview.png',fullPage:true})
 await page.getByRole('button',{name:'Test Inbox',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Practice inbox',exact:true})).toBeVisible()
 // Make the selected demo actor deterministic through the UI select.
 const actorSelect=page.getByRole('combobox').first()
 if(await actorSelect.count()) {await actorSelect.click();await page.getByRole('option',{name:new RegExp(person.name)}).click()}
 const email=page.getByText(passwordTemplate.subject,{exact:true}).first()
 await email.click()
 const frame=page.locator('iframe').first()
 await expect(frame).toHaveAttribute('sandbox','allow-same-origin')
 const messageLink=page.frameLocator('iframe').getByRole('link').first()
 await messageLink.click()
 const landing=page.getByTestId('landing-password')
 await expect(landing).toBeVisible()
 const tracking: unknown[]=[]
 page.on('request',r=>{if(r.url().endsWith('/api/track'))tracking.push(r.postDataJSON())})
 await landing.getByLabel('Practice identity').selectOption('Demo learner')
 await page.mouse.click(1,1)
 await expect(landing).toBeVisible()
 await landing.getByRole('button',{name:'Return to inbox'}).click()
 await expect(landing).toHaveCount(0)
 expect(tracking).toHaveLength(0)
 await page.getByRole('button',{name:'Open link',exact:true}).click()
 await expect(landing.getByLabel('Practice identity')).toHaveValue('')
 await landing.getByLabel('Practice identity').selectOption('Demo learner')
 await landing.getByRole('button',{name:'Verify account'}).click()
 expect(tracking).toContainEqual({enrollmentId:expect.any(String),type:'SUBMITTED'})
 expect(JSON.stringify(tracking)).not.toContain('Demo learner')
 await expect(page.getByText('This was a phishing assessment',{exact:true})).toBeVisible()
 await expect(page.getByRole('radiogroup')).toBeVisible()
 await page.getByRole('button',{name:'Back to inbox'}).click()
 await expect(page.getByRole('button',{name:'Outcome recorded',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Training',exact:true}).click()
 await expect(page.getByText('Learn. Practice. Prove it.')).toBeVisible()
 await page.screenshot({path:'test-results/desktop-learning.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'Overview',exact:true}).click()
 await expect(page.getByText('A safer mistake.')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy()
 await page.screenshot({path:'test-results/mobile-overview.png',fullPage:true})
})

test('recipient-domain approval, template isolation and privacy-safe content',async({request})=>{
 await request.post('/api/auth/login',{headers,data:{password}})
 const p=(await (await request.post('/api/participants',{headers,data:{name:'Boundary Learner',email:'learner@unapproved.test',department:'Test',consented:true}})).json()).participant
 expect(p.consented).toBe(false)
 expect((await request.patch(`/api/participants/${p.id}`,{headers,data:{consented:true}})).status()).toBe(400)
 const invite=(await (await request.post('/api/invitations',{headers,data:{participantId:p.id}})).json()).url
 const learner=await requestFactory.newContext({baseURL:base,extraHTTPHeaders:headers})
 await learner.post('/api/auth/accept',{data:{token:new URLSearchParams(new URL(invite).hash.slice(1)).get('invite'),consent:true}})
 const template=(await (await request.get('/api/templates')).json()).templates[0]
 expect((await request.post('/api/campaigns',{headers,data:{name:'Domain gate',templateId:template.id,participantIds:[p.id]}})).status()).toBe(400)
 const created=await request.post('/api/templates',{headers,data:{name:'Sanitizer verification',category:'Test',difficulty:'easy',subject:'Test',senderName:'Lab',senderEmail:template.senderEmail,bodyHtml:'<img src="https://outside.invalid" onerror="alert(1)"><form><input name="password"></form><a href="https://outside.invalid">Continue</a>',landingMessage:'Verify independently',redFlags:['Unexpected request']}})
 expect(created.ok()).toBeTruthy()
 const html=(await created.json()).template.bodyHtml
 expect(html).not.toMatch(/onerror|<img|<form|<input|outside.invalid/)
 expect(html).toContain('href="#"')
 await learner.dispose()
})

test('retention removes expired interaction timestamps and events together',async({request})=>{
 await request.post('/api/auth/login',{headers,data:{password}})
 const before=(await (await request.get('/api/campaigns')).json()).campaigns
 const old=before.find((c:any)=>c.launchedAt && Date.now()-new Date(c.launchedAt).getTime()>7*86400000)
 expect(old).toBeTruthy()
 expect((await request.patch('/api/compliance/retention',{headers,data:{defaultRetentionDays:7,autoPurge:true}})).ok()).toBeTruthy()
 const purge=await request.post('/api/compliance/purge',{headers,data:{}})
 expect(purge.ok()).toBeTruthy()
 const detail=(await (await request.get(`/api/campaigns/${old.id}`)).json()).campaign
 expect(detail.participantCount).toBe(0);expect(detail.delivered).toBe(0);expect(detail.clicks).toBe(0)
 const stats=await (await request.get('/api/stats')).json()
 const report=(await (await request.get('/api/analytics/report')).json()).report
 expect(stats.totals.clicks).toBe(report.overall.clicks)
 expect(stats.totals.delivered).toBe(report.overall.delivered)
})

test('Studio installs unique presets and screens suspicious messages locally', async ({ request }) => {
 expect((await request.post('/api/auth/login', { headers, data: { password } })).ok()).toBeTruthy()
 const { templates } = await (await request.get('/api/templates')).json()
 expect(templates.filter((template: {id:string}) => template.id.startsWith('training-catalog-'))).toHaveLength(11)
 const attachment = await request.get('/training/demo.txt')
 expect(attachment.ok()).toBeTruthy()
 expect(attachment.headers()['content-type']).toContain('text/plain')
 expect(await attachment.text()).toContain('no payroll records')

 const subjects = new Set()
 for (const scenario of ['Lottery notice', 'Summer vacation tickets', 'Coworker impersonation']) {
  const response = await request.post('/api/ai/template', { headers, data: { scenario, difficulty: 'medium' } })
  expect(response.ok()).toBeTruthy()
  const { template } = await response.json()
  expect(template.aiGenerated).toBe(false)
  subjects.add(template.subject)
 }
 expect(subjects.size).toBe(3)
 const response = await request.post('/api/ai/analyze', { headers, data: {
  content: 'From: Team <team@example.test>\nReply-To: team@other.test\nYou won a lottery prize. Pay the processing fee to claim it.'
 } })
 expect(response.ok()).toBeTruthy()
 const { analysis, source } = await response.json()
 expect(source).toBe('fallback')
 expect(analysis.flags.map((flag:{title:string})=>flag.title)).toContain('Reply address domain differs')
 expect(analysis.riskScore).toBeGreaterThan(50)
})

test('administrator password rotation invalidates old sessions and credentials', async ({ request }) => {
 const previousSession = await requestFactory.newContext({ baseURL: base });
 const replacement = 'unique-test-passphrase-rotation';
 try {
  expect((await request.post('/api/auth/login', { headers, data: { password } })).ok()).toBeTruthy();
  expect((await previousSession.post('/api/auth/login', { headers, data: { password } })).ok()).toBeTruthy();
  expect((await request.post('/api/auth/password', { headers, data: { current: 'wrong', replacement } })).status()).toBe(401);
  expect((await request.post('/api/auth/password', { headers, data: { current: password, replacement } })).ok()).toBeTruthy();
  expect((await previousSession.get('/api/templates')).status()).toBe(401);
  expect((await request.get('/api/templates')).ok()).toBeTruthy();
  expect((await previousSession.post('/api/auth/login', { headers, data: { password } })).status()).toBe(401);
  expect((await previousSession.post('/api/auth/login', { headers, data: { password: replacement } })).ok()).toBeTruthy();
 } finally {
  await previousSession.dispose();
 }
});
