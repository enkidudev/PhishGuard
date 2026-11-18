# PhishGuard

PhishGuard is a security awareness lab for authorized phishing simulations. Participants practice spotting suspicious messages in a controlled inbox, get immediate feedback, and take short quizzes. Organizers can review campaign activity and compare quiz results without sending real emails or collecting real credentials.

Built for PS-28, Cybersecurity Awareness and Authorized Phishing Simulation Platform.

[Live demo](https://phishguard-quickhealctf.vercel.app/) · [Five-minute jury walkthrough](docs/DEMO_RUNBOOK.md) · [Sample awareness report](docs/SAMPLE_AWARENESS_REPORT.md)

## What you can do

- **Organizers** approve sender and recipient domains, invite participants, and launch campaigns for people who have given consent.
- **Participants** inspect simulated messages in the test inbox, decide how to respond, and get feedback on the warning signs they might have missed.
- **Reviewers** can see campaign activity and compare baseline and follow-up quiz results. The sample awareness report shows how to present those findings using fictional data.

## Run it locally

Install Node.js 20.19 or later with npm.

### Windows

Double-click `run.bat`. The launcher installs missing dependencies, asks you to choose an administrator passphrase on first setup, prepares SQLite, installs the demo catalog, and starts the app.

### macOS and Linux

Run these commands from the project directory to install the full demo:

```sh
npm ci
npm run setup
npm run db:push
npm run demo:install
npm run dev
```

On either platform, open [http://127.0.0.1:3000](http://127.0.0.1:3000) and sign in with the administrator passphrase you chose. Setup accepts 12 to 256 characters and displays your input in the terminal as you type.

### Demo data and existing workspaces

The full demo includes 12 fictional participants, four sample campaigns, seven original templates, eleven interactive templates, and five core lessons. The installer preserves existing participants, consent records, templates, and campaign activity.

To install only the interactive template catalog and any missing core lessons, run `npm run templates:install` after `npm run db:push`. When upgrading an existing local workspace, keep your `.env` file and `db` directory, then rerun the launcher or the database and catalog commands.

To reset a **disposable local demo database**, stop the app and run:

```sh
npm run demo:reset
npm run templates:install
npm run dev
```

`demo:reset` replaces the contents of the configured database. Skip it when upgrading an existing workspace.

## Walk through a campaign

1. In **Compliance**, approve the exact domains used by the fictional sender and participant addresses.
2. Create a fictional participant and issue an invitation. Open the invitation in a separate browser profile, then accept it as the participant.
3. In **Campaigns**, select a template, assign consenting participants, and launch the campaign.
4. In the participant’s **Test Inbox**, open the message. Report it, follow its link into the exercise, or dismiss it. Opening the link records an interaction and carries no leaderboard penalty. Closing the exercise does not record a submission.
5. Review the scenario feedback and complete a training module. Use the baseline and follow-up quizzes to compare performance before and after coaching.
6. Return to the organizer workspace to review campaign activity and learning results.

Scenarios include shared documents, payroll notices, account recovery, supplier payment changes, parcel redelivery, and e-signing. Use invented values in any practice fields. Follow the [jury walkthrough](docs/DEMO_RUNBOOK.md) for a shorter path through the demo.

## Studio, analytics, and reporting

The draft generator runs locally and creates internal exercises from six supported presets, with coaching notes. The message analyzer flags signals in pasted text, such as mismatched reply domains, unexpected payment requests, suspicious links, and pressure to act. Its findings give participants things to check. The analyzer does not open links or verify sender identities.

Local coaching and analysis work without an AI key. External AI is disabled by default. If you enable it for supported analysis and coaching features, review what text your provider will receive before pasting a message. The template generator runs locally in either mode.

The organizer can review opens, simulated clicks, submissions, reports, and paired quiz results. Exported participant labels are pseudonyms. Small departments may be omitted from aggregate views. Seeded demo activity is fictional and should be presented as such. See the [sample awareness report](docs/SAMPLE_AWARENESS_REPORT.md) for an example.

## Authorization and privacy

| Safeguard | How it works |
| --- | --- |
| Organizer and participant access | Signed sessions distinguish the two roles. Participant invitations expire and can only be accepted once. |
| Campaign authorization | Campaigns require participant consent and approved sender and recipient domains. Simulated messages stay inside the test inbox. |
| Practice inputs | Practice field values stay in the browser and are cleared on submission or exit. The server records the action and timestamp. |
| Template preview | Templates render in a sandboxed preview. |
| Reporting | Exports use pseudonymous participant labels and escape spreadsheet formulas. |
| Data retention | The retention job removes expired campaign enrollments and their events. |

See the [security review](docs/SECURITY_REVIEW.md) for the threat model and known limitations.

## Technology and deployment

PhishGuard uses Next.js, React, and TypeScript for the web application and API, with Tailwind CSS for styling and Prisma for database access. The local setup uses SQLite. The hosted demo runs on Vercel with a separate Neon PostgreSQL database.

See the [Vercel and Neon setup guide](docs/VERCEL.md) for hosted database initialization and deployment.

### Configuration

| Setting | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin. The local default is `http://127.0.0.1:3000`. |
| `DATABASE_URL` | Runtime database connection. The local default is `file:../db/custom.db`, relative to the Prisma schema. Hosted deployments use the Neon connection string. |
| `SESSION_SECRET` | Signs sessions and invitations. Generated by setup. |
| `ADMIN_PASSWORD_HASH` | Verifies the administrator passphrase. Generated by setup. |
| `COOKIE_SECURE` | Set to `true` when serving over HTTPS. |
| `AI_ENABLED` | Enables supported external AI features when the provider is configured. Defaults to `false`. |

If you get a same-origin error locally, open the exact address set in `APP_ORIGIN`. The Windows launcher repairs the local origin setting. Keep `.env` files, database credentials, and local database files out of Git.

For a local production build, run `npm run build` followed by `npm start`. The local server binds to loopback by default. The application is designed for one organization on a trusted host.

## Run the checks

```sh
npm run lint
npm run typecheck
npm test
npm run verify:api
npm run build
```

The API verification command starts a local server with a temporary SQLite database. Stop your development server first so port 3000 is free. For browser verification, install Playwright Chromium and run:

```sh
npx playwright install chromium
npm run verify:browser
```

## Credits

This repository is a standalone snapshot of PhishGuard for the hackathon submission.
- **[ScriptJackers]**
