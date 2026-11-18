export type ScenarioKind = 'password' | 'payroll' | 'invoice' | 'document' | 'parcel' | 'executive' | 'esign';
export interface LandingScenario {kind: ScenarioKind; brand: string; title: string; intro: string; action: string; accent: string; reference: string}
const scenarios: Record<ScenarioKind, LandingScenario> = {
 password: {kind:'password',brand:'Acme Workspace',title:'Keep access to your workspace',intro:'Your account password is due for renewal. Verify your account to continue using your workspace.',action:'Verify account',accent:'bg-blue-700',reference:'Account services'},
 payroll: {kind:'payroll',brand:'PeopleHub',title:'Verify your payroll profile',intro:'Your payroll profile needs verification before the next processing cycle.',action:'Verify payroll profile',accent:'bg-emerald-700',reference:'Payroll • Current cycle'},
 invoice: {kind:'invoice',brand:'BrightPath Billing',title:'Invoice awaiting approval',intro:'Review the balance and authorize this invoice for processing.',action:'Authorize invoice',accent:'bg-amber-700',reference:'Invoice #4471'},
 document: {kind:'document',brand:'Acme Document Room',title:'A confidential document was shared with you',intro:'This document is restricted to workspace members. Sign in to unlock the preview.',action:'Unlock document',accent:'bg-indigo-700',reference:'Q4 organization update.pdf'},
 parcel: {kind:'parcel',brand:'ExpressParcel',title:'Arrange another delivery',intro:'We could not complete your delivery. Choose a new delivery window to release the parcel.',action:'Confirm redelivery',accent:'bg-orange-700',reference:'Tracking EP-2047-8921'},
 executive: {kind:'executive',brand:'Acme Treasury',title:'Priority payment authorization',intro:'A confidential acquisition payment is awaiting your approval. Review the instructions before authorizing.',action:'Approve transfer',accent:'bg-slate-700',reference:'Payment request TR-2047'},
 esign: {kind:'esign',brand:'SignFlow',title:'Your document is ready to sign',intro:'Review the envelope details, then verify your identity to access the signature page.',action:'Continue to signing',accent:'bg-violet-700',reference:'Offer letter • Envelope SF-2047'},
};
export function scenarioFor(template: {subject:string; category:string; name?:string}): LandingScenario {
 const text=`${template.name ?? ''} ${template.subject} ${template.category}`.toLowerCase();
 const kind: ScenarioKind = /esign|e-sign|signature|signflow|offer letter/.test(text) ? 'esign' : /payroll|salary/.test(text) ? 'payroll' : /ceo|bec|acquisition|executive|wire transfer/.test(text) ? 'executive' : /invoice|billing/.test(text) ? 'invoice' : /parcel|package|delivery|shipping|consumer scam/.test(text) ? 'parcel' : /confidential|document|org changes|curiosity/.test(text) ? 'document' : 'password';
 return scenarios[kind];
}
