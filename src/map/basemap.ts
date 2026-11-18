import * as L from 'leaflet'
import { prefersReducedMotion, settle } from './motion'
import { cartoSurface } from './cartoSurface'
import type { FeatureCollection } from 'geojson'
import type { Basemap } from '../assets/loadAssets'

export function addRegion(map: L.Map, data: FeatureCollection) {
  const region = L.layerGroup().addTo(map)
  cartoSurface(L.latLngBounds([37.50, -122.70], [38, -122.10]), 'regional-context', data).addTo(region)
  const cities: [string, number, number][] = [
    ['San Francisco', 37.766, -122.444], ['Oakland', 37.805, -122.272],
    ['Berkeley', 37.872, -122.273], ['Daly City', 37.687, -122.47],
    ['Sausalito', 37.86, -122.488], ['San Mateo', 37.563, -122.326],
  ]
  for (const [name, lat, lng] of cities) {
    const label = document.createElement('span')
    label.textContent = name
    L.marker([lat, lng], {
      pane: 'regional-context', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'regional-label', html: label, iconSize: [100, 20], iconAnchor: [50, 10] }),
    }).addTo(region)
  }
  return region
}

export function addBasemap(map: L.Map, data: Basemap) {
  const layers = L.layerGroup()
  cartoSurface(L.latLngBounds([37.704, -122.525], [37.837, -122.349]), 'city-cartography', data.areas, data.streets).addTo(layers)

  const labels = L.layerGroup().addTo(layers)
  function updateLabels() {
    labels.clearLayers()
    if (map.getZoom() < 13) return
    const bounds = map.getBounds()
    const names = new Set<string>()
    const used: L.Bounds[] = []
    // Major streets get first choice of screen space where labels would collide.
    for (const feature of data.labels.features) {
      const [longitude, latitude] = feature.geometry.coordinates
      const point: L.LatLngTuple = [latitude, longitude]
      if (!bounds.contains(point) || (!feature.properties.major && map.getZoom() < 14)) continue
      const { name, angle } = feature.properties
      if (names.has(name)) continue
      const pixel = map.latLngToContainerPoint(point)
      const radians = angle * Math.PI / 180
      const halfWidth = Math.min(88, name.length * 2.6 + 6)
      const halfHeight = 9
      const x = Math.abs(Math.cos(radians)) * halfWidth + Math.abs(Math.sin(radians)) * halfHeight
      const y = Math.abs(Math.sin(radians)) * halfWidth + Math.abs(Math.cos(radians)) * halfHeight
      const labelBounds = L.bounds([pixel.x - x, pixel.y - y], [pixel.x + x, pixel.y + y])
      if (used.some(box => box.intersects(labelBounds))) continue
      used.push(labelBounds)
      names.add(name)
      const label = document.createElement('span')
      label.className = 'street-label'
      label.textContent = name
      label.style.setProperty('--angle', `${angle}deg`)
      L.marker(point, {
        icon: L.divIcon({ className: 'street-icon', html: label, iconSize: [0, 0] }),
        interactive: false, keyboard: false, pane: 'street-labels',
      }).addTo(labels)
      if (!prefersReducedMotion()) label.animate?.([{ opacity: 0 }, { opacity: 1 }],
        { duration: 240, easing: settle })
    }
  }
  function setDetailVisibility() {
    if (map.getZoom() >= 13) layers.addTo(map)
    else layers.remove()
  }
  map.on('zoomend', setDetailVisibility)
  setDetailVisibility()
  map.on('moveend', updateLabels)
  updateLabels()
  return () => { map.off('moveend', updateLabels); map.off('zoomend', setDetailVisibility); layers.remove() }
}
