import * as L from 'leaflet'
import type { RouteSegment } from '../routing/types'
import { categories, sharedColor } from '../ui/categories'
import { prefersReducedMotion, settle } from './motion'

type Routes = { group: L.LayerGroup; paths: L.Polyline[] }

export function addRoutes(map: L.Map, segments: RouteSegment[]): Routes {
  const lines = new Map<RouteSegment['category'], L.LatLngTuple[][]>()
  for (const { category, coordinates } of segments) {
    const group = lines.get(category) ?? []
    group.push(coordinates.map(([lng, lat]) => [lat, lng]))
    lines.set(category, group)
  }
  const outline = L.polyline([...lines.values()].flat(), {
    pane: 'walk-outlines', color: '#fff', weight: 6, interactive: false,
  })
  const paths = [...lines].map(([category, coordinates]) => L.polyline(coordinates, {
    pane: 'walk-routes', color: category === 'shared' ? sharedColor : categories[category].color,
    weight: 3, interactive: false,
  }))
  const allPaths = [outline, ...paths]
  const group = L.layerGroup(allPaths).addTo(map)
  if (!prefersReducedMotion()) {
    for (const path of allPaths) path.getElement()?.animate?.([{ opacity: 0 }, { opacity: 1 }],
      { duration: 250, easing: settle })
  }
  return { group, paths: allPaths }
}

export function fadeRoutes(routes: Routes) {
  if (prefersReducedMotion()) { routes.group.remove(); return () => {} }
  const animations = routes.paths.flatMap(path => {
    const element = path.getElement()
    if (!element?.animate) return []
    const opacity = getComputedStyle(element).opacity
    return [element.animate([{ opacity }, { opacity: 0 }], { duration: 150, easing: settle, fill: 'both' })]
  })
  const timer = window.setTimeout(() => routes.group.remove(), 150)
  return () => { window.clearTimeout(timer); animations.forEach(animation => animation.cancel()); routes.group.remove() }
}
