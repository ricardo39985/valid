import * as L from 'leaflet'
import FlightPreview, { type CartoPaint } from './FlightPreview'
import ViewportDrawing from './ViewportDrawing'
import type { FeatureCollection, Position } from 'geojson'

const palette: Record<string, { light: string; dark: string }> = {
  land: { light: '#f6f2eb', dark: '#272b36' },
  green: { light: '#d8e8d5', dark: '#2b403a' },
  water: { light: '#cddcf5', dark: '#1b2c43' },
  road: { light: '#ded8cf', dark: '#434958' },
  major: { light: '#d4c4ad', dark: '#655e5c' },
}

// Keep a complete flight preview, but draw street detail by neighborhood at rest.
export function cartoSurface(bounds: L.LatLngBounds, pane: string, areas: FeatureCollection, streets?: FeatureCollection) {
  const project = (point: L.LatLng) => L.CRS.EPSG3857.latLngToPoint(point, 18)
  const origin = project(bounds.getNorthWest())
  const paths = new Map<string, string[]>()

  const streetsByCell = new Map<string, { kind: string; bounds: L.LatLngBounds; parts: string[] }>()
  function line(points: Position[], closed: boolean, extent?: L.LatLngBounds) {
    const pairs = points.map(([lng, lat]) => {
      extent?.extend([lat, lng])
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
      const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : []
      for (const coords of lines) {
        if (collection !== streets) { parts.push(line(coords, false)); continue }
        const [lng, lat] = coords[0]
        const key = kind + '/' + Math.floor(lng * 160) + '/' + Math.floor(lat * 160)
        const cell = streetsByCell.get(key) ?? { kind, bounds: new L.LatLngBounds([]), parts: [] as string[] }
        const d = line(coords, false, cell.bounds)
        cell.parts.push(d)
        streetsByCell.set(key, cell)
      }
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : []
      for (const polygon of polygons) for (const ring of polygon) parts.push(line(ring, true))
    }
  }
  const paints: CartoPaint[] = []
  for (const [kind, parts] of paths) {
    const stroke = kind === 'road' || kind === 'major'
    const paint = { stroke, ink: palette[kind], width: streets && kind === 'major' ? 2.4 : 1.35 }
    if (streets && stroke) {
      for (const cell of streetsByCell.values()) {
        if (cell.kind === kind) paints.push({ ...paint, path: new Path2D(cell.parts.join('')), bounds: cell.bounds })
      }
    } else paints.push({ ...paint, path: new Path2D(parts.join('')) })
  }
  return L.layerGroup([
    new FlightPreview(bounds, pane, paints),
    new ViewportDrawing(bounds, pane, paints),
  ])
}
