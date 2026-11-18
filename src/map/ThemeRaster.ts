type Theme = 'light' | 'dark'
const currentTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

// Keep an alternate bitmap ready while the appearance menu is open. A theme
// change can then reuse the street drawing without traversing its geometry.
export default class ThemeRaster {
  private cache: Partial<Record<Theme, HTMLCanvasElement>> = {}
  private painted?: Theme
  private observer = new MutationObserver(() => this.refresh())
  constructor(private canvas: HTMLCanvasElement, private paint: (target: HTMLCanvasElement, theme: Theme) => void) {}

  private release = () => { this.cache = {} }

  start() {
    window.addEventListener('release-map-appearance', this.release)
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('prepare-map-appearance', this.prepare)
  }

  stop() {
    window.removeEventListener('release-map-appearance', this.release)
    this.observer.disconnect()
    window.removeEventListener('prepare-map-appearance', this.prepare)
    this.cache = {}
  }

  redraw() {
    this.cache = {}
    this.painted = currentTheme()
    const ctx = this.canvas.getContext('2d')
    ctx?.resetTransform()
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.paint(this.canvas, this.painted)
  }

  private prepare = () => {
    if (!this.painted || this.cache[this.painted]) return
    const other = this.painted === 'dark' ? 'light' : 'dark'
    for (const theme of [this.painted, other] as const) {
      const target = document.createElement('canvas')
      target.width = this.canvas.width
      target.height = this.canvas.height
      if (theme === this.painted) target.getContext('2d')?.drawImage(this.canvas, 0, 0)
      else this.paint(target, theme)
      this.cache[theme] = target
    }
  }

  private refresh() {
    const theme = currentTheme()
    if (this.painted === theme) return
    const bitmap = this.cache[theme]
    const context = this.canvas.getContext('2d')
    if (!bitmap || !context) { this.redraw(); return }
    context.save()
    context.resetTransform()
    context.globalCompositeOperation = 'copy'
    context.drawImage(bitmap, 0, 0)
    context.restore()
    this.painted = currentTheme()
  }
}
