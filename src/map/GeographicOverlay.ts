import * as L from 'leaflet'
import { zoomPoint } from './zoomTransform'

// Keep a single SVG layout through zooms. Leaflet's default overlay resizes
// the SVG at each stop, invalidating the building layer's rasterized geometry.
export default class GeographicOverlay extends L.SVGOverlay {
  private paintedZoom = 0

  onAdd(map: L.Map) {
    const layer = super.onAdd(map)
    this.paintedZoom = map.getZoom()
    return layer
  }

  getEvents() {
    return { zoom: this.position, zoomanim: this.position, viewreset: this.position }
  }

  private position(event: L.LeafletEvent) {
    const svg = this.getElement()
    if (!svg) return
    const target = event.type === 'zoomanim' ? event as L.ZoomAnimEvent : undefined
    const origin = zoomPoint(this._map, this.getBounds().getNorthWest(), target)
    const scale = this._map.getZoomScale(target?.zoom ?? this._map.getZoom(), this.paintedZoom)
    svg.style.transform = `translate3d(${origin.x}px,${origin.y}px,0) scale(${scale})`
  }
}
