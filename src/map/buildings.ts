import * as L from 'leaflet'
import GeographicOverlay from './GeographicOverlay'
import { fetchPackedJson } from '../assets/packedJson'
import type { Coordinate } from '../routing/types'

const files = import.meta.glob<string>('../assets/buildings/*.pack', { eager: true, query: '?url&no-inline', import: 'default' })
const tileZoom = 13
const tileSize = 256
const ns = 'http://www.w3.org/2000/svg'

export function buildingLayer(map: L.Map) {
  const tiles = L.layerGroup()
  const requested = new Set<string>()
  let disposed = false

  function prepare(bounds: L.LatLngBounds) {
    const start = map.project(bounds.getNorthWest(), tileZoom).divideBy(tileSize).floor()
    const end = map.project(bounds.getSouthEast(), tileZoom).divideBy(tileSize).floor()
    for (let x = start.x; x <= end.x; x++) {
      for (let y = start.y; y <= end.y; y++) {
        const key = x + '-' + y
        const url = files['../assets/buildings/' + key + '.pack']
        if (!url || requested.has(key)) continue
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
          path.setAttribute('d', d)
          path.setAttribute('vector-effect', 'non-scaling-stroke')
          svg.append(path)
          new GeographicOverlay(svg, tileBounds, { pane: 'buildings', className: 'building-tile' }).addTo(tiles)
        }).catch(() => requested.delete(key))
      }
    }
  }

  function update() {
    if (map.getZoom() < 14) { tiles.remove(); return }
    tiles.addTo(map)
    prepare(map.getBounds())
  }
  map.on('moveend', update)
  update()
  return {
    warm([lng, lat]: Coordinate) { prepare(L.latLng(lat, lng).toBounds(1800)) },
    dispose() { disposed = true; map.off('moveend', update); tiles.remove() },
  }
}
