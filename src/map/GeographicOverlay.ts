import * as L from 'leaflet'

// Leaflet normally resizes an SVG on every zoom tick. Keep its painted size
// during a flight, then render at the final resolution when the camera settles.
export default class GeographicOverlay extends L.SVGOverlay {
  private paintedZoom = 0

  onAdd(map: L.Map) {
    this.paintedZoom = map.getZoom()
    return super.onAdd(map)
  }

  getEvents() {
    return {
      ...super.getEvents?.(),
      zoom: this.moveDrawing,
      zoomend: this.settleDrawing,
      viewreset: this.settleDrawing,
    }
  }

  private moveDrawing() {
    const svg = this.getElement()
    if (!svg) return
    const origin = this._map.latLngToLayerPoint(this.getBounds().getNorthWest())
    const scale = this._map.getZoomScale(this._map.getZoom(), this.paintedZoom)
    svg.style.transform = `translate3d(${origin.x}px,${origin.y}px,0) scale(${scale})`
  }

  private settleDrawing() {
    this.paintedZoom = this._map.getZoom()
    this.setBounds(this.getBounds())
  }
}
