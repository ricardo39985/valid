import { Footprints, X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Destination } from '../routing/types'
import { categories } from '../ui/categories'

export default function PlaceCallout({ destination, host, onClose, onLayout }: {
  destination: Destination
  host: HTMLElement
  onClose: () => void
  onLayout: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const category = categories[destination.place[1]]
  useLayoutEffect(() => {
    onLayout()
    const observer = new ResizeObserver(onLayout)
    if (card.current) observer.observe(card.current)
    return () => observer.disconnect()
  }, [destination, onLayout])

  return createPortal(
    <div className="place-callout" ref={card} role="region" aria-label={destination.place[0]}
      style={{ '--place': category.color } as React.CSSProperties}>
      <div className="place-callout-top">
        <span className="place-callout-icon"><category.icon size={17} aria-hidden="true" /></span>
        <div><div className="place-category">{category.label}</div><strong>{destination.place[0]}</strong></div>
        <button className="icon-button" type="button" aria-label="Close place details" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="place-walk"><Footprints size={15} aria-hidden="true" /><span><b>{destination.minutes} min</b> walk</span></div>
    </div>, host,
  )
}
