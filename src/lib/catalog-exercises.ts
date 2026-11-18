type Exercise =
  | { kind: 'choice'; heading: string; action: string; details: string[]; label: string; options: string[] }
  | { kind: 'checklist'; heading: string; action: string; details: string[]; checks: string[] }
  | { kind: 'download'; heading: string; action: string; details: string[]; filename: string }
  | { kind: 'recovery'; heading: string; action: string; details: string[]; prompt: string; fictionalAnswer: string }
  | { kind: 'review'; heading: string; action: string; details: string[]; reveal: string; evidence: string };

export const catalogExercises: Record<string, Exercise> = {
  lottery: {
    kind: 'review', heading: 'Prize claim receipt', action: 'Simulate proceeding with the claim',
    details: ['Draw entry: no record', 'Processing fee: required'],
    reveal: 'Inspect fee policy', evidence: 'The requester wants an advance fee before confirming eligibility. This exercise cannot move money.',
  },
  holiday: {
    kind: 'choice', heading: 'Travel reservation calendar', action: 'Simulate confirming the booking',
    details: ['Reservation status: unverified', 'Booking source: unexpected award notice'],
    label: 'Select a fictional departure', options: ['June 12', 'June 19', 'July 3'],
  },
  coworker: {
    kind: 'choice', heading: 'Workplace chat request', action: 'Simulate switching channels',
    details: ['Display name: Example colleague', 'Requested channel: personal messaging'],
    label: 'Choose a dummy channel destination', options: ['Example personal chat', 'Example private group'],
  },
  invoice: {
    kind: 'checklist', heading: 'Supplier change approval', action: 'Simulate approving the change',
    details: ['Supplier record: Example vendor', 'Change requested: a new payment destination'],
    checks: ['I reviewed the fictional supplier record', 'I acknowledge the payment destination changed'],
  },
  document: {
    kind: 'download', heading: 'Unexpected shared-file attachment', action: 'Download practice attachment',
    details: ['Share: unexpected access to an example document', 'File type: plain text'], filename: 'demo.txt',
  },
  'payroll-file': {
    kind: 'download', heading: 'Unplanned payroll file share', action: 'Download practice payroll attachment',
    details: ['Share: example payroll worksheet', 'Payload: harmless plain text without payroll data'], filename: 'demo.txt',
  },
  account: {
    kind: 'choice', heading: 'Practice sign-in screen', action: 'Simulate signing in',
    details: ['Fictional account picker', 'This screen does not accept passwords'],
    label: 'Select a practice identity', options: ['Demo learner', 'Demo reviewer'],
  },
  'qr-notice': {
    kind: 'review', heading: 'QR destination inspection', action: 'Simulate opening the destination',
    details: ['Source: fictional office notice', 'Destination: hidden until inspected'],
    reveal: 'Preview decoded destination', evidence: 'Example destination: office-check.example. It is displayed as text and cannot be opened from this exercise.',
  },
  'meeting-change': {
    kind: 'choice', heading: 'Calendar update', action: 'Apply simulated RSVP',
    details: ['Original organizer: Example Operations', 'Update organizer: unrecognized'],
    label: 'Choose a practice RSVP', options: ['Accept updated time', 'Tentatively accept updated time'],
  },
  'app-access': {
    kind: 'checklist', heading: 'Permissions consent screen', action: 'Simulate granting permissions',
    details: ['App purpose: view a team calendar', 'Requested access: read files and manage shared resources'],
    checks: ['I reviewed the read permission', 'I reviewed the manage permission'],
  },
  recovery: {
    kind: 'recovery', heading: 'Account recovery practice', action: 'Submit practice recovery answer',
    details: ['Support case: fictional', 'Use only the answer on the case card below'],
    prompt: 'What was the demo account’s assigned practice team?', fictionalAnswer: 'Lunar Robotics',
  },
};
