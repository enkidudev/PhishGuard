import { db } from '@/lib/db'

export interface AuthzParticipant {
  id: string
  name: string
  consented: boolean
  active: boolean
  email?: string
}

/**
 * Pre-flight authorization checks for launching a phishing simulation.
 * Returns a list of human-readable violations; an empty list means the
 * campaign may proceed. The platform never collects credentials and never
 * sends real email — participants must nonetheless have granted explicit
 * consent and the sender domain must be on the approved allowlist.
 */
export async function checkCampaignAuthorization(opts: {
  senderEmail: string
  participants: AuthzParticipant[]
}): Promise<string[]> {
  const violations: string[] = []

  const approvedDomains = new Set((await db.allowedDomain.findMany()).map(d => d.domain))
  for (const participant of opts.participants) {
    if (participant.email && !approvedDomains.has(participant.email.split('@').pop()!.toLowerCase())) violations.push(`Participant domain is not approved for ${participant.name}`)
    if (!participant.consented) {
      violations.push(
        `Participant "${participant.name}" has not granted consent for simulation participation`
      )
    }
    if (!participant.active) {
      violations.push(`Participant "${participant.name}" is deactivated`)
    }
  }

  const domain = opts.senderEmail.includes('@')
    ? opts.senderEmail.slice(opts.senderEmail.lastIndexOf('@') + 1).trim().toLowerCase()
    : ''
  const approved = domain ? await db.allowedDomain.findUnique({ where: { domain } }) : null
  if (!approved) {
    violations.push(
      `Sender domain "${domain}" is not approved — add it to the domain allowlist first`
    )
  }

  return violations
}
