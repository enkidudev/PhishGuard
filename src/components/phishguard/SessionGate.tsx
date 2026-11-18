"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, ArrowRight, LockKeyhole, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, apiErrorMessage } from './api';
export type Identity = { role: 'admin' | 'participant'; name: string; participantId?: string; consented?: boolean };
const Context = createContext<Identity>({ role: 'admin', name: '' });
export const useIdentity = () => useContext(Context);
export function SessionGate({ children }: { children: ReactNode }) {
 const [identity, setIdentity] = useState<Identity | null>(null);
 const [loading, setLoading] = useState(true);
 const [password, setPassword] = useState('');
 const [invite, setInvite] = useState('');
 const [consent, setConsent] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const refresh = async () => { try { const r = await api<{ session: Identity | null }>('/api/auth/session'); setIdentity(r.session); } finally { setLoading(false); } };
 useEffect(() => {
  const boot = async () => { await Promise.resolve();
  const token = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (token) { setInvite(token); history.replaceState(null, '', location.pathname); setLoading(false); }
  else await refresh();
  }; void boot().catch(() => { setLoading(false); setError('Unable to reach the platform.'); });
 }, []);
 if (loading) return <div className="grid min-h-screen place-items-center text-sky-400">Opening your workspace…</div>;
 if (identity) return <Context.Provider value={identity}>{children}</Context.Provider>;
 return <main className="dark grid min-h-screen place-items-center bg-[#081411] px-5 py-12 text-white">
  <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-sky-900/60 bg-[#0b1c16] md:grid-cols-2">
   <section className="space-y-8 bg-gradient-to-br from-sky-900/60 to-[#0b1c16] p-8 md:p-12">
    <div className="flex items-center gap-3 font-semibold"><ShieldCheck className="text-sky-300"/> PhishGuard <span className="rounded-full border border-sky-600/50 px-2 py-1 text-[10px] uppercase tracking-widest">Controlled lab</span></div>
    <h1 className="text-4xl font-semibold leading-tight tracking-tight">Build the instinct.<br/><span className="text-sky-300">Break the phishing chain.</span></h1>
    <p className="text-sm leading-7 text-sky-100/70">Practice realistic decisions in a contained inbox. Learn why a lure works, then prove what you learned.</p>
    <div className="space-y-4 text-sm text-sky-100"><p>01 &nbsp; Authorize the exercise</p><p>02 &nbsp; Spot, pause and report</p><p>03 &nbsp; Measure learning, not blame</p></div>
    <p className="border-t border-sky-800 pt-5 text-xs leading-6 text-sky-100/60">No outbound email. Practice inputs stay in your browser and are never sent. External AI is optional and disabled by default.</p>
   </section>
   <section className="flex flex-col justify-center p-8 md:p-12">
    {invite ? <GraduationCap className="mb-5 text-sky-300"/> : <LockKeyhole className="mb-5 text-sky-300"/>}
    <h2 className="text-2xl font-semibold">{invite ? 'Your practice space' : 'Program workspace'}</h2>
    <p className="mt-3 text-sm leading-6 text-zinc-400">{invite ? 'You have been invited to an authorized awareness exercise. Read the notice before joining.' : 'Sign in with the administrator passphrase configured during setup. Participants use their private invitation link.'}</p>
    <form className="mt-7 space-y-5" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api(invite ? '/api/auth/accept' : '/api/auth/login', { method: 'POST', body: JSON.stringify(invite ? { token: invite, consent } : { password }) }); setPassword(''); setInvite(''); await refresh(); } catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); } }}>
     {invite ? <><div className="rounded-xl border border-sky-900 bg-black/20 p-4 text-xs leading-6 text-zinc-300">Only internal simulated messages are used. Opens, clicks, reports and quiz scores are recorded for coaching. Administrators can inspect participation; shared reports use aggregates or pseudonyms. Campaign participation expires within 7–365 days, with a 90-day default. You can withdraw at any time from the session bar. Use invented usernames and passwords in exercise fields. Values remain in the browser and are cleared on submit or exit. Never use real credentials.</div><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1"/>I understand this notice and consent to participate.</label></> : <><label htmlFor="admin-pass" className="text-sm text-zinc-300">Administrator passphrase</label><Input id="admin-pass" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 border-sky-900 bg-black/20"/></>}
     {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
     <Button className="h-12 w-full bg-sky-300 font-semibold text-sky-950 hover:bg-sky-200" disabled={busy || (!!invite && !consent)}>{busy ? 'Opening…' : invite ? 'Join the exercise' : 'Open workspace'} <ArrowRight className="ml-2 size-4"/></Button>
    </form>
   </section>
  </div>
 </main>
}
export function SessionBar() {
 const who = useIdentity();
 const exit = async (withdraw = false) => { await api(withdraw ? '/api/consent' : '/api/auth/logout', { method: 'POST', body: '{}' }); window.location.reload(); };
 return <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-sky-900/50 bg-sky-950/30 px-4 py-2 text-xs"><span>{who.role === 'admin' ? 'Administrator · controlled test environment' : `Participant · ${who.name}`}</span><div className="flex gap-3">{who.role === 'admin' && <ChangePassphrase/>}{who.role === 'participant' && <button onClick={() => { if (confirm('Withdraw consent? Further simulation interactions will stop immediately.')) void exit(true); }} className="text-amber-300">Withdraw consent</button>}<button onClick={() => void exit()} className="text-sky-300">Sign out</button></div></div>
}

function ChangePassphrase() {
 const [open, setOpen] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 return <Dialog open={open} onOpenChange={next => { if (!busy) { setMessage(''); setOpen(next); } }}>
  <DialogTrigger asChild><button type="button" className="text-sky-300">Change passphrase</button></DialogTrigger>
  <DialogContent>
   <DialogHeader>
    <DialogTitle>Change administrator passphrase</DialogTitle>
    <DialogDescription>Use a new passphrase of at least 12 characters. Other administrator sessions will be signed out.</DialogDescription>
   </DialogHeader>
   <form className="space-y-4" onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (fields.get('replacement') !== fields.get('confirmation')) { setMessage('The new passphrases do not match.'); return; }
    setBusy(true); setMessage('');
    try {
     await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: fields.get('current'), replacement: fields.get('replacement') }) });
     form.reset();
     setMessage('Passphrase changed.');
    } catch (error) { setMessage(apiErrorMessage(error)); }
    finally { setBusy(false); }
   }}>
    <label className="block space-y-1 text-sm"><span>Current passphrase</span><Input name="current" type="password" autoComplete="current-password" required maxLength={256}/></label>
    <label className="block space-y-1 text-sm"><span>New passphrase</span><Input name="replacement" type="password" autoComplete="new-password" required minLength={12} maxLength={256}/></label>
    <label className="block space-y-1 text-sm"><span>Confirm new passphrase</span><Input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256}/></label>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <Button disabled={busy}>{busy ? 'Saving…' : 'Save passphrase'}</Button>
   </form>
  </DialogContent>
 </Dialog>;
}
