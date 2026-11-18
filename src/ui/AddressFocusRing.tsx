import { useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion, settle } from '../map/motion'

export default function AddressFocusRing({ activeIndex, count, editing }: {
  activeIndex: number
  count: number
  editing: boolean
}) {
  const ring = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const element = ring.current
    const grid = element?.parentElement
    const card = grid?.querySelectorAll<HTMLDivElement>('.address-card-wrap')[activeIndex]
    if (!element || !grid || !card) return
    let animation: Animation | undefined
    let lastGeometry = ''

    function position(animate: boolean) {
      if (!element || !grid || !card) return
      const previous = element.getBoundingClientRect()
      const bounds = grid.getBoundingClientRect()
      const target = card.getBoundingClientRect()
      const x = target.left - bounds.left
      const y = target.top - bounds.top
      const geometry = [x, y, target.width, target.height].join(',')
      if (geometry === lastGeometry) return
      lastGeometry = geometry
      animation?.cancel()
      element.style.width = `${target.width}px`
      element.style.height = `${target.height}px`
      element.style.transform = `translate(${x}px, ${y}px)`
      if (animate && previous.width && previous.height && !prefersReducedMotion() && element.animate) {
        animation = element.animate([
          { transform: `translate(${previous.left - bounds.left}px, ${previous.top - bounds.top}px) scale(${previous.width / target.width}, ${previous.height / target.height})` },
          { transform: `translate(${x}px, ${y}px) scale(1, 1)` },
        ], { duration: 340, easing: settle })
      }
    }

    position(true)
    const observer = new ResizeObserver(() => position(false))
    observer.observe(grid)
    return () => observer.disconnect()
  }, [activeIndex, count, editing])

  return <span className="address-focus-ring" ref={ring} aria-hidden="true" />
}
