"use client";
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { GraduationCap, ArrowRight, CheckCircle2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useParticipants, useTraining } from '../hooks';
import { api, apiErrorMessage, type TrainingModule } from '../api';
import { ErrorState, SectionTitle } from '../shared';
import { useIdentity } from '../SessionGate';
type Quiz = { question: string; options: string[] };
export default function TrainingView() {
 const identity = useIdentity();
 const { data: people } = useParticipants();
 const { data, error, refresh } = useTraining();
 const participants = (people?.participants ?? []).filter(p => p.active && p.consented);
 const [picked, setPicked] = useState('');
 const participantId = identity.participantId || picked || participants[0]?.id || '';
 const [selected, setSelected] = useState<TrainingModule | null>(null);
 const [stage, setStage] = useState<'baseline' | 'lesson' | 'followup' | 'result'>('baseline');
 const [questions, setQuestions] = useState<Quiz[]>([]);
 const [quizId, setQuizId] = useState('');
 const [answers, setAnswers] = useState<number[]>([]);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [result, setResult] = useState<{score:number;total:number;passed:boolean;explanations:string[]} | null>(null);
 const attempts = data?.attempts?.filter(a => a.participantId === participantId) ?? [];
 const baseline = (id: string) => attempts.find(a => a.moduleId === id && a.phase === 'baseline');
 const followup = (id: string) => attempts.filter(a => a.moduleId === id && a.phase === 'followup').at(-1);
 const paired = (data?.modules ?? []).filter(m => baseline(m.id) && followup(m.id));
 const gain = paired.length ? Math.round(paired.reduce((sum,m) => sum + 100*(followup(m.id)!.score / followup(m.id)!.total - baseline(m.id)!.score / baseline(m.id)!.total),0)/paired.length) : null;
 const loadQuiz = async (module: TrainingModule, phase: 'baseline' | 'followup') => {
  setBusy(true); setMessage(''); setAnswers([]); setQuizId(''); setQuestions([]); setResult(null);
  try { const r = await api<{questions:Quiz[];quizId:string}>('/api/training/assessment',{method:'POST',body:JSON.stringify({participantId,moduleId:module.id,phase})}); setQuestions(r.questions); setQuizId(r.quizId); setStage(phase); } catch(e){setMessage(apiErrorMessage(e));} finally{setBusy(false);}
 };
 const submit = async () => {
  if (!selected) return; setBusy(true); setMessage('');
  try { const r=await api<{score:number;total:number;passed:boolean;explanations:string[]}>('/api/training/assessment',{method:'POST',body:JSON.stringify({participantId,moduleId:selected.id,phase:stage,answers,quizId})}); setResult(r); setStage(stage==='baseline'?'lesson':'result'); await refresh(); } catch(e){setMessage(apiErrorMessage(e));} finally{setBusy(false);}
 };
 return <div className="space-y-6">
  <SectionTitle title="Learn. Practice. Prove it." icon={GraduationCap} description="Measure your starting point, study the red flags, then try a different scenario. Progress is for coaching, never blame."/>
  <div className="flex flex-wrap items-center gap-3"><label htmlFor="learner" className="text-sm">{identity.role==='admin'?'Demo participant':'Your learning record'}</label><select id="learner" className="max-w-full rounded-lg border bg-card p-2 text-sm" value={participantId} disabled={identity.role==='participant'} onChange={e=>setPicked(e.target.value)}>{participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
  {error && <ErrorState message={error} onRetry={()=>void refresh()}/>}
  <div className="grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Learning gain</p><p className="mt-2 text-3xl font-semibold text-emerald-300">{gain===null?'Not measured':`${gain>0?'+':''}${gain} pp`}</p><p className="mt-2 text-xs text-muted-foreground">Paired first baseline / latest follow-up. {paired.length} module(s).</p></Card><Card className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Verified modules</p><p className="mt-2 text-3xl font-semibold">{data?.completions.filter(c=>c.participantId===participantId).length ?? 0} / {data?.modules.length ?? 0}</p><p className="mt-2 text-xs text-muted-foreground">All follow-up answers must be correct.</p></Card><Card className="p-5"><Target className="mb-2 size-5 text-emerald-300"/><p className="text-sm font-medium">Practice the gap</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Recommendations follow your simulation interactions. Short quizzes indicate learning, not real-world risk.</p></Card></div>
  {data?.modules.length === 0 && <Card className="p-5"><h2 className="font-semibold">No lessons installed</h2><p className="mt-2 text-sm text-muted-foreground">Ask the administrator to initialize the training catalog for this workspace.</p></Card>}
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data?.modules.map(m=>{
   const recommendation=data.recommendations?.find(r=>r.participantId===participantId && r.moduleTitle===m.title);
   const done=data.completions.some(c=>c.participantId===participantId&&c.moduleId===m.id);
   return <Card className="flex flex-col p-5" key={m.id}><div className="flex items-center justify-between text-xs text-emerald-300"><span>{m.category} · {m.durationMin} min</span>{done&&<CheckCircle2 className="size-4"/>}</div><h2 className="mt-3 text-lg font-semibold">{m.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{m.summary}</p>{recommendation&&<p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200">Recommended: {recommendation.reason}</p>}<Button disabled={!participantId||busy} className="mt-5" variant={recommendation?'default':'outline'} onClick={()=>{setSelected(m);setMessage('');setResult(null);if(baseline(m.id))setStage('lesson');else void loadQuiz(m,'baseline');}}>{baseline(m.id)?'Review and practice':'Start baseline'}<ArrowRight className="ml-2 size-4"/></Button></Card>;
  })}</div>
  <Dialog open={!!selected} onOpenChange={o=>{if(!o&&!busy)setSelected(null);}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{stage==='baseline'?'Answer a few questions before the lesson.':stage==='followup'?'Apply the lesson to a different scenario.':'A short lesson. A stronger instinct.'}</DialogDescription></DialogHeader>
  {message&&<p role="alert" className="text-red-300">{message}</p>}
  {busy&&<p className="text-sm text-muted-foreground">Saving your progress…</p>}
  {(stage==='baseline'||stage==='followup')&&<div className="space-y-6">{questions.map((q,i)=><fieldset key={q.question} className="space-y-2"><legend className="mb-2 font-medium">{i+1}. {q.question}</legend>{q.options.map((option,j)=><label key={option} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name={`q-${i}`} checked={answers[i]===j} onChange={()=>setAnswers(prev=>{const next=[...prev];next[i]=j;return next;})}/>{option}</label>)}</fieldset>)}<Button disabled={busy||!quizId||!questions.length||!questions.every((_,i)=>Number.isInteger(answers[i]))} onClick={()=>void submit()}>Check answers</Button></div>}
  {stage==='lesson'&&selected&&<div className="space-y-5">{result&&<p className="rounded-lg bg-emerald-500/10 p-3 text-sm">Baseline: {result.score}/{result.total}. This is your starting point.</p>}<div className="space-y-3 text-sm leading-7 [&_h2]:mt-5 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc"><ReactMarkdown>{selected.contentMd}</ReactMarkdown></div><Button disabled={busy} onClick={()=>void loadQuiz(selected,'followup')}>Try the follow-up</Button></div>}
  {stage==='result'&&result&&<div className="space-y-4"><h3 className="text-2xl font-semibold text-emerald-300">{result.score}/{result.total} · {result.passed?'Module verified':'Keep practicing'}</h3>{result.explanations.map(e=><p key={e} className="rounded-lg border p-3 text-sm leading-6">{e}</p>)}<Button onClick={()=>setStage('lesson')}>Review lesson</Button><Button variant="outline" onClick={()=>setSelected(null)}>Back to learning</Button></div>}
  </DialogContent></Dialog>
 </div>;
}
