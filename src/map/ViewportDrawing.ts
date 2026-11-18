import ThemeRaster from './ThemeRaster'
import * as L from 'leaflet'
import { zoomPoint } from './zoomTransform'
import type { CartoPaint } from './FlightPreview'

// Paint settled detail into a screen-sized buffer. Its dimensions never grow
// with the geographic extent of the city, even at the closest zoom.
export default class ViewportDrawing extends L.Layer {
  private corner?: L.LatLng
  private paintedZoom = 0
  private paintFrame?: { visible: L.LatLngBounds; ratio: number; scale: number; origin: L.Point }
  private raster = new ThemeRaster(document.createElement('canvas'), (target, theme) => this.paint(target, theme))
  private get canvas() { return this.raster.canvas }

  constructor(private bounds: L.LatLngBounds, private paneName: string, private paints: CartoPaint[]) {
    super()
    this.canvas.className = 'carto-surface leaflet-zoom-animated'
    this.canvas.setAttribute('aria-hidden', 'true')
  }

  onAdd(map: L.Map) {
    map.getPane(this.paneName)!.append(this.canvas)
    this.draw()
    this.raster.start()
    return this
  }

  onRemove() {
    this.raster.stop()
    this.canvas.remove()
    return this
  }

  getEvents() { return { zoomanim: this.position, zoom: this.position, moveend: this.draw, viewreset: this.draw } }

  private draw = () => {
    const map = this._map
    const size = map.getSize()
    const pad = size.multiplyBy(.12).round()
    const extent = size.add(pad.multiplyBy(2))
    const start = map.containerPointToLatLng(pad.multiplyBy(-1))
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.ceil(extent.x * ratio)
    this.canvas.height = Math.ceil(extent.y * ratio)
    this.canvas.style.width = extent.x + 'px'
    this.canvas.style.height = extent.y + 'px'
    this.corner = start
    this.paintedZoom = map.getZoom()
    this.position()
    this.paintFrame = {
      visible: L.latLngBounds(start, map.containerPointToLatLng(size.add(pad))),
      origin: map.latLngToContainerPoint(this.bounds.getNorthWest()).add(pad),
      scale: map.getZoomScale(this.paintedZoom, 18),
      ratio,
    }
    this.raster.redraw()
  }

  private paint(target: HTMLCanvasElement, theme: 'light' | 'dark') {
    const ctx = target.getContext('2d')
    if (!ctx || !this.paintFrame) return
    const { visible, ratio, scale, origin } = this.paintFrame
    ctx.setTransform(scale * ratio, 0, 0, scale * ratio, origin.x * ratio, origin.y * ratio)
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

  private position(event?: L.LeafletEvent) {
    const target = event?.type === 'zoomanim' ? event as L.ZoomAnimEvent : undefined
    if (!this.corner) return
    const point = zoomPoint(this._map, this.corner, target)
    const scale = this._map.getZoomScale(target?.zoom ?? this._map.getZoom(), this.paintedZoom)
    this.canvas.style.transform = `translate3d(${point.x}px,${point.y}px,0) scale(${scale})`
  }
}
