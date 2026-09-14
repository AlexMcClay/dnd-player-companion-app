/**
 * Loads the D&D 5e SRD base equipment into the item repository.
 *
 * Unlike `db:seed`, this **never deletes anything**. It adds items that are not
 * already there and leaves everything else alone, so it is safe to run against a
 * campaign that already has real data in it. Run it again after a refresh of the
 * data file to pick up anything new.
 *
 * Source and licence: see data/SRD-ATTRIBUTION.md.
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()

interface SrdItem {
  name: string
  summary: string | null
  bodyMd: string | null
  tags: string[]
  data: Record<string, string>
}

const here = dirname(fileURLToPath(import.meta.url))
const items: SrdItem[] = JSON.parse(
  readFileSync(join(here, 'data', 'srd-equipment.json'), 'utf8'),
)

async function main() {
  const replace = process.argv.includes('--replace')

  // One query rather than 237: names are what we match on, and the repository
  // is small enough to hold in memory.
  const existing = await prisma.entity.findMany({
    where: { type: 'item' },
    select: { id: true, name: true },
  })
  const idByName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]))

  const toCreate: Prisma.EntityCreateManyInput[] = []
  let updated = 0
  let skipped = 0

  for (const item of items) {
    const id = idByName.get(item.name.toLowerCase())

    const fields = {
      summary: item.summary,
      bodyMd: item.bodyMd,
      data: item.data as Prisma.InputJsonValue,
      tags: item.tags,
    }

    if (!id) {
      // Base equipment is common knowledge — nobody has to discover a backpack.
      toCreate.push({ type: 'item', name: item.name, knowledge: 'known', ...fields })
    } else if (replace) {
      await prisma.entity.update({ where: { id }, data: fields })
      updated++
    } else {
      skipped++
    }
  }

  if (toCreate.length) await prisma.entity.createMany({ data: toCreate })

  console.log(`SRD equipment: ${toCreate.length} added, ${updated} updated, ${skipped} left alone`)
  if (skipped && !replace) {
    console.log('  (pass --replace to overwrite items that already exist by name)')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
