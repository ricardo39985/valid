import type { FeatureCollection, Point } from 'geojson'
import type { Address, Network } from '../routing/types'
import { fetchPackedJson } from './packedJson'
import { buildAddressIndex } from '../data'
import regionUrl from './region.pack?url'
import addressesUrl from './addresses.pack?url'
import networkUrl from './network.pack?url'
import basemapUrl from './basemap.pack?url'

async function loadAddressBook(signal?: AbortSignal) {
  const addresses = await fetchPackedJson<Address[]>(addressesUrl, signal)
  const index: ReturnType<typeof buildAddressIndex> = []
  // The main-thread fallback yields between batches so the splash can paint.
  for (let start = 0; start < addresses.length; start += 4096) {
    signal?.throwIfAborted()
    const batch = addresses.slice(start, start + 4096)
    for (const address of batch) {
      address[0] = address[0].replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, number, ordinal) => number + ordinal.toLowerCase())
    }
    index.push(...buildAddressIndex(batch))
    if (signal) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return { addresses, index }
}

export async function loadCity(signal?: AbortSignal) {
  const [book, network] = await Promise.all([
    loadAddressBook(signal), fetchPackedJson<Network>(networkUrl, signal),
  ])
  return { ...book, network }
}

export type City = Awaited<ReturnType<typeof loadCity>>
export type Basemap = {
  areas: FeatureCollection
  streets: FeatureCollection
  labels: FeatureCollection<Point, { name: string; major: boolean; angle: number }>
}

export function loadBasemap(signal?: AbortSignal) {
  return fetchPackedJson<Basemap>(basemapUrl, signal)
}

export function loadRegion(signal?: AbortSignal) {
  return fetchPackedJson<FeatureCollection>(regionUrl, signal)
}
