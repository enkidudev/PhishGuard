import { ensureInteractiveCatalog } from '@/lib/ensure-catalog'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import {
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  serializeTemplate,
  templateFieldsToData,
  validateTemplateFields,
  type TemplateFields,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureInteractiveCatalog()
    const [templates, usageGroups] = await Promise.all([
      db.template.findMany(),
      db.campaign.groupBy({ by: ['templateId'], _count: { templateId: true } }),
    ])
    const usage = new Map(usageGroups.map((group) => [group.templateId, group._count.templateId]))
    const list = templates
      .map((template) => serializeTemplate(template, usage.get(template.id) ?? 0))
      .sort((a, b) => {
        // Built-ins first, then oldest first.
        if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? -1 : 1
        return a.createdAt.localeCompare(b.createdAt)
      })
    return NextResponse.json({ templates: list })
  } catch (error) {
    console.error('GET /api/templates failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const fields: TemplateFields = {
      name: asString(body.name) ?? '',
      category: asString(body.category) ?? '',
      difficulty: asString(body.difficulty) ?? '',
      subject: asString(body.subject) ?? '',
      senderName: asString(body.senderName) ?? '',
      senderEmail: asString(body.senderEmail) ?? '',
      bodyHtml: asString(body.bodyHtml) ?? '',
      landingMessage: asString(body.landingMessage) ?? '',
      redFlags: (asStringArray(body.redFlags) ?? []).filter((flag) => flag.trim().length > 0),
    }

    const validationError = validateTemplateFields(fields)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const aiGenerated = asBoolean(body.aiGenerated) ?? false

    const created = await db.template.create({
      data: { ...templateFieldsToData(fields), isBuiltIn: false, aiGenerated },
    })

    await logAudit('TEMPLATE_CREATED', ADMIN_ACTOR, `Template "${created.name}" created`)

    return NextResponse.json({ template: serializeTemplate(created, 0) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/templates failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
