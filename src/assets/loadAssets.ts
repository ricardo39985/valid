import type { FeatureCollection, Point } from 'geojson'
import type { Address, Network } from '../routing/types'
import { fetchPackedJson } from './packedJson'
import { buildAddressIndex } from '../data'
import regionUrl from './region.pack?url'
import addressesUrl from './addresses.pack?url'
import networkUrl from './network.pack?url'
import basemapUrl from './basemap.pack?url'

async function loadAddressBook() {
  const addresses = await fetchPackedJson<Address[]>(addressesUrl)
  const index: ReturnType<typeof buildAddressIndex> = []
  // Yield between batches so typing, camera motion and closing the tour can paint.
  for (let start = 0; start < addresses.length; start += 4096) {
    const batch = addresses.slice(start, start + 4096)
    for (const address of batch) {
      address[0] = address[0].replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, number, ordinal) => number + ordinal.toLowerCase())
    }
    index.push(...buildAddressIndex(batch))
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  return { addresses, index }
}

export async function loadCity() {
  const [book, network] = await Promise.all([
    loadAddressBook(), fetchPackedJson<Network>(networkUrl),
  ])
  return { ...book, network }
}

export type City = Awaited<ReturnType<typeof loadCity>>
export type Basemap = {
  areas: FeatureCollection
  streets: FeatureCollection
  labels: FeatureCollection<Point, { name: string; major: boolean; angle: number }>
}

export function loadBasemap() {
  return fetchPackedJson<Basemap>(basemapUrl)
}

export function loadRegion() {
  return fetchPackedJson<FeatureCollection>(regionUrl)
}
