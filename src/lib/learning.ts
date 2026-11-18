export type Question = { question: string; options: string[]; answer: number; explanation: string }
export function questionsFor(title: string, phase: 'baseline' | 'followup'): Question[] {
 const common: Question = phase === 'baseline' ? {
  question: 'An unexpected email asks you to act immediately. What should you do first?',
  options: ['Use its link to avoid the deadline', 'Verify through a known, independent channel', 'Reply with your account details'], answer: 1,
  explanation: 'Urgency is not evidence of authenticity. Use a trusted channel you already know.'
 } : {
  question: 'A convincing message says your account closes in ten minutes. What is the safest response?',
  options: ['Open the known service directly and verify the request', 'Trust it because the logo is familiar', 'Forward it to colleagues and ask them to click'], answer: 0,
  explanation: 'Navigate independently instead of using a message-supplied link.'
 };
 let specific: Question;
 if (/Reporting/.test(title)) specific = phase === 'baseline' ? { question: 'You suspect a phishing email but are unsure. What helps the security team?', options: ['Delete it silently', 'Forward it to every colleague', 'Use the approved reporting channel'], answer: 2, explanation: 'Reporting enables investigation and protection for others, even when you are unsure.' } : { question: 'You clicked a suspicious link. What should happen next?', options: ['Keep quiet', 'Report promptly and describe what happened without sending secrets', 'Test the link with another account'], answer: 1, explanation: 'Prompt reporting helps containment. A mistake is an opportunity to respond, not a reason for silence.' };
 else if (/Executive/.test(title)) specific = phase === 'baseline' ? { question: 'A CEO asks for an urgent confidential payment to new bank details. What is missing?', options: ['Independent verification and normal approval', 'A more professional signature', 'A faster transfer'], answer: 0, explanation: 'Authority and secrecy do not replace financial verification.' } : { question: 'A vendor sends changed payment details from a familiar-looking address. What should you do?', options: ['Approve because it looks familiar', 'Call a previously verified contact using a known number', 'Call the number in the message'], answer: 1, explanation: 'Verify payment changes using contact information obtained independently.' };
 else if (/Link/.test(title)) specific = phase === 'baseline' ? { question: 'A link label says “Company Portal”. What does that prove?', options: ['The destination is trusted', 'The page is safe if it uses HTTPS', 'Neither the destination nor its legitimacy'], answer: 2, explanation: 'A label can conceal a different destination, and HTTPS alone does not establish legitimacy.' } : { question: 'Which action avoids relying on a disguised email link?', options: ['Open a saved, verified bookmark', 'Use the link if it has a padlock', 'Use the link if the button is green'], answer: 0, explanation: 'A verified bookmark avoids the message-supplied destination.' };
 else specific = phase === 'baseline' ? { question: 'Which is a useful warning sign?', options: ['A familiar display name', 'A request to bypass normal checks under time pressure', 'An email arriving during work hours'], answer: 1, explanation: 'Unexpected requests to bypass procedures deserve independent verification.' } : { question: 'A message uses the right name and logo but asks for an unusual action. What matters most?', options: ['The logo quality', 'Whether the sender sounds senior', 'Whether the request can be independently verified'], answer: 2, explanation: 'Personalization and branding can be copied. Verify unusual requests.' };
 const applied: Question = phase === 'baseline' ? {
  question: 'What should you include when reporting a suspicious message?',
  options: ['A short description and the original message through the approved process', 'Your login details so someone can reproduce it', 'A guess about who sent it as a confirmed fact'],
  answer: 0,
  explanation: 'Give the review team the original context and describe what you observed without sharing secrets.'
 } : {
  question: 'A colleague says they entered their password into a page reached from a suspicious message. What is the next step?',
  options: ['Wait until unauthorized activity appears', 'Ask them to send you the password to check it', 'Report the exposure and change the password through the official service'],
  answer: 2,
  explanation: 'Report quickly and follow your organization’s account recovery process through trusted channels.'
 };
 return [common, specific, applied];
}
export function recommendModule(category: string, titles: string[]) {
 const preferred = /CEO|Executive|Invoice|BEC/i.test(category) ? 'Executive Impersonation & BEC' : /Credential|Password/i.test(category) ? 'Safe Link Hygiene' : 'Urgency & Pressure Tactics';
 return titles.includes(preferred) ? preferred : titles[0];
}
