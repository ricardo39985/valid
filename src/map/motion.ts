export const settle = 'cubic-bezier(.2,.72,.2,1)'

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function enterMapFeature(element: Element, delay = 0) {
  if (prefersReducedMotion() || !element.animate) return
  element.animate([
    { opacity: 0, transform: 'translateY(5px) scale(.86)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: 260, delay, easing: settle, fill: 'backwards' })
}
