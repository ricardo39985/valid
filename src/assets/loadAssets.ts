import type { FeatureCollection, Point } from 'geojson'
import type { Address, Network } from '../routing/types'
import { fetchPackedJson } from './packedJson'
import addressesUrl from './addresses.pack?url'
import networkUrl from './network.pack?url'
import basemapUrl from './basemap.pack?url'

export async function loadCity() {
  const [addresses, network] = await Promise.all([
    fetchPackedJson<Address[]>(addressesUrl),
    fetchPackedJson<Network>(networkUrl),
  ])
  for (const address of addresses) {
    address[0] = address[0].replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, number, ordinal) => number + ordinal.toLowerCase())
  }
  return { addresses, network }
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
