import * as L from 'leaflet'
import type { CartoPaint } from './FlightPreview'

// Paint settled detail into a screen-sized buffer. Its dimensions never grow
// with the geographic extent of the city, even at the closest zoom.
export default class ViewportDrawing extends L.Layer {
  private canvas = document.createElement('canvas')
  private corner?: L.LatLng
  private paintedZoom = 0
  private observer?: MutationObserver

  constructor(private bounds: L.LatLngBounds, private paneName: string, private paints: CartoPaint[]) {
    super()
    this.canvas.className = 'carto-surface'
    this.canvas.setAttribute('aria-hidden', 'true')
  }

  onAdd(map: L.Map) {
    map.getPane(this.paneName)!.append(this.canvas)
    this.draw()
    this.observer = new MutationObserver(this.draw)
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return this
  }

  onRemove() {
    this.observer?.disconnect()
    this.canvas.remove()
    return this
  }

  getEvents() { return { zoom: this.position, moveend: this.draw, viewreset: this.draw } }

  private draw = () => {
    const map = this._map
    const size = map.getSize()
    const pad = size.multiplyBy(.12).round()
    const extent = size.add(pad.multiplyBy(2))
    const start = map.containerPointToLatLng(pad.multiplyBy(-1))
    const visible = L.latLngBounds(start, map.containerPointToLatLng(size.add(pad)))
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.ceil(extent.x * ratio)
    this.canvas.height = Math.ceil(extent.y * ratio)
    this.canvas.style.width = extent.x + 'px'
    this.canvas.style.height = extent.y + 'px'
    this.corner = start
    this.paintedZoom = map.getZoom()
    this.position()
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const scale = map.getZoomScale(this.paintedZoom, 18)
    const origin = map.latLngToContainerPoint(this.bounds.getNorthWest()).add(pad)
    ctx.setTransform(scale * ratio, 0, 0, scale * ratio, origin.x * ratio, origin.y * ratio)
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    for (const { path, ink, stroke, width, bounds } of this.paints) {
      if (bounds && !visible.intersects(bounds)) continue
      if (stroke) {
        ctx.lineWidth = width / scale
        ctx.strokeStyle = ink[theme]
        ctx.stroke(path)
      } else {
        ctx.fillStyle = ink[theme]
        ctx.fill(path)
      }
    }
  }

  private position() {
    if (!this.corner) return
    const point = this._map.latLngToLayerPoint(this.corner)
    const scale = this._map.getZoomScale(this._map.getZoom(), this.paintedZoom)
    this.canvas.style.transform = `translate3d(${point.x}px,${point.y}px,0) scale(${scale})`
  }
}
