import type { Address, Category, CategoryFilter, Destination, Network, RouteSegment } from './types'

const METERS_PER_MINUTE = 80
type Neighbor = { node: number; edge: number; meters: number }
type Visit = { node: number; meters: number }

export function createRouter(network: Network) {
  const neighbors: Neighbor[][] = network.nodes.map(() => [])
  network.edges.forEach(([start, end, meters], edge) => {
    neighbors[start].push({ node: end, edge, meters })
    neighbors[end].push({ node: start, edge, meters })
  })

  return function walkFrom(address: Address, maximumMinutes: number): Destination[] {
    const limit = maximumMinutes * METERS_PER_MINUTE
    const origin = address[2]
    const distances = new Float64Array(network.nodes.length).fill(Infinity)
    const previousNode = new Int32Array(network.nodes.length).fill(-1)
    const previousEdge = new Int32Array(network.nodes.length).fill(-1)
    distances[origin] = address[3]
    // The search is limited to a neighborhood. Bucketed integer distances avoid sorting a queue.
    const visits: Visit[][] = Array.from({ length: limit + 1 }, () => [])
    if (address[3] > limit) return []
    visits[address[3]].push({ node: origin, meters: address[3] })

    for (const bucket of visits) {
      for (const { node, meters } of bucket) {
        if (distances[node] !== meters) continue
        for (const next of neighbors[node]) {
          const cost = meters + next.meters
          if (cost > limit || cost >= distances[next.node]) continue
          distances[next.node] = cost
          previousNode[next.node] = node
          previousEdge[next.node] = next.edge
          visits[cost].push({ node: next.node, meters: cost })
        }
      }
    }

    return network.places.flatMap((place): Destination[] => {
      const meters = distances[place[3]] + place[4]
      if (meters > limit) return []
      const edges: number[] = []
      for (let node = place[3]; previousNode[node] !== -1; node = previousNode[node]) {
        edges.push(previousEdge[node])
      }
      return [{ place, minutes: Math.max(1, Math.ceil(meters / METERS_PER_MINUTE)), edges }]
    }).sort((a, b) => a.minutes - b.minutes || a.place[0].localeCompare(b.place[0]))
  }
}

export function filterDestinations(destinations: Destination[], category: CategoryFilter, minutes: number) {
  return destinations.filter(({ place, minutes: time }) =>
    time <= minutes && (category === 'all' || place[1] === category))
}

export function routeSegments(network: Network, address: Address, destinations: Destination[]): RouteSegment[] {
  if (!destinations.length) return []
  const categoriesByEdge = new Map<number, Set<Category>>()
  const categories = new Set<Category>()
  for (const { place, edges } of destinations) {
    categories.add(place[1])
    for (const edge of edges) {
      const existing = categoriesByEdge.get(edge) ?? new Set<Category>()
      existing.add(place[1])
      categoriesByEdge.set(edge, existing)
    }
  }

  function segmentCategory(values: Set<Category>): RouteSegment['category'] {
    return values.size > 1 ? 'shared' : [...values][0]
  }

  const segments = Array.from(categoriesByEdge, ([id, values]): RouteSegment => {
    const [start, end, , interior] = network.edges[id]
    return { category: segmentCategory(values), coordinates: [network.nodes[start], ...interior, network.nodes[end]] }
  })
  if (address[3] > 0) {
    segments.push({ category: segmentCategory(categories), coordinates: [address[1], network.nodes[address[2]]] })
  }
  for (const { place } of destinations) {
    if (place[4] > 0) segments.push({ category: place[1], coordinates: [network.nodes[place[3]], place[2]] })
  }
  return segments
}
