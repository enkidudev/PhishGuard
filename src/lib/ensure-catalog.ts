import { Prisma } from '@prisma/client'
import { db } from './db'
import { installCatalog } from './install-catalog'

const key = 'interactiveCatalogV2'

export async function ensureInteractiveCatalog() {
  if (await db.setting.findUnique({ where: { key } })) return
  try {
    await db.$transaction(async tx => {
      // The unique marker serializes installs across server instances. It commits only when the catalog does.
      await tx.setting.create({ data: { key, value: '1' } })
      await installCatalog(tx)
    }, { timeout: 20000 })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' && await db.setting.findUnique({ where: { key } }))) throw error
  }
}
