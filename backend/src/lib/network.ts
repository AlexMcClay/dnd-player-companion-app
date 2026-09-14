import { networkInterfaces } from 'node:os'

/**
 * Ranks a private IPv4 by how likely it is to be the address a phone on the
 * same wifi can reach. Docker and WSL hand out 172.16–172.31 addresses that
 * look private but route nowhere useful, so they come last.
 */
function rank(address: string): number {
  if (address.startsWith('192.168.')) return 0
  if (address.startsWith('10.')) return 1
  return 2
}

/**
 * This machine's LAN address, for handing out URLs that work off-device.
 *
 * `localhost` in an image URL is fine until someone opens the app on their
 * phone, at which point it points the phone at itself.
 */
export function lanAddress(): string | null {
  const candidates: string[] = []

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      // Node <18.4 reported `family` as a string, newer versions as a number.
      const isIpv4 = address.family === 'IPv4' || (address.family as unknown as number) === 4
      if (isIpv4 && !address.internal) candidates.push(address.address)
    }
  }

  candidates.sort((a, b) => rank(a) - rank(b))
  return candidates[0] ?? null
}
