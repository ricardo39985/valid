import * as L from 'leaflet'
import GeographicOverlay from './GeographicOverlay'
import type { FeatureCollection, Position } from 'geojson'

const ns = 'http://www.w3.org/2000/svg'
const colors: Record<string, string> = {
  land: 'var(--map-land, #f6f2eb)', green: 'var(--map-green, #d8e8d5)', water: 'var(--map-water, #cddcf5)',
  road: 'var(--map-road, #ded8cf)', major: 'var(--map-artery, #d4c4ad)',
}

// Geographic layers retain their complete drawing while Leaflet moves the camera.
// A viewport-clipped renderer only has pixels for the previous neighborhood.
export function cartoSurface(bounds: L.LatLngBounds, pane: string, areas: FeatureCollection, streets?: FeatureCollection) {
  const project = (point: L.LatLng) => L.CRS.EPSG3857.latLngToPoint(point, 18)
  const origin = project(bounds.getNorthWest())
  const size = project(bounds.getSouthEast()).subtract(origin)
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const paths = new Map<string, string[]>()

  function line(points: Position[], closed: boolean) {
    const pairs = points.map(([lng, lat]) => {
      const p = project(L.latLng(lat, lng))
      return Math.round(p.x - origin.x) + ' ' + Math.round(p.y - origin.y)
    })
    return 'M' + pairs.join('L') + (closed ? 'Z' : '')
  }
  for (const collection of [areas, streets]) {
    if (!collection) continue
    for (const { geometry, properties } of collection.features) {
      const kind = collection === streets ? (properties?.major ? 'major' : 'road')
        : properties?.kind === 'road' ? 'major' : properties?.kind
      const parts = paths.get(kind) ?? []
      paths.set(kind, parts)
      if (geometry.type === 'LineString') parts.push(line(geometry.coordinates, false))
      if (geometry.type === 'MultiLineString') for (const path of geometry.coordinates) parts.push(line(path, false))
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : []
      for (const polygon of polygons) for (const ring of polygon) parts.push(line(ring, true))
    }
  }
  for (const [kind, parts] of paths) {
    const path = document.createElementNS(ns, 'path')
    const stroke = kind === 'road' || kind === 'major'
    path.setAttribute('d', parts.join(''))
    path.setAttribute('fill', stroke ? 'none' : colors[kind])
    if (stroke) {
      path.setAttribute('stroke', colors[kind])
      path.setAttribute('stroke-width', streets && kind === 'major' ? '2.4' : '1.35')
      path.setAttribute('vector-effect', 'non-scaling-stroke')
    }
    svg.append(path)
  }
  return new GeographicOverlay(svg, bounds, { pane, interactive: false, className: 'carto-surface' })
}
