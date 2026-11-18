type Theme = 'light' | 'dark'
const currentTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

// Prepare the alternate palette while the appearance menu is open. Swapping
// the canvas keeps raster work out of the view transition's capture callback.
export default class ThemeRaster {
  private alternate?: HTMLCanvasElement
  private painted?: Theme
  private preparing = false
  private idleHandle?: number
  private observer = new MutationObserver(() => this.refresh())

  constructor(public canvas: HTMLCanvasElement, private paint: (target: HTMLCanvasElement, theme: Theme) => void) {}

  private release = () => {
    this.preparing = false
    this.alternate = undefined
    if (this.idleHandle !== undefined) cancelIdleCallback(this.idleHandle)
    this.idleHandle = undefined
  }

  start() {
    window.addEventListener('release-map-appearance', this.release)
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('prepare-map-appearance', this.prepare)
  }

  stop() {
    window.removeEventListener('release-map-appearance', this.release)
    this.observer.disconnect()
    window.removeEventListener('prepare-map-appearance', this.prepare)
    this.release()
  }

  redraw() {
    this.alternate = undefined
    this.painted = currentTheme()
    const ctx = this.canvas.getContext('2d')
    ctx?.resetTransform()
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.paint(this.canvas, this.painted)
    if (this.preparing) this.prepare()
  }

  private prepare = () => {
    this.preparing = true
    if (this.alternate || !this.painted || this.idleHandle !== undefined) return
    if (typeof requestIdleCallback === 'function') {
      this.idleHandle = requestIdleCallback(() => {
        this.idleHandle = undefined
        this.paintAlternate()
      })
    } else {
      this.paintAlternate()
    }
  }

  private paintAlternate() {
    if (!this.painted || this.alternate) return
    const target = document.createElement('canvas')
    target.width = this.canvas.width
    target.height = this.canvas.height
    this.paint(target, this.painted === 'dark' ? 'light' : 'dark')
    this.alternate = target
  }

  private refresh() {
    const theme = currentTheme()
    if (this.painted === theme) return
    const next = this.alternate
    if (!next) { this.redraw(); return }
    const previous = this.canvas
    next.className = previous.className
    next.style.cssText = previous.style.cssText
    next.setAttribute('aria-hidden', 'true')
    previous.replaceWith(next)
    this.canvas = next
    this.alternate = previous
    this.painted = theme
  }
}
