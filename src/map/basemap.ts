import * as L from 'leaflet'
import { prefersReducedMotion, settle } from './motion'
import type { FeatureCollection, LineString, MultiLineString } from 'geojson'
import type { Basemap } from '../assets/loadAssets'

const areaColors: Record<string, string> = {
  land: 'var(--map-land, #f6f2eb)',
  green: 'var(--map-green, #d8e8d5)',
  water: 'var(--map-water, #cddcf5)',
}

export function addRegion(map: L.Map, data: FeatureCollection) {
  const region = L.layerGroup().addTo(map)
  L.geoJSON(data, {
    pane: 'regional-context', interactive: false,
    style: feature => feature?.properties?.kind === 'road'
      ? { color: 'var(--map-artery, #d4c4ad)', weight: 1.25 }
      : { stroke: false, fillColor: areaColors[feature?.properties?.kind] ?? areaColors.land, fillOpacity: 1 },
  }).addTo(region)
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
  L.geoJSON(data.areas, {
    interactive: false,
    style: feature => ({
      stroke: false,
      fillColor: areaColors[feature?.properties?.kind] ?? areaColors.land,
      fillOpacity: 1,
    }),
  }).addTo(layers)
  const streets: L.LatLngTuple[][] = []
  const mainStreets: L.LatLngTuple[][] = []
  for (const feature of data.streets.features) {
    const geometry = feature.geometry as LineString | MultiLineString
    const segments = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
    const lines = feature.properties?.major ? mainStreets : streets
    for (const path of segments) lines.push(path.map(([lng, lat]) => [lat, lng]))
  }
  L.polyline(streets, { interactive: false, color: 'var(--map-road, #ded8cf)', weight: 1.4 }).addTo(layers)
  L.polyline(mainStreets, { interactive: false, color: 'var(--map-artery, #d4c4ad)', weight: 2.4 }).addTo(layers)

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
