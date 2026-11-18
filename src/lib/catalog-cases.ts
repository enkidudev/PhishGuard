import { catalogExercises } from './catalog-exercises'

const cases: Record<string, { subject: string; lines: [string, string] }> = {
  lottery: { subject: 'Prize office case | Claim F-104', lines: ['The prize desk received a claim for a draw the recipient never entered.', 'Case file: the notice lists a processing fee but no matching entry record.'] },
  holiday: { subject: 'Travel desk case | Unconfirmed itinerary', lines: ['An itinerary appears under the employee’s name without a travel request on file.', 'Case file: the booking source is an award notice, and no reservation appears in the approved portal.'] },
  coworker: { subject: 'Team chat case | Channel change', lines: ['A workplace conversation is followed by a request to move to a personal channel.', 'Case file: the display name matches the team directory, but the address is unfamiliar.'] },
  invoice: { subject: 'Accounts payable case | Supplier record change', lines: ['A supplier record shows a payment destination change while an invoice is pending.', 'Case file: the existing vendor record has a known contact. The change has no separate approval attached.'] },
  document: { subject: 'Document review case | Unexpected attachment', lines: ['A shared file arrives outside the usual document workflow.', 'Case file: the attachment is named demo-document.txt. The sender and document have not been verified.'] },
  'payroll-file': { subject: 'Payroll case | Unexpected worksheet share', lines: ['An example payroll worksheet was shared outside the usual access review window.', 'Case file: the share includes a downloadable training attachment. It is a harmless text file and contains no payroll records.'] },
  account: { subject: 'IT help desk case | Account access notice', lines: ['A workplace access notice claims a verification step is overdue.', 'Case file: the employee has no matching ticket and can check the approved sign-in portal separately.'] },
  'qr-notice': { subject: 'Facilities case | QR code on a notice', lines: ['An office notice contains a QR code where employees expect a printed service address.', 'Case file: the destination is unknown until decoded. The exercise shows it as inert text.'] },
  'meeting-change': { subject: 'Calendar case | Organizer mismatch', lines: ['A calendar update changes the time for an existing team meeting.', 'Case file: the original and updated events list different organizers.'] },
  'app-access': { subject: 'Access review case | New calendar app', lines: ['A calendar tool appears in the workspace software queue.', 'Case file: the app says it needs calendar access. The permission list also includes shared files and resource management.'] },
  recovery: { subject: 'Account support case | Recovery request', lines: ['The help desk received a recovery request that the employee did not start.', 'Case file: it refers to a recovery questionnaire, but no corresponding case appears in the official portal.'] },
}

export function casePresentation(id: string) {
  const entry = cases[id]
  const exercise = catalogExercises[id]
  if (!entry || !exercise) return null
  const bodyHtml = `<div style="max-width:620px;color:#172b24">
    <p style="color:#475569;font-size:12px">SIMULATION CASE FILE</p>
    <h2 style="color:#0f172a;font-size:21px">${exercise.heading}</h2>
    <p>${entry.lines[0]}</p>
    <blockquote style="background-color:#f1f5f9;color:#1e293b;padding:12px">${entry.lines[1]}</blockquote>
    <p><a href="#">Open practice screen</a></p>
  </div>`
  return { subject: entry.subject, bodyHtml }
}
