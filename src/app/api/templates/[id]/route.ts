import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { parseJsonArray } from '@/lib/events'
import {
  asRecord,
  asString,
  asStringArray,
  serializeTemplate,
  templateFieldsToData,
  validateTemplateFields,
  type TemplateFields,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.template.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (await db.campaign.count({ where: { templateId: id, status: { not: 'draft' } } })) return NextResponse.json({ error: 'This template belongs to a launched campaign. Create a copy to preserve campaign evidence.' }, { status: 409 })
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Merge provided fields over the existing template, then re-validate everything.
    const redFlags =
      body.redFlags === undefined
        ? parseJsonArray(existing.redFlags)
        : (asStringArray(body.redFlags) ?? []).filter((flag) => flag.trim().length > 0)

    const fields: TemplateFields = {
      name: asString(body.name) ?? existing.name,
      category: asString(body.category) ?? existing.category,
      difficulty: asString(body.difficulty) ?? existing.difficulty,
      subject: asString(body.subject) ?? existing.subject,
      senderName: asString(body.senderName) ?? existing.senderName,
      senderEmail: asString(body.senderEmail) ?? existing.senderEmail,
      bodyHtml: asString(body.bodyHtml) ?? existing.bodyHtml,
      landingMessage: asString(body.landingMessage) ?? existing.landingMessage,
      redFlags,
    }

    const validationError = validateTemplateFields(fields)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const updated = await db.template.update({
      where: { id },
      data: templateFieldsToData(fields),
    })

    await logAudit('TEMPLATE_UPDATED', ADMIN_ACTOR, `Template "${updated.name}" updated`)

    const usageCount = await db.campaign.count({ where: { templateId: id } })
    return NextResponse.json({ template: serializeTemplate(updated, usageCount) })
  } catch (error) {
    console.error('PATCH /api/templates/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const template = await db.template.findUnique({
      where: { id },
      include: { _count: { select: { campaigns: true } } },
    })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    if (template._count.campaigns > 0) {
      return NextResponse.json(
        {
          error: `Template is used by ${template._count.campaigns} campaign(s) and cannot be deleted`,
        },
        { status: 400 }
      )
    }
    await db.template.delete({ where: { id } })
    await logAudit('TEMPLATE_DELETED', ADMIN_ACTOR, `Template "${template.name}" deleted`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/templates/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
