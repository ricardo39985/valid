import type { Coordinate, Network } from './types'

export function perpendicularApproach(network: Network, point: Coordinate, edgeIds: number[]) {
  const longitudeScale = Math.cos(point[1] * Math.PI / 180)
  let best: Coordinate | undefined
  let nearest = Infinity
  for (const id of edgeIds) {
    const [a, b, , shape] = network.edges[id]
    const street = [network.nodes[a], ...shape, network.nodes[b]]
    for (let i = 1; i < street.length; i++) {
      const [x, y] = street[i - 1]
      const dx = (street[i][0] - x) * longitudeScale
      const dy = street[i][1] - y
      const length = dx * dx + dy * dy
      if (!length) continue
      const ratio = ((point[0] - x) * longitudeScale * dx + (point[1] - y) * dy) / length
      // A projection beyond the street segment would invent geometry.
      if (ratio < 0 || ratio > 1) continue
      const projection: Coordinate = [x + ratio * (street[i][0] - x), y + ratio * dy]
      const distance = Math.hypot((point[0] - projection[0]) * longitudeScale, point[1] - projection[1])
      if (distance < nearest) { best = projection; nearest = distance }
    }
  }
  return best && nearest > 0 ? [best, point] : undefined
}
