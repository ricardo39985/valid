import { useLayoutEffect, useRef, type RefObject } from 'react'
import { prefersReducedMotion, settle } from '../map/motion'

function transformBetween(from: DOMRect, to: DOMRect) {
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
}

export function useAnchoredPanel(open: boolean, anchor: RefObject<HTMLButtonElement | null>) {
  const panel = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)

  useLayoutEffect(() => {
    const element = panel.current
    const button = anchor.current
    if (!element || !button) return
    const wasVisible = element.dataset.visible === 'true'
    if (!open && !wasVisible) return

    // Measure the currently drawn frame before cancelling so quick reversals
    // resume from the current shape instead of jumping to an endpoint.
    const from = wasVisible ? element.getBoundingClientRect() : button.getBoundingClientRect()
    animation.current?.cancel()
    // Make the entire panel available for measurement in this layout pass.
    // Display, background, and children remain together through the final frame.
    element.dataset.visible = 'true'
    const natural = element.getBoundingClientRect()
    if (!element.animate || prefersReducedMotion() || !natural.width || !natural.height) {
      element.dataset.visible = String(open)
      animation.current = null
      return
    }

    const to = open ? natural : button.getBoundingClientRect()
    const motion = element.animate([
      { transform: transformBetween(from, natural), borderRadius: wasVisible ? '23px' : '16px' },
      { transform: transformBetween(to, natural), borderRadius: open ? '23px' : '16px' },
    ], { duration: open ? 350 : 300, easing: settle, fill: 'both' })
    animation.current = motion
    motion.onfinish = () => {
      element.dataset.visible = String(open)
      motion.cancel()
      if (animation.current === motion) animation.current = null
    }
  }, [open, anchor])

  useLayoutEffect(() => () => animation.current?.cancel(), [])

  return panel
}

type Part = { clone: HTMLElement; box: DOMRect }

export function captureSharedElements(container: HTMLElement): Part[] {
  return [...container.querySelectorAll<HTMLElement>('[data-shared]')].map(element => {
    const box = element.getBoundingClientRect()
    const clone = element.cloneNode(true) as HTMLElement
    const style = getComputedStyle(element)
    Object.assign(clone.style, {
      position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
      zIndex: '1000', color: style.color, background: style.background, font: style.font,
      borderRadius: style.borderRadius, transformOrigin: 'top left', pointerEvents: 'none', margin: '0',
    })
    clone.setAttribute('aria-hidden', 'true')
    clone.removeAttribute('data-shared')
    clone.classList.remove('shared-in-flight')
    return { clone, box }
  })
}

function settledBox(element: HTMLElement) {
  const box = element.getBoundingClientRect()
  const slide = element.closest<HTMLElement>('[data-shared-slide]')
  if (!slide) return box
  const transform = getComputedStyle(slide).transform
  if (transform === 'none') return box
  // The hand-off goes to the row's resting position, not its current
  // off-center position while the category view slides back into the panel.
  const matrix = new DOMMatrixReadOnly(transform)
  const scale = slide.offsetWidth ? slide.getBoundingClientRect().width / slide.offsetWidth : 1
  return new DOMRect(box.x - matrix.m41 * scale, box.y - matrix.m42 * scale, box.width, box.height)
}

export function carrySharedElements(parts: Part[], target: HTMLElement) {
  const active: { clone: HTMLElement; element: HTMLElement; animation: Animation }[] = []
  const elements = [...target.querySelectorAll<HTMLElement>('[data-shared]')]
  for (const [index, part] of parts.entries()) {
    const element = elements[index]
    if (!element?.animate) continue
    const end = settledBox(element)
    if (!end.width || !end.height || !part.box.width || !part.box.height) continue
    element.classList.add('shared-in-flight')
    document.body.append(part.clone)
    const animation = part.clone.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: transformBetween(end, part.box) },
    ], { duration: 305, easing: settle, fill: 'both' })
    const item = { clone: part.clone, element, animation }
    active.push(item)
    animation.onfinish = () => {
      element.classList.remove('shared-in-flight')
      part.clone.remove()
    }
  }
  return () => {
    for (const { clone, element, animation } of active) {
      animation.cancel()
      clone.remove()
      element.classList.remove('shared-in-flight')
    }
  }
}
