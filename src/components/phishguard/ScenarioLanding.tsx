"use client";

import { useState } from 'react';
import { FileText, Package, ShieldCheck, ArrowRight, LockKeyhole, Receipt, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { findCatalogExercise } from "@/lib/training-catalog";
import { catalogExercises } from '@/lib/catalog-exercises';
import { scenarioFor } from '@/lib/landing-scenarios';
import type { InboxItem } from './api';

/** Practice scenarios accept fixed fictional choices and record only the decision. */
export function ScenarioLanding({item,busy,onSubmit,onReport,onExit}: {
 item: InboxItem; busy:boolean; onSubmit:()=>Promise<boolean>; onReport:()=>Promise<void>; onExit:()=>void;
}) {
 const [recoveryError, setRecoveryError] = useState(false);
 const scenario=scenarioFor(item.template);
 const finance=scenario.kind==='invoice'||scenario.kind==='executive';
 const document=scenario.kind==='document'||scenario.kind==='esign';
 const Icon=scenario.kind==='parcel'?Package:finance?Building2:document?FileText:ShieldCheck;
 const field='mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';
 const exercise = findCatalogExercise(item.template.subject, item.template.id);
 const decision = exercise && catalogExercises[exercise.id];
 if (exercise && decision) {
   return <section className="min-h-0 flex-1 overflow-y-auto bg-card p-6 sm:p-10" data-testid={`landing-${exercise.id}`}>
     <p className="text-sm text-muted-foreground">Internal awareness exercise</p>
     <h2 className="mt-2 text-2xl font-semibold">{decision.heading}</h2>
     <p className="mt-4 max-w-prose">{exercise.overview}</p>
     <div className="my-5 grid gap-2 sm:grid-cols-2">
       {decision.details.map(detail => <div key={detail} className="rounded-lg border p-3 text-sm">{detail}</div>)}
     </div>
     <form onSubmit={async event => {
       event.preventDefault();
       const form = event.currentTarget;
       if (decision.kind === 'recovery') {
         const value = form.querySelector<HTMLInputElement>('[data-practice-answer]')?.value.trim();
         if (value !== decision.fictionalAnswer) {
           setRecoveryError(true);
           return;
         }
       }
       form.reset();
       setRecoveryError(false);
       if (await onSubmit() && decision.kind === 'download') {
         const link = window.document.createElement('a');
         link.href = '/training/demo.txt';
         link.download = decision.filename;
         window.document.body.appendChild(link);
         link.click();
         link.remove();
       }
     }}>
       <fieldset disabled={busy} className="space-y-3">
         {decision.kind === 'choice' && <label className="block max-w-sm text-sm">{decision.label}
           <select className="mt-2 block w-full rounded-md border bg-background p-2" required defaultValue="">
             <option value="" disabled>Choose an option</option>
             {decision.options.map(option => <option key={option}>{option}</option>)}
           </select>
         </label>}
         {decision.kind === 'checklist' && decision.checks.map(check =>
           <label key={check} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" required/>{check}</label>)}
         {decision.kind === 'recovery' && <div className="space-y-3 rounded-lg border p-4">
           <p className="text-sm">Fictional case card answer: <strong>{decision.fictionalAnswer}</strong>. Do not enter personal information.</p>
           <label className="block text-sm">{decision.prompt}<input data-practice-answer type="text" autoComplete="off" maxLength={40} required className="mt-2 block w-full rounded-md border bg-background p-2"/></label>
           {recoveryError && <p role="alert" className="text-sm text-amber-300">Type the answer shown on the fictional case card.</p>}
         </div>}
         {decision.kind === 'download' && <p className="text-sm text-muted-foreground">The exercise provides only <code>{decision.filename}</code>, a harmless training note.</p>}
         {decision.kind === 'review' && <details className="rounded-lg border p-3 text-sm">
           <summary className="cursor-pointer font-medium">{decision.reveal}</summary>
           <p className="mt-2 text-muted-foreground">{decision.evidence}</p>
         </details>}
         <div className="flex flex-wrap gap-3 pt-2">
           <Button type="submit">{decision.action}</Button>
           <Button type="button" variant="outline" onClick={() => void onReport()}>Report for review</Button>
           <Button type="button" variant="ghost" onClick={onExit}>Return to inbox</Button>
         </div>
       </fieldset>
     </form>
   </section>;
 }
 return <div className="flex min-h-0 flex-1 flex-col bg-slate-100 text-slate-900" data-testid={`landing-${scenario.kind}`}>
   <header className={`${scenario.accent} flex shrink-0 items-center gap-3 px-5 py-5 pr-14 text-white sm:px-8 sm:pr-14`}>
     <Icon className="size-8 shrink-0" aria-hidden="true"/><div className="min-w-0"><p className="text-lg font-semibold tracking-tight">{scenario.brand}</p><p className="text-xs text-white/80">{scenario.reference}</p></div>
   </header>
   <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8">
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
     <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{scenario.reference}</p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{scenario.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{scenario.intro}</p>
      {finance ? <div className="mt-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-4 text-sm font-semibold"><Receipt className="size-4"/>Payment summary</div>
        <dl className="space-y-4 p-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Recipient</dt><dd className="text-right">{scenario.kind==='executive'?'Northstar Advisory':'BrightPath Services'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{scenario.kind==='executive'?'₹4,80,000.00':'₹18,450.00'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="text-amber-700">Awaiting approval</dd></div></dl>
        <p className="border-t border-slate-200 p-4 text-xs leading-5 text-slate-500">{scenario.kind==='executive'?'Executive instruction: process today and restrict circulation until the acquisition is announced.':'Updated settlement instructions apply to this invoice. Please authorize before the close of business.'}</p>
      </div> : document ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <FileText className="size-10 text-indigo-600"/><p className="mt-3 break-words font-medium">{scenario.kind==='esign'?'Offer Letter · Senior Analyst.pdf':'Q4 organization update.pdf'}</p><p className="mt-1 text-xs text-slate-500">{scenario.kind==='esign'?'3 pages • Signature requested':'8 pages • Restricted access'}</p>
        <div className="my-5 space-y-2" aria-hidden="true">{[1,2,3,4].map(n=><div key={n} className={`h-2 rounded bg-slate-200 ${n===4?'w-2/3':'w-full'}`}/>)}</div><p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="size-3"/>Preview locked until verification</p>
      </div> : scenario.kind==='parcel' ? <ol className="mt-6 space-y-4 border-l-2 border-orange-200 pl-4 text-sm"><li><p className="font-medium">Dispatched</p><p className="text-xs text-slate-500">Regional sorting center</p></li><li><p className="font-medium">Delivery attempted</p><p className="text-xs text-slate-500">Recipient unavailable</p></li><li className="font-medium text-orange-700">Choose a new delivery window</li></ol> : <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-medium">{scenario.kind==='payroll'?'Processing status: on hold':'Account status: action required'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{scenario.kind==='payroll'?'Profile verification is required to resume processing.':'Workspace access may be interrupted until verification is complete.'}</p></div>}
     </section>
     <form className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={e=>{e.preventDefault();void onSubmit();}}>
      <h3 className="text-lg font-semibold">{scenario.kind==='parcel'?'Delivery preferences':finance?'Authorize request':document?'Verify to open':'Account verification'}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{scenario.kind==='parcel'?'Select a slot for the next delivery attempt.':'Choose a demo identity. This exercise never asks for your credentials.'}</p>
      <fieldset disabled={busy} className="mt-5 space-y-4">
       {scenario.kind==='parcel' ? <><label className="block text-sm font-medium">Delivery window<select required defaultValue="" className={field}><option value="" disabled>Choose a window</option><option>Tomorrow, 9 AM – 12 PM</option><option>Tomorrow, 2 PM – 6 PM</option><option>Next working day, 9 AM – 12 PM</option></select></label><label className="block text-sm font-medium">Delivery option<select className={field}><option>Deliver to reception</option><option>Collect from depot</option></select></label></> : <>
        <label className="block text-sm font-medium">Practice identity
          <select required defaultValue="" className={field}>
            <option value="" disabled>Select a fictional identity</option>
            <option>Demo learner</option><option>Demo reviewer</option>
          </select>
        </label>
       </>}
       {(finance||scenario.kind==='esign')&&<label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" required className="mt-1"/>{finance?'I have reviewed the payment details and authorize this request.':'I agree to review and sign this document electronically.'}</label>}
       <button type="submit" className={`${scenario.accent} flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50`}>{busy?'Processing…':scenario.action}<ArrowRight className="size-4"/></button>
      </fieldset>
      <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
       <Button type="button" variant="outline" disabled={busy} className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900" onClick={()=>void onReport()}>Report suspicious request</Button>
       <button type="button" disabled={busy} className="w-full py-2 text-xs text-slate-500 hover:text-slate-900" onClick={onExit}>Return to inbox</button>
      </div>
     </form>
    </div>
   </div>
 </div>;
}
