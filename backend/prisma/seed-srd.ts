/**
 * Loads the D&D 5e SRD equipment and magic items into the item repository.
 *
 * Unlike `db:seed`, this **never deletes anything**. It adds items that are not
 * already there and leaves everything else alone, so it is safe to run against a
 * campaign that already has real data in it.
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

interface Source {
  file: string
  label: string
  /**
   * Mundane gear is common knowledge — nobody has to discover a backpack.
   * Magic items arrive sealed: the repository is not a catalogue for players to
   * shop from, and what exists in the world is the DM's to reveal. Unseal one
   * by setting it to rumoured or known when the party finds it.
   */
  knowledge: 'known' | 'unknown'
}

const SOURCES: Source[] = [
  { file: 'srd-equipment.json', label: 'equipment', knowledge: 'known' },
  { file: 'srd-magic-items.json', label: 'magic items', knowledge: 'unknown' },
]

const here = dirname(fileURLToPath(import.meta.url))

function load(file: string): SrdItem[] {
  return JSON.parse(readFileSync(join(here, 'data', file), 'utf8'))
}

async function main() {
  const replace = process.argv.includes('--replace')

  // One query rather than 600: names are what we match on, and the repository
  // is small enough to hold in memory.
  const existing = await prisma.entity.findMany({
    where: { type: 'item' },
    select: { id: true, name: true },
  })
  const idByName = new Map(existing.map((e) => [e.name.toLowerCase(), e.id]))

  for (const source of SOURCES) {
    const items = load(source.file)
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
        toCreate.push({ type: 'item', name: item.name, knowledge: source.knowledge, ...fields })
        // Guards against a name appearing in both files.
        idByName.set(item.name.toLowerCase(), 'pending')
      } else if (replace) {
        // Deliberately does not touch `knowledge`: re-running must not re-seal
        // a magic item the party has already found.
        await prisma.entity.update({ where: { id }, data: fields })
        updated++
      } else {
        skipped++
      }
    }

    if (toCreate.length) await prisma.entity.createMany({ data: toCreate })

    console.log(
      `${source.label.padEnd(12)} ${String(toCreate.length).padStart(3)} added` +
        `, ${updated} updated, ${skipped} left alone` +
        (toCreate.length ? `  (as ${source.knowledge})` : ''),
    )
  }

  if (!replace) console.log('\npass --replace to refresh items that already exist by name')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
