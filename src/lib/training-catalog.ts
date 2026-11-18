import { casePresentation } from './catalog-cases'

export const trainingCatalog = [
  { id: 'lottery', name: 'Lottery notice', category: 'Prize claims', overview: 'An unexpected prize notice asks for a fee before releasing the award.', clue: 'The recipient never entered the draw, and an advance fee is requested.', advice: 'Verify through the published lottery operator before taking any action.', keywords: /lottery|jackpot|prize|raffle/ },
  { id: 'holiday', name: 'Summer vacation tickets', category: 'Travel offers', overview: 'An unexpected vacation award asks the recipient to confirm a booking.', clue: 'The message claims a booking exists although the recipient made none.', advice: 'Open the travel provider independently to check whether the booking exists.', keywords: /vacation|holiday|ticket|travel/ },
  { id: 'coworker', name: 'Coworker impersonation', category: 'Identity verification', overview: 'A message claiming to be from a teammate asks to switch to a personal messaging account.', clue: 'The display name is familiar, but the address and requested channel are unfamiliar.', advice: 'Contact the teammate through the company directory or an existing conversation.', keywords: /coworker|colleague|employee|impersonat|teammate/ },
  { id: 'invoice', name: 'Supplier payment change', category: 'Payment requests', overview: 'A supplier notice says its bank details have changed.', clue: 'A payment destination changed without the normal approval process.', advice: 'Call the supplier using the number already in your records.', keywords: /invoice|supplier|payment|billing/ },
  { id: 'document', name: 'Unexpected shared document', category: 'Document sharing', overview: 'A document notice claims that a file was shared with the recipient.', clue: 'The document is unexpected and the sender cannot be verified from the message.', advice: 'Check the approved document portal and verify with the sender separately.', keywords: /document|file|shared|sign/ },
  { id: 'account', name: 'Account verification notice', category: 'Account security', overview: 'An account notice claims that access will end unless the recipient verifies their account.', clue: 'The notice pressures the recipient to act before checking the account portal.', advice: 'Open the account portal from a known bookmark and check for a real notification.', keywords: /^(?!.*(?:recovery|security questions)).*(?:account|password|login)/i },
  { id: 'qr-notice', name: 'QR code notice', category: 'Link safety', overview: 'A fictional office notice points readers to a QR code. The exercise asks learners how to check the destination independently.', clue: 'A QR code can conceal the destination until someone opens it.', advice: 'Use the official portal and report unexpected codes through your approved channel.', keywords: /qr code|qr notice/ },
  { id: 'meeting-change', name: 'Unexpected meeting change', category: 'Calendar safety', overview: 'An unfamiliar organizer changes a fictional meeting. Learners compare the change with the original calendar entry.', clue: 'The meeting update came from an organizer who does not match the original invite.', advice: 'Check the original event or reach the organizer through the company directory.', keywords: /meeting|calendar/ },
  { id: 'app-access', name: 'Unfamiliar app permissions', category: 'Access requests', overview: 'A fictional app asks for broad access to a workspace. Learners review whether the permissions fit the stated purpose.', clue: 'The requested permissions exceed what the app needs for the task.', advice: 'Decline unexpected access requests and check with the application owner through a trusted channel.', keywords: /permission|app access|consent request/ },
  { id: 'payroll-file', name: 'Unexpected payroll file share', category: 'Attachment safety', overview: 'Review a fictional payroll worksheet share and decide whether to open the attachment.', clue: 'Payroll documents should come through an approved channel with a verified reason for access.', advice: 'Verify the share with payroll through the official directory before opening unexpected files.', keywords: /payroll.*(?:file|sheet|attach|share)/i },
  { id: 'recovery', name: 'Account recovery questions', category: 'Account recovery', overview: 'A fictional help desk case asks a learner to compare example recovery prompts with the approved support process.', clue: 'Unsolicited recovery questions request information that could be reused to access an account.', advice: 'Start recovery in the official account portal and never disclose security answers in an unsolicited form.', keywords: /recovery|security questions/ },
];

export function makeTrainingDraft(entry: typeof trainingCatalog[number], difficulty: 'easy' | 'medium' | 'hard') {
  const preview = casePresentation(entry.id);
  return {
    name: entry.name,
    category: entry.category,
    difficulty,
    subject: preview?.subject ?? entry.name,
    senderName: 'PhishGuard Training',
    senderEmail: 'training@mail.securelab.test',
    bodyHtml: preview?.bodyHtml ?? `<p>${entry.overview}</p>`,
    redFlags: [entry.clue],
    landingMessage: entry.advice,
    aiGenerated: false,
  };
}


export function findCatalogExercise(subject: string, templateId?: string) {
  return trainingCatalog.find(entry =>
    templateId === `training-catalog-${entry.id}` ||
    subject === `Training exercise: ${entry.name}` ||
    subject === casePresentation(entry.id)?.subject);
}
