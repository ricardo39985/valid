import { useLayoutEffect, useRef, type RefObject } from 'react'
import { prefersReducedMotion, settle } from '../map/motion'

function transformBetween(from: DOMRect, to: DOMRect) {
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
}

export function animateAnchoredSurface(element: HTMLElement, anchor: HTMLElement, opening = true) {
  const box = element.getBoundingClientRect()
  const target = anchor.getBoundingClientRect()
  const dx = target.left + target.width / 2 - box.left - box.width / 2
  const dy = target.top + target.height / 2 - box.top - box.height / 2
  const cutX = Math.max(0, (box.width - target.width) / 2)
  const cutY = Math.max(0, (box.height - target.height) / 2)
  const radius = getComputedStyle(element).borderRadius
  const duration = 360
  const timing: KeyframeAnimationOptions = { duration, fill: 'both' }
  // Move a full-size surface through a shrinking window. Letterforms never scale.
  const shell = element.animate([
    { transform: `translate(${dx}px, ${dy}px)`, clipPath: `inset(${cutY}px ${cutX}px round ${target.height / 2}px)`, easing: 'cubic-bezier(.3,0,.18,1)' },
    { transform: 'translate(0, 0)', clipPath: `inset(0px 0px round ${radius})`, offset: .84 },
    { transform: 'translate(0, 0)', clipPath: `inset(-36px -36px round ${radius})` },
  ], timing)
  const surface = element.animate([{ opacity: 0 }, { opacity: 1, offset: .32 }, { opacity: 1 }], timing)
  const content = element.firstElementChild!.animate([
    { opacity: 0 }, { opacity: 0, offset: .32 }, { opacity: 1, offset: .83 }, { opacity: 1 },
  ], timing)
  const motions = [shell, surface, content]
  if (!opening) {
    for (const motion of motions) {
      motion.currentTime = duration
      motion.reverse()
    }
  }
  return motions
}

export function useAnchoredPanel(open: boolean, anchor: RefObject<HTMLButtonElement | null>) {
  const panel = useRef<HTMLDivElement>(null)
  const running = useRef<Animation[]>([])

  useLayoutEffect(() => {
    const element = panel.current
    const button = anchor.current
    if (!element || !button) return
    const stop = () => {
      for (const motion of running.current) motion.cancel()
      running.current = []
    }
    if (!element.animate || prefersReducedMotion()) {
      stop()
      element.dataset.visible = String(open)
      return
    }
    if (!open && element.dataset.visible !== 'true') return
    element.dataset.visible = 'true'

    if (!running.current.length) {
      running.current = animateAnchoredSurface(element, button, open)
    }
    for (const motion of running.current) {
      motion.playbackRate = open ? 1 : -1
      motion.play()
    }
    running.current[0].onfinish = () => {
      element.dataset.visible = String(open)
      stop()
    }
  }, [open, anchor])

  useLayoutEffect(() => () => {
    for (const motion of running.current) motion.cancel()
    running.current = []
  }, [])

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
