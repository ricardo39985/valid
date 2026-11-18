import type { Address, Network } from './routing/types'

async function readCompressed<T>(name: string): Promise<T> {
  const response = await fetch(new URL(`data/${name}.json.gz`, document.baseURI))
  if (!response.ok || !response.body) throw new Error(`Could not load ${name}`)
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).json() as Promise<T>
}

export async function loadCity() {
  const [addresses, network] = await Promise.all([
    readCompressed<Address[]>('addresses'), readCompressed<Network>('network'),
  ])
  for (const address of addresses) {
    address[0] = address[0].replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, number, ordinal) => number + ordinal.toLowerCase())
  }
  return { addresses, network }
}

export type City = Awaited<ReturnType<typeof loadCity>>

const suffixes: Record<string, string> = {
  street: 'st', avenue: 'ave', boulevard: 'blvd', road: 'rd',
  drive: 'dr', lane: 'ln', court: 'ct', place: 'pl', terrace: 'ter',
}

export function normalizeAddress(text: string) {
  return text.toLowerCase().replace(/,\s*san francisco.*$/, '')
    .replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
    .map(word => suffixes[word] ?? word).join(' ')
}

export function buildAddressIndex(addresses: Address[]) {
  return addresses.map(address => {
    const text = normalizeAddress(address[0] + ' ' + address[4])
    return { address, text, words: text.split(' ') }
  })
}

export function searchAddresses(index: ReturnType<typeof buildAddressIndex>, query: string) {
  const search = normalizeAddress(query)
  if (search.length < 2) return []
  const words = search.split(' ')
  const matches = []
  const looksLikeHouseNumber = /^\d+[a-z]?$/.test(words[0]) && words.length > 1
  for (const { address, text, words: parts } of index) {
    if (looksLikeHouseNumber && words[0] !== parts[0]) continue
    const matchesWords = words.every((word, index) => parts.some(part =>
      index === words.length - 1 ? part.startsWith(word) : part === word))
    if (matchesWords) {
      const rank = text.startsWith(search + ' ') ? 0 : text.startsWith(search) ? 1 : 2
      matches.push({ address, rank })
    }
  }
  return matches.sort((a, b) => a.rank - b.rank || a.address[0].localeCompare(b.address[0], 'en', { numeric: true }))
    .slice(0, 6).map(({ address }) => address)
}
