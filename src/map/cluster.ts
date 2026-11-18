import type { Destination } from '../routing/types'

type Point = { x: number; y: number }
export type PinGroup = { members: Destination[]; point: Point }

export function clusterPins(destinations: Destination[], project: (item: Destination) => Point) {
  const groups: PinGroup[] = []
  for (const destination of destinations) {
    const point = project(destination)
    const nearby = groups.find(group => Math.hypot(group.point.x - point.x, group.point.y - point.y) < 36)
    if (nearby) nearby.members.push(destination)
    else groups.push({ members: [destination], point })
  }
  return groups
}
