# Security review and implementation record

Reviewed against the supplied hackathon statement on 17 November 2026. The base application's source matched GitHub main commit `b1372aa65d9f7e0a3241e00c7cae4f3c8fb84d38`; only the repository's `.gitignore` differed from the uploaded ZIP. This document records the earlier baseline review.

## Threat model

Protect participant identity, consent, interaction integrity, training history and administrator capabilities. Consider unauthenticated callers, a participant trying another participant's identifiers, malicious template HTML, replayed invitations, concurrent event requests, revoked authorization, and exported spreadsheet formulas. The host administrator, operating system and local database are trusted. This is one organization and one application instance, not a tenant-isolation design.

## Findings and changes

| Base finding | Implemented response | Evidence |
|---|---|---|
| Administrative and participant APIs lacked authenticated identity | Signed eight-hour sessions, administrator-only APIs, per-participant object checks | API integration suite |
| Consent could be set by arbitrary callers | Single-use, expiring participant invitations and explicit acceptance; administrator can revoke but cannot grant new consent | Invitation replay and grant-block tests |
| Only sender domain was checked | Sender and participant domain checks at create/launch and every tracked interaction | Domain gate test |
| Cancelled campaigns and withdrawn participants could still submit events | Running-state, active-status, consent and domain rechecks; emergency stop | Tracking after withdrawal and stop tests |
| Unsafe HTML insertion in application DOM | Allowlist HTML sanitizer plus sandboxed iframe and network-denying frame CSP | Sanitizer unit/API tests; browser assertion included but not executed successfully here |
| Simulation invited arbitrary credentials | Uncontrolled practice inputs are never read or serialized; tracking rejects extra fields | Source check and browser assertion included |
| Free-text tracking notes could persist secrets | Strict two-field payload schema; no notes/credential values | Extra-field rejection tests |
| Concurrent events could double-count | Transactional timestamp claims and event inserts | Five concurrent submissions produce one SUBMITTED event |
| Live-feed fields did not match client shape; separate service was unprotected | Authenticated same-origin polling, consistent fields, no participant names in feed | API access-control test |
| Named exports contradicted privacy claims | Keyed participant aliases, no raw name/email export fields, CSV formula escaping | Export integration and CSV unit tests |
| Department suppression was client-side | API suppresses groups with fewer than three active participants | Analytics integration assertion |
| AI coaching sent participant names | Removed names; report model input is numeric allowlist; AI off by default | Source inspection |
| Manual purge left interaction timestamps and ignored campaign policy | Delete expired enrollments and cascading events together; shorter global/campaign window; background sweep | Retention/dashboard consistency test |
| Training completion was a button with no assessment | Different baseline/follow-up questions, server scoring, completion on perfect follow-up, paired learning gain | Assessment authorization and completion tests |
| Seeded completion counts looked like measured learning | Learning attempts and completions start empty in fixture | Fixture inspection |
| Random activity distorted demonstration metrics | Random activity endpoint returns 410; internal inbox supplies actual demo interactions | Source inspection |
| Build hid TypeScript errors and local setup required Bun | Strict successful TypeScript/build checks, Node-only scripts, no external font downloads | Build and static checks |
| Unused dependency surface included known advisories | Removed unused direct dependencies; updated sharp; pinned compatible deepmerge override | Production dependency audit: zero known vulnerabilities at verification time |

The older socket service, helper examples and build scaffolding are retained in the original working copy, but are not part of the curated release package or documented runtime. The original uploaded ZIP remains available in the workspace. Git history, logs, local secrets, dependencies and build outputs are not included in the release.

## Validation status

- Seven focused unit tests: session signatures/expiry/purpose, HTML sanitizer, formula-safe CSV, keyed aliases, valid paired assessment questions.
- Four API integration scenarios cover authentication and learning, domain approval and template safety, retention, and Studio. These contain multiple assertions and run against a separate temporary database.
- TypeScript, ESLint and optimized production compilation checked without suppressing type errors.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities at the time of review. This is a package-advisory check, not proof that the application is vulnerability-free.
- Chromium visual automation could not launch because the environment prohibited its local process-singleton socket. The desktop/mobile suite is included but is **not claimed as passed**. Rehearse the visible flows on the presentation machine.
- External AI connectivity was not tested; it is disabled by default and deterministic local behavior is the demonstration baseline.

## Metric definitions

- Open/click/report rates divide unique interaction counts by delivered enrollments.
- Clicking/landing/continuing implies previous simulated stages. A report can happen without a click; it is not an obligatory terminal funnel stage.
- Resilience = 40% non-click rate + 40% report rate + 20% training completion, clamped to 0–100. This is a heuristic, not a calibrated risk model.
- Learning gain is the mean percentage-point difference between first baseline and latest follow-up for paired participant/module records. Unpaired records do not contribute. Repeated practice is allowed; the score is not a blinded randomized evaluation.
- Recommendations map the simulation category to a relevant lesson. They do not infer a participant's personality or susceptibility outside the observed exercise.
- Opening an internal inbox message is a deterministic UI event, not an email tracking-pixel estimate.
- Fixture events are synthetic. The UI labels the controlled demo; do not combine these numbers with claims about actual employees.

## Remaining deployment work

1. **Identity:** one administrator passphrase is appropriate for a local demonstration. Add SSO/MFA, scoped staff roles, session revocation and account recovery before organizational rollout.
2. **Infrastructure:** SQLite, in-memory limits and an in-process sweep target one persistent instance. Multiple instances need a shared database, rate-limit store and durable scheduler. Use HTTPS, secure cookies and a private persistent volume.
3. **Audit:** audit rows can be changed by the database owner. External append-only storage or signed audit checkpoints would be needed for stronger evidentiary guarantees.
4. **Privacy:** aliases remain linkable across exports while the session secret stays constant; they are pseudonyms. Active identity/consent records and campaign/template configuration have a different lifecycle from event data. Backup retention needs a separate operational policy. Global aggregate totals can still describe very small overall programs; avoid publishing tiny-cohort reports.
5. **Assessment:** the small, curated two-question bank is a demonstration of the learning loop. Expand and validate questions, introduce parallel forms and measure behavior across future campaigns before making effectiveness claims.
6. **Browser security:** the main application permits framework-required inline scripts and development eval; the untrusted preview has a much stricter sandbox/CSP. A nonce-based production CSP is a further hardening step.
7. **Availability:** quotas are single-process and intentionally conservative. SQLite contention can reject a request under load; clients should retry after an error. A load test has not been performed.
8. **Integration:** no real email transport, mail-provider reporting plug-in, organizational domain-ownership verification, multi-tenant administration or cross-device SSO is implemented. Those are future integrations, not hidden capabilities of the prototype.
