import type { Address } from './routing/types'

const addressOrder = new Intl.Collator('en', { numeric: true })

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
  return matches.sort((a, b) => a.rank - b.rank || addressOrder.compare(a.address[0], b.address[0]))
    .slice(0, 6).map(({ address }) => address)
}
