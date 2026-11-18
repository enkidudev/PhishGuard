import type { Prisma } from '@prisma/client'

export async function installModules(db: Prisma.TransactionClient) {
  const modules = [
    {
      title: 'Spotting Phishing Red Flags',
      category: 'Foundations',
      durationMin: 5,
      summary: 'Learn the universal warning signs present in nearly every phishing attempt.',
      contentMd: `## Why this matters
Phishing is the #1 initial access vector in real breaches. Most attacks fail not because of technology, but because **one alert human** noticed something off.

## The big four red flags
1. **Urgency & pressure** · "expires today", "final notice", "account will be suspended".
2. **Authority or fear** · fake executives, fake IT, fake HR, threats of consequences.
3. **Mismatched details** · sender domain look-alikes, links that don't match the text, generic greetings.
4. **Unusual requests** · payments outside process, confidential attachments you didn't expect.

## The 10-second habit
Before clicking anything: **Stop. Inspect the sender. Hover the link. Ask: was I expecting this?**

## Golden rule
No legitimate organization punishes you for verifying through an official channel. When in doubt, report it.`,
      redFlagTips: JSON.stringify(['Urgency', 'Authority', 'Mismatched details', 'Unusual requests']),
    },
    {
      title: 'Urgency & Pressure Tactics',
      category: 'Social Engineering',
      durationMin: 4,
      summary: 'How attackers manufacture deadlines to shut down your critical thinking.',
      contentMd: `## The psychology
Urgency narrows attention. When we feel time pressure, we switch from deliberate thinking to fast, automatic reactions · exactly what attackers want.

## Common pressure scripts
- "Your account will be deleted in 24 hours"
- "Final notice before collections"
- "The CEO needs this before boarding"

## The counter-move
Any genuine deadline survives a 5-minute verification. **Urgency that punishes verification is the attack itself.**

## Practice
Next urgent email: reply (in your head) · "Interesting claim. How would I verify this officially?"`,
      redFlagTips: JSON.stringify(['Manufactured deadlines', 'Consequence threats', 'Secrecy + urgency combos']),
    },
    {
      title: 'Safe Link Hygiene',
      category: 'Foundations',
      durationMin: 6,
      summary: 'Hovering, domain reading and the anatomy of a deceptive URL.',
      contentMd: `## Read URLs right-to-left
In \`secure-acme.login-portal.test\`, the real domain owner is **login-portal.test** · everything before it is just a path.

## Habits that catch 90% of malicious links
1. **Hover before you click** (long-press on mobile) and read the tooltip.
2. Prefer **bookmarks / SSO dashboards** for sensitive portals.
3. Treat **shortened links** as opaque · expand them first.
4. A padlock icon means encryption, **not honesty** · phishing sites have certificates too.

## Simulated clicks in this platform
When you click a simulated link, you see a safe teaching moment instead of a credential page. No credentials are ever requested or stored here.`,
      redFlagTips: JSON.stringify(['Right-to-left domain reading', 'Hover to verify', 'Bookmarks beat links']),
    },
    {
      title: 'Reporting: Your Superpower',
      category: 'Response',
      durationMin: 3,
      summary: 'Why every report · right or wrong · makes the organization safer.',
      contentMd: `## Reports are data, not verdicts
A report button press takes 3 seconds and gives the security team eyes on the threat. False positives cost nothing; a missed phish can cost millions.

## Speed matters
Time-to-report is the metric that stops campaigns: reported phishes get blocked for everyone within minutes.

## In this platform
Use **Report Phish** in the simulated inbox. Reporting *before* clicking is the ideal behaviour we train for · but reporting *after* clicking is just as valuable: say something early.`,
      redFlagTips: JSON.stringify(['Report early', 'Never fear false alarms', 'Report even after clicking']),
    },
    {
      title: 'Executive Impersonation & BEC',
      category: 'Advanced',
      durationMin: 7,
      summary: 'Business Email Compromise: the most expensive phishing category.',
      contentMd: `## What BEC looks like
No links, no attachments · just a convincing "urgent, confidential" request from leadership. The FBI consistently ranks BEC among the costliest cyber-crime categories.

## The tell-tale pattern
1. Authority (CEO/CFO) + urgency ("before my flight") + secrecy ("keep this internal").
2. A payment or data request **outside** the normal process.
3. Reply-to or display-name tricks.

## The unbreakable rule
**Out-of-band verification**: any payment or credential request is confirmed by phone/video with a known number · never by replying to the email.`,
      redFlagTips: JSON.stringify(['Authority + secrecy', 'Out-of-band verification', 'Process exceptions are attacks']),
    },
  ]
  for (const m of modules) {
    if (await db.trainingModule.findFirst({ where: { title: m.title } })) continue
    const id = 'core-' + m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
    await db.trainingModule.upsert({ where: { id }, update: { id }, create: { ...m, id } })
  }
}
