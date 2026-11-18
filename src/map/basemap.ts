import * as L from 'leaflet'
import type { Basemap } from '../assets/loadAssets'

const areaColors: Record<string, string> = {
  land: '#f6f2eb',
  green: '#d8e8d5',
  water: '#cddcf5',
}

export function addBasemap(map: L.Map, data: Basemap) {
  L.geoJSON(data.areas, {
    interactive: false,
    style: feature => ({
      stroke: false,
      fillColor: areaColors[feature?.properties?.kind] ?? areaColors.land,
      fillOpacity: 1,
    }),
  }).addTo(map)
  L.geoJSON(data.streets, {
    interactive: false,
    style: feature => ({
      color: feature?.properties?.major ? '#d1c4ac' : '#dcd6ce',
      weight: feature?.properties?.major ? 2.3 : 1.25,
      opacity: .9,
    }),
  }).addTo(map)

  const labels = L.layerGroup().addTo(map)
  function updateLabels() {
    labels.clearLayers()
    if (map.getZoom() < 13) return
    const bounds = map.getBounds()
    const occupied = new Set<string>()
    // Major streets get first choice of screen space where labels would collide.
    for (const feature of data.labels.features) {
      const [longitude, latitude] = feature.geometry.coordinates
      const point: L.LatLngTuple = [latitude, longitude]
      if (!bounds.contains(point) || (!feature.properties.major && map.getZoom() < 14)) continue
      const pixel = map.latLngToContainerPoint(point)
      const cell = `${Math.floor(pixel.x / 87)}:${Math.floor(pixel.y / 48)}`
      if (occupied.has(cell)) continue
      occupied.add(cell)
      const label = document.createElement('span')
      label.className = 'street-label'
      label.textContent = feature.properties.name
      label.style.setProperty('--angle', `${feature.properties.angle}deg`)
      L.marker(point, {
        icon: L.divIcon({ className: 'street-icon', html: label, iconSize: [0, 0] }),
        interactive: false, keyboard: false, pane: 'street-labels',
      }).addTo(labels)
    }
  }
  map.on('moveend', updateLabels)
  updateLabels()
}
