import type { Prisma } from '@prisma/client'

const day = (n: number, hourOffset = 0, minOffset = 0) =>
  new Date(Date.now() - n * 24 * 3600 * 1000 + hourOffset * 3600 * 1000 + minOffset * 60 * 1000)

const J = (arr: string[]) => JSON.stringify(arr)

function emailShell(headerColor: string, headerTitle: string, inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:${headerColor};padding:14px 20px;color:#ffffff;border-radius:8px 8px 0 0;">
    <div style="font-size:17px;font-weight:bold;">${headerTitle}</div>
  </div>
  <div style="padding:22px 24px;border:1px solid #d8d8d8;border-top:none;border-radius:0 0 8px 8px;background:#ffffff;color:#2b2b2b;font-size:14px;line-height:1.55;">
    ${inner}
  </div>
  <div style="margin-top:10px;font-size:11px;color:#999;text-align:center;">SIMULATION · controlled test environment. No real credentials are collected.</div>
</div>`
}

const btn = (label: string) =>
  `<a href="#" data-simulated="link" style="display:inline-block;background:#c0392b;color:#ffffff;padding:11px 26px;text-decoration:none;border-radius:5px;font-weight:bold;">${label}</a>`

export async function installOriginalTemplates(db: Prisma.TransactionClient) {
  const installTemplate = async ({data}: {data: Prisma.TemplateCreateInput}) => {
    const legacyName = data.name.replaceAll(' · ', ' — ')
    const existing = await db.template.findFirst({ where: { name: { in: [data.name, legacyName] } } })
    if (existing) return existing
    return db.template.create({ data })
  }
  // ---------------- Templates ----------------
  const tPassword = await installTemplate({
    data: {
      name: 'Password Expiry Alert',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'easy',
      subject: 'Action required: your password expires today',
      senderName: 'Microsoft 365 Security',
      senderEmail: 'security@mail.securelab.test',
      landingMessage:
        'You clicked a simulated credential-harvesting link. Real attacks like this lead to a fake sign-in page that steals your password. Always reach login portals by typing the known address yourself or using your company SSO bookmark.',
      redFlags: J([
        'Urgent deadline pressure ("expires today")',
        'Generic greeting · no personalization',
        'Sender domain is look-alike, not your real tenant domain',
        'Button leads to a non-SSO page asking for credentials',
      ]),
      bodyHtml: emailShell(
        '#2b5797',
        'Microsoft 365',
        `<p>Dear User,</p>
        <p>Your password will <b>expire within 24 hours</b>. To avoid losing access to your work email and files, you must renew it now.</p>
        <p style="margin:22px 0;">${btn('Renew password now')}</p>
        <p>If you do not act today, your account will be <b>locked automatically</b>.</p>
        <p>IT Service Desk<br/>AcmeCorp</p>`
      ),
      isBuiltIn: true,
      createdAt: day(55),
    },
  })

  const tInvoice = await installTemplate({
    data: {
      name: 'Overdue Invoice Payment',
      category: 'Invoice Fraud',
      difficulty: 'easy',
      subject: 'Invoice #4471 · payment overdue, final notice',
      senderName: 'BrightPath Billing',
      senderEmail: 'accounts@billing.acme-vendor.test',
      landingMessage:
        'This simulated invoice scam is a classic payment-fraud attempt. Fraudsters impersonate vendors with overdue notices and changed bank details. Always verify payment changes through a known contact · never using details inside the email.',
      redFlags: J([
        'Threatening "final notice" language',
        'Bank details changed in the email body',
        'Vendor domain not in your approved vendor list',
        'Pressure to act before month-end close',
      ]),
      bodyHtml: emailShell(
        '#6d4c9f',
        'BrightPath Solutions · Accounts',
        `<p>Hello,</p>
        <p>Our records show invoice <b>#4471 ($2,480.00)</b> is now <b>14 days overdue</b>. This is our final notice before the account is escalated to collections.</p>
        <p><b>Note:</b> our bank details changed this month · please use the updated account in the attached remittance advice.</p>
        <p style="margin:22px 0;">${btn('Review invoice & pay')}</p>
        <p>Kind regards,<br/>Accounts Receivable</p>`
      ),
      isBuiltIn: true,
      createdAt: day(50),
    },
  })

  const tPayroll = await installTemplate({
    data: {
      name: 'Payroll Verification Request',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'medium',
      subject: 'Payroll profile verification required · salary on hold',
      senderName: 'AcmeCorp HR Operations',
      senderEmail: 'hr-alerts@notifications.acme-corp.test',
      landingMessage:
        'You clicked a simulated payroll-verification phish. Notice the manufactured consequence ("salary on hold") · attackers pair urgency with a financial stake. HR never verifies identity through links in email. When in doubt, open the HR portal from your bookmark.',
      redFlags: J([
        'Salary suspension threat creates fear',
        "Sender domain 'notifications.acme-corp.test' is not the real HR domain",
        'No employee ID or ticket reference',
        'Link does not match the official HR portal URL',
      ]),
      bodyHtml: emailShell(
        '#00838f',
        'AcmeCorp HR Portal',
        `<p>Dear Employee,</p>
        <p>Our records indicate your payroll profile requires <b>immediate verification</b> for deposits to continue without interruption.</p>
        <p style="margin:22px 0;">${btn('Verify payroll account')}</p>
        <p>This link expires in <b>24 hours</b>. Unverified profiles will have the next salary run <b>suspended</b>.</p>
        <p>HR Operations Team<br/>AcmeCorp</p>`
      ),
      isBuiltIn: true,
      createdAt: day(40),
    },
  })

  const tLayoff = await installTemplate({
    data: {
      name: 'Confidential Org Changes',
      category: 'Curiosity / Confidential Data',
      difficulty: 'hard',
      subject: 'RE: Confidential · Q4 org changes & affected roles',
      senderName: 'Grace Wanjiru (HR)',
      senderEmail: 'grace.wanjiru@hr-benefits.acme-corp.test',
      landingMessage:
        'Curiosity is one of the most exploited emotions in phishing. A "confidential" attachment about layoffs is bait engineered to bypass your judgment. Confirm sensitive HR communications through an internal, verified channel · and never open unexpected attachments.',
      redFlags: J([
        'Exploits curiosity and anxiety about layoffs',
        'Reply-to domain differs from the real internal HR domain',
        'Unexpected attachment with a double extension',
        'Thread-like "RE:" subject with no original email',
      ]),
      bodyHtml: emailShell(
        '#455a64',
        'HR · Confidential Correspondence',
        `<p>Hi,</p>
        <p>As discussed in the leadership call, the preliminary <b>Q4 org changes</b> are below. This list is not public · please keep it confidential until comms goes out.</p>
        <p style="margin:22px 0;">${btn('Open confidential document')}</p>
        <p>Please do not forward this message.</p>
        <p>Grace<br/>People Operations</p>`
      ),
      isBuiltIn: true,
      createdAt: day(35),
    },
  })

  const tPackage = await installTemplate({
    data: {
      name: 'Failed Delivery Notification',
      category: 'Consumer Scam',
      difficulty: 'easy',
      subject: 'Your package could not be delivered · reschedule now',
      senderName: 'ExpressParcel',
      senderEmail: 'notice@mail.securelab.test',
      landingMessage:
        'Delivery-scam phishes exploit the expectation of an incoming parcel. The "small redelivery fee" is where real attackers harvest card details. Check the carrier app or website directly instead of clicking email links.',
      redFlags: J([
        'You were not expecting a parcel at work',
        'Requests a small "redelivery fee" (card harvesting)',
        'Carrier branding but mismatched sender domain',
        'Artificial deadline to reschedule',
      ]),
      bodyHtml: emailShell(
        '#d84315',
        'ExpressParcel · Delivery Notice',
        `<p>Notification for: Employee,</p>
        <p>We attempted delivery of parcel <b>EX-8842190</b> today, but nobody was available. Your parcel is held at the local depot.</p>
        <p>A <b>$1.99 redelivery fee</b> applies to reschedule.</p>
        <p style="margin:22px 0;">${btn('Reschedule delivery')}</p>
        <p>Thank you,<br/>ExpressParcel Team</p>`
      ),
      isBuiltIn: true,
      createdAt: day(30),
    },
  })

  const tWire = await installTemplate({
    data: {
      name: 'Urgent Executive Wire Transfer',
      category: 'CEO Fraud / BEC',
      difficulty: 'hard',
      subject: 'Re: urgent · confidential acquisition payment',
      senderName: 'Daniel Osei, CEO',
      senderEmail: 'd.osei.ceo@notifications.acme-corp.test',
      landingMessage:
        'Executive impersonation (BEC) causes the largest financial losses of any phishing type. Real CEOs do not request secret wire transfers over email. Verify any payment request via a live call to a known number · even if the message appears to come from leadership.',
      redFlags: J([
        'Authority pressure from "the CEO"',
        'Requests secrecy ("keep this between us")',
        'Look-alike sender domain',
        'Unusual payment channel outside normal finance process',
      ]),
      bodyHtml: emailShell(
        '#37474f',
        'Executive Office',
        `<p>I'm boarding a flight · short on time.</p>
        <p>We are closing a confidential acquisition. I need Finance to initiate a <b>$48,000 wire</b> to the escrow account I forwarded earlier. <b>Keep this between us</b> until the announcement.</p>
        <p style="margin:22px 0;">${btn('Open payment instructions')}</p>
        <p>– Daniel</p>`
      ),
      isBuiltIn: true,
      createdAt: day(25),
    },
  })

  const tEsign = await installTemplate({
    data: {
      name: 'AI Studio · E-Signature Request',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'hard',
      subject: 'eSign: "Offer Letter · Senior Analyst role" awaits your signature',
      senderName: 'NexumTech People Team via SignFlow',
      senderEmail: 'signflow-noreply@notifications.acme-corp.test',
      landingMessage:
        'AI-crafted hard-difficulty lure: it references a plausible internal process and a real-looking document portal. The tells are subtle · the portal domain is not the approved vendor domain, and the message creates curiosity pressure with an attachment-like button. Verify signing requests in the HR system directly.',
      redFlags: J([
        'Very subtle: sender domain differs from the approved vendor list',
        'Curiosity pressure · a confidential "offer letter" you were not expecting',
        'Login required before viewing the document (classic harvest pattern)',
        'No internal ticket or reference number',
      ]),
      bodyHtml: emailShell(
        '#4a148c',
        'SignFlow · Document Portal',
        `<p>Hi,</p>
        <p><b>"Offer Letter · Senior Analyst (Fin-2025-118)"</b> is waiting for your e-signature. The document will be archived after 72 hours.</p>
        <p style="margin:22px 0;">${btn('Review &amp; sign document')}</p>
        <p>You may be asked to sign in with your work account to view the document.</p>
        <p>SignFlow for NexumTech · People Team</p>`
      ),
      isBuiltIn: false,
      aiGenerated: true,
      createdAt: day(3),
    },
  })

  return { tPassword, tInvoice, tPayroll, tLayoff }
}
