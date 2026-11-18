import * as L from 'leaflet'
import { zoomPoint } from './zoomTransform'

type Ink = { light: string; dark: string }
export type CartoPaint = { path: Path2D; ink: Ink; stroke: boolean; width: number; bounds?: L.LatLngBounds }

// Rasterize the same geographic paths once per theme. During a flight the browser
// only translates and scales this bitmap; the street geometry stays in memory.
export default class FlightPreview extends L.Layer {
  private readonly canvas = document.createElement('canvas')
  private readonly northWest: L.LatLng
  private readonly widthAt18: number
  private readonly heightAt18: number
  private observer?: MutationObserver

  constructor(bounds: L.LatLngBounds, private paneName: string, private paints: CartoPaint[]) {
    super()
    this.northWest = bounds.getNorthWest()
    const size = L.CRS.EPSG3857.latLngToPoint(bounds.getSouthEast(), 18)
      .subtract(L.CRS.EPSG3857.latLngToPoint(this.northWest, 18))
    this.widthAt18 = size.x
    this.heightAt18 = size.y
    const ratio = 1536 / Math.max(size.x, size.y)
    this.canvas.width = Math.round(size.x * ratio)
    this.canvas.height = Math.round(size.y * ratio)
    this.canvas.className = 'flight-preview leaflet-zoom-animated'
    this.canvas.setAttribute('aria-hidden', 'true')
  }

  private paint = () => {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const sx = this.canvas.width / this.widthAt18
    ctx.setTransform(sx, 0, 0, this.canvas.height / this.heightAt18, 0, 0)
    ctx.clearRect(0, 0, this.widthAt18, this.heightAt18)
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    for (const { path, ink, stroke } of this.paints) {
      if (stroke) {
        ctx.strokeStyle = ink[theme]
        ctx.lineWidth = 1.1 / sx
        ctx.stroke(path)
      } else {
        ctx.fillStyle = ink[theme]
        ctx.fill(path)
      }
    }
  }

  onAdd(map: L.Map) {
    map.getPane(this.paneName)!.append(this.canvas)
    this.paint()
    this.position()
    this.observer = new MutationObserver(this.paint)
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return this
  }

  onRemove() {
    this.observer?.disconnect()
    this.canvas.remove()
    return this
  }

  getEvents() { return { zoomanim: this.position, zoom: this.position, viewreset: this.position } }

  private position(event?: L.LeafletEvent) {
    const target = event?.type === 'zoomanim' ? event as L.ZoomAnimEvent : undefined
    const origin = zoomPoint(this._map, this.northWest, target)
    const scale = this._map.getZoomScale(target?.zoom ?? this._map.getZoom(), 18) * this.widthAt18 / this.canvas.width
    this.canvas.style.transform = `translate3d(${origin.x}px,${origin.y}px,0) scale(${scale})`
  }
}
