import * as L from 'leaflet'

// Project the canvas anchor into the same target camera that Leaflet uses for
// its route SVGs and markers. The current camera stays unchanged until zoomend.
export function zoomPoint(map: L.Map, anchor: L.LatLng, event?: L.ZoomAnimEvent) {
  if (!event) return map.latLngToLayerPoint(anchor)
  const origin = map.project(event.center, event.zoom)
    .subtract(map.getSize().divideBy(2))
    .subtract(map.containerPointToLayerPoint([0, 0])).round()
  return map.project(anchor, event.zoom).subtract(origin)
}
