# Five-minute jury demonstration

## The central claim

“PhishGuard closes the loop between a risky decision and a measurable lesson, inside an authorized environment that never needs an employee's password.”

Describe the visible numbers as **fictional fixture data plus live demonstration interactions**. Never present them as results from actual employees. External AI is optional; the whole core demonstration works without it.

## Before presenting

- Follow README setup, choose the local administrator passphrase, and open 127.0.0.1:3000.
- Start from `npm run demo:reset` only on the demo database. This clears all application data.
- Keep one administrator browser profile and a second private profile for the participant.
- In Compliance, choose an active seeded participant from the running Payroll campaign. Use their Actions menu to create an invitation. Open it in the participant profile and accept the notice.
- Confirm the participant sees only Test Inbox and Training. No administrator credentials should appear on screen.
- Keep Analytics open in an administrator tab. Ensure printer destination is “Save as PDF” if demonstrating the sample report.
- Rehearse on the exact presentation laptop. The browser test suite is included; visual verification was blocked in the development environment.

## 0:00–0:40 — Problem and control

Show Overview. “A click count identifies a behavior. It does not tell us whether someone learned. We connect the decision to a lesson and compare assessments before and after.”

Point out: consented learners, active campaigns, no outbound email, no transmission of entered values. Learning gain starts at “Not measured” until actual assessments exist.

## 0:40–1:20 — Authorization is enforced

Show Compliance domains and the participant notice. Explain that both sender and recipient domains must be approved. An unconsented participant cannot be included in a new campaign. The participant cannot open administrator APIs.

Do not spend the pitch manually editing cookies. Mention that these boundaries are covered by automated integration tests and keep that evidence ready for questions.

## 1:20–2:15 — A safe mistake

In the participant profile, open a message and select **Inspect simulated link** or **Open link**.

The link opens a matching scenario page. Use invented values for sign-in exercises. Submit or report to display feedback and the quiz. Close the page to return to the inbox with no outcome recorded. Entered values stay local and are cleared.

“We record the decision, never a password. Reporting is an alternative decision, not a stage that requires clicking first.”

## 2:15–3:30 — Prove learning

Open Training. Choose the recommended lesson. Answer the baseline honestly, read the explanation, then complete the different follow-up scenario. Both follow-up answers must be correct to mark the module complete.

Show the saved baseline/follow-up result and percentage-point change. Do not promise a positive change before measuring it. Explain that the first baseline stays fixed; later follow-ups represent the latest practice result.

## 3:30–4:20 — Privacy and evidence

Show Analytics and the printable awareness report. Small departments are omitted on the server. Export participants to demonstrate aliases rather than names/emails. Explain that authorized administrators still need identified participant records for program administration.

Show the application audit trail and retention controls. Expired enrollment timestamps and events are deleted together, keeping dashboards consistent.

## 4:20–5:00 — Stop and close

Use **Stop all campaigns** and confirm. Return to an already opened participant exercise: subsequent tracking is rejected. Alternatively demonstrate **Withdraw consent**, which ends the participant session and blocks future participation until a new invitation is accepted.

Close: “The result is a controlled learning workflow: authorize, simulate, coach, assess and report. The safeguards are part of the application behavior, not just a disclaimer.”

## Align with the four equal scoring categories

| Category | Evidence to show |
|---|---|
| Innovation, 25% | Decision-to-lesson-to-assessment loop; zero credential-input simulation; reporting as a positive action |
| Technical, 25% | Server-enforced scope, safe HTML isolation, transactional tracking, strict payloads, repeatable tests |
| Feasibility, 25% | One Node process, SQLite, local coaching without external credentials, explicit scaling path |
| Presentation, 25% | One clear participant journey, real live interactions, honest metric definitions, a short printable report |

## Questions to be ready for

**Why no real email?** The deliverable asks for a controlled demonstration. The inbox proves campaign/learning behavior without mail reputation, delivery or recipient-scope risks. Real delivery would be a separate approved transport with independently verified domains and delivery protections.

**Is the learning score proof of reduced risk?** No. It measures improvement on short paired assessments. Longer-term validation needs repeated campaigns, stable cohorts and more varied questions.

**What happens if AI is unavailable?** Local coaching, the question bank and deterministic summaries continue. The core learning evidence does not depend on a model response.

**Is it enterprise-ready?** It is a tested single-process prototype. Enterprise adoption requires SSO/MFA, organization isolation, richer authorization, durable jobs, shared rate limiting, encrypted backups and external audit protection.
