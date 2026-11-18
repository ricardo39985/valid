import * as L from 'leaflet'
import { afterFrame } from './afterFrame'
import GeographicOverlay from './GeographicOverlay'
import { fetchPackedJson } from '../assets/packedJson'
import type { Coordinate } from '../routing/types'

const files = import.meta.glob<string>('../assets/buildings/*.pack', { eager: true, query: '?url&no-inline', import: 'default' })
const tileZoom = 13
const tileSize = 256
const extent = 4096
const ns = 'http://www.w3.org/2000/svg'

// The export writes closed rings with an absolute start and relative edges.
function indexRings(data: string) {
  return (data.match(/M[^Z]+Z/g) ?? []).map(d => {
    const points = d.match(/-?\d+/g)!.map(Number)
    let [x, y] = points
    const bounds = L.bounds([x, y], [x, y])
    for (let i = 2; i < points.length; i += 2) {
      x += points[i]
      y += points[i + 1]
      bounds.extend([x, y])
    }
    return { d, bounds }
  })
}

export function buildingLayer(map: L.Map) {
  const tiles = L.layerGroup()
  const cached = new Map<string, {
    tile: GeographicOverlay
    path: SVGPathElement
    rings: ReturnType<typeof indexRings>
    clip?: L.Bounds
  }>()
  let visible = new Set<string>()
  const requested = new Set<string>()
  let disposed = false

  function attach(key: string, entry: NonNullable<ReturnType<typeof cached.get>>) {
    const bounds = map.getBounds().pad(.12)
    const [x, y] = key.split('-').map(Number)
    const topLeft = L.point(x * tileSize, y * tileSize)
    const toTile = (point: L.LatLng) => map.project(point, tileZoom).subtract(topLeft).multiplyBy(extent / tileSize)
    const view = L.bounds(toTile(bounds.getNorthWest()), toTile(bounds.getSouthEast()))
    if (!entry.clip?.contains(view)) {
      // Keep extra geometry around the viewport for pans and zoom-outs.
      entry.clip = view.pad(.22)
      const clip = entry.clip
      entry.path.setAttribute('d', entry.rings.filter(ring => clip.intersects(ring.bounds)).map(ring => ring.d).join(''))
    }
    tiles.addLayer(entry.tile)
  }

  function prepare(bounds: L.LatLngBounds, viewport = false) {
    const keys = new Set<string>()
    const start = map.project(bounds.getNorthWest(), tileZoom).divideBy(tileSize).floor()
    const end = map.project(bounds.getSouthEast(), tileZoom).divideBy(tileSize).floor()
    for (let x = start.x; x <= end.x; x++) {
      for (let y = start.y; y <= end.y; y++) {
        const key = x + '-' + y
        const url = files['../assets/buildings/' + key + '.pack']
        if (!url) continue
        keys.add(key)
        if (requested.has(key)) continue
        requested.add(key)
        const tileBounds = L.latLngBounds(
          map.unproject(L.point(x * tileSize, y * tileSize), tileZoom),
          map.unproject(L.point((x + 1) * tileSize, (y + 1) * tileSize), tileZoom),
        )
        fetchPackedJson<string>(url).then(d => {
          if (disposed) return
          const svg = document.createElementNS(ns, 'svg')
          svg.setAttribute('viewBox', '0 0 4096 4096')
          svg.setAttribute('preserveAspectRatio', 'none')
          svg.setAttribute('aria-hidden', 'true')
          const path = document.createElementNS(ns, 'path')
          path.setAttribute('vector-effect', 'non-scaling-stroke')
          svg.append(path)
          const tile = new GeographicOverlay(svg, tileBounds, { pane: 'buildings', className: 'building-tile' })
          const entry = { tile, path, rings: indexRings(d) }
          cached.set(key, entry)
          if (visible.has(key) && map.hasLayer(tiles)) attach(key, entry)
        }).catch(() => requested.delete(key))
      }
    }
    if (viewport) {
      visible = keys
      for (const [key, entry] of cached) {
        if (keys.has(key)) attach(key, entry)
        else tiles.removeLayer(entry.tile)
      }
    }
  }

  function update() {
    if (map.getZoom() < 14) { tiles.remove(); return }
    tiles.addTo(map)
    prepare(map.getBounds(), true)
  }
  let cancelUpdate: (() => void) | undefined
  const pane = map.getPane('buildings')!
  function startZoom() { pane.classList.add('building-zooming') }
  function stopUpdate() { cancelUpdate?.() }
  function scheduleUpdate() {
    stopUpdate()
    cancelUpdate = afterFrame(() => {
      update()
      pane.classList.remove('building-zooming')
    })
  }
  map.on('zoomstart', startZoom)
  map.on('movestart', stopUpdate)
  map.on('moveend', scheduleUpdate)
  update()
  return {
    warm([lng, lat]: Coordinate) { prepare(L.latLng(lat, lng).toBounds(1800)) },
    dispose() {
      disposed = true
      stopUpdate()
      pane.classList.remove('building-zooming')
      map.off('zoomstart', startZoom)
      map.off('movestart', stopUpdate)
      map.off('moveend', scheduleUpdate)
      tiles.remove()
    },
  }
}
