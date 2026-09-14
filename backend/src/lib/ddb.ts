import type { DdbClass, DdbCurrencies, DdbItem } from '@codex/shared'

/**
 * Reads characters and the party inventory from D&D Beyond's public character
 * service.
 *
 * Only the handful of fields the app shows are mapped out; a character response
 * is around 260 KB of which we keep a few hundred bytes. Everything here is
 * defensive — this is somebody else's undocumented API and it can change shape
 * without warning, so a missing field must degrade rather than throw.
 */

const BASE = 'https://character-service.dndbeyond.com/character/v5'

/**
 * Verified to change nothing for these characters today — 34 items either way.
 * Carried as insurance for homebrew items somebody adds later.
 */
const QUERY = '?includeCustomItems=true'

/** D&D Beyond can be slow; a player tapping sync should not wait forever. */
const TIMEOUT_MS = 15_000

/** Digits only, checked before either id is ever interpolated into a URL. */
export function isValidCharacterId(id: unknown): id is string {
  return typeof id === 'string' && /^\d{1,20}$/.test(id)
}

export class DdbError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface DdbCharacter {
  name: string
  race: string | null
  classes: DdbClass[]
  avatarUrl: string | null
  currencies: DdbCurrencies
  items: DdbItem[]
  /** The campaign this character belongs to, which is how the party is found. */
  campaign: { id: string; name: string | null } | null
}

export interface DdbParty {
  currencies: DdbCurrencies
  items: DdbItem[]
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function mapItem(raw: any): DdbItem | null {
  const definition = raw?.definition
  const name = str(definition?.name)
  if (!name) return null

  return {
    name,
    quantity: num(raw?.quantity) ?? 1,
    type: str(definition?.type),
    rarity: str(definition?.rarity),
    magic: Boolean(definition?.magic),
    equipped: Boolean(raw?.equipped),
    attuned: Boolean(raw?.isAttuned),
    weight: num(definition?.weight),
    cost: num(definition?.cost),
  }
}

function mapClass(raw: any): DdbClass | null {
  const name = str(raw?.definition?.name)
  if (!name) return null
  return {
    name,
    level: num(raw?.level) ?? 0,
    subclass: str(raw?.subclassDefinition?.name),
  }
}

/**
 * One request, one set of failure modes. Both endpoints answer in the same
 * `{ success, data }` envelope, so the handling belongs in one place.
 *
 * `subject` only shapes the error text — "character" or "party inventory".
 */
async function fetchDdb(path: string, subject: string): Promise<any> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}${QUERY}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    throw new DdbError(
      timedOut ? 504 : 502,
      timedOut ? 'D&D Beyond took too long to answer' : 'Could not reach D&D Beyond',
    )
  }

  if (res.status === 403 || res.status === 404) {
    throw new DdbError(404, `D&D Beyond would not return that ${subject}. It has to be public.`)
  }
  if (!res.ok) {
    throw new DdbError(502, `D&D Beyond returned ${res.status}`)
  }

  const body = (await res.json().catch(() => null)) as any
  if (!body?.success || !body?.data) {
    throw new DdbError(502, str(body?.message) ?? `D&D Beyond returned no ${subject} data`)
  }

  return body.data
}

function currencies(raw: any): DdbCurrencies {
  return {
    cp: num(raw?.cp) ?? 0,
    sp: num(raw?.sp) ?? 0,
    ep: num(raw?.ep) ?? 0,
    gp: num(raw?.gp) ?? 0,
    pp: num(raw?.pp) ?? 0,
  }
}

function items(raw: unknown): DdbItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map(mapItem)
    .filter((i): i is DdbItem => i !== null)
}

/** The campaign's shared purse and items. Party items share the character shape. */
export async function fetchPartyInventory(campaignId: string): Promise<DdbParty> {
  if (!isValidCharacterId(campaignId)) {
    throw new DdbError(400, 'That does not look like a D&D Beyond campaign id')
  }

  const data = await fetchDdb(`/party/inventory/${campaignId}`, 'party inventory')
  return { currencies: currencies(data.currency), items: items(data.partyItems) }
}

export async function fetchCharacter(characterId: string): Promise<DdbCharacter> {
  if (!isValidCharacterId(characterId)) {
    throw new DdbError(400, 'That does not look like a D&D Beyond character id')
  }

  const data = await fetchDdb(`/character/${characterId}`, 'character')
  const name = str(data.name)
  if (!name) throw new DdbError(502, 'D&D Beyond returned a character with no name')

  return {
    name,
    // fullName is the specific one — "Wood Elf" rather than "Elf".
    race: str(data.race?.fullName) ?? str(data.race?.baseName),
    classes: (Array.isArray(data.classes) ? data.classes : [])
      .map(mapClass)
      .filter((c: DdbClass | null): c is DdbClass => c !== null),
    avatarUrl: str(data.decorations?.avatarUrl),
    currencies: currencies(data.currencies),
    items: items(data.inventory),
    // The campaign id lives here, which is how a party sync finds the party
    // without anything being configured.
    campaign:
      data.campaign?.id != null
        ? { id: String(data.campaign.id), name: str(data.campaign.name) }
        : null,
  }
}

/**
 * The character's level, for the sheet. A multiclassed character's level is the
 * sum of their class levels.
 */
export function totalLevel(classes: DdbClass[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0)
}

/** "Paladin / Oath of the Ancients", or joined with + when multiclassed. */
export function describeClasses(classes: DdbClass[]): {
  className: string
  subclass: string
} {
  return {
    className: classes.map((c) => c.name).join(' / '),
    subclass: classes
      .map((c) => c.subclass)
      .filter((s): s is string => Boolean(s))
      .join(' / '),
  }
}
