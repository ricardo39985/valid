import { ArrowLeft, ChevronRight, List, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Category, Destination } from '../routing/types'
import { prefersReducedMotion } from '../map/motion'
import { categories } from './categories'
import { captureSharedElements, carrySharedElements } from './panelMotion'

export default function NearbyList({ items, selected, onSelect, showGroup, open, onClose, onClearGroup }: {
  items: Destination[]
  selected: Destination | null
  onSelect: (destination: Destination) => void
  showGroup: boolean
  open: boolean
  onClose: () => void
  onClearGroup: () => void
}) {
  const [focus, setFocus] = useState<Category | null>(null)
  const [drilledIn, setDrilledIn] = useState(false)
  const showDetails = showGroup || drilledIn
  const back = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const selectedRow = useRef<HTMLButtonElement | null>(null)
  const pending = useRef<ReturnType<typeof captureSharedElements>>([])

  useLayoutEffect(() => {
    const target = drilledIn ? header.current : selectedRow.current
    const parts = pending.current
    pending.current = []
    const clear = open && target && parts.length ? carrySharedElements(parts, target) : undefined
    const oldParts = drilledIn && clear ? selectedRow.current?.querySelectorAll('[data-shared]') : undefined
    oldParts?.forEach(part => part.classList.add('shared-in-flight'))
    const frame = requestAnimationFrame(() => {
      if (!open) return
      if (drilledIn) back.current?.focus({ preventScroll: true })
      else selectedRow.current?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      clear?.()
      oldParts?.forEach(part => part.classList.remove('shared-in-flight'))
    }
  }, [drilledIn, open])

  const groups = new Map<Category, Destination[]>()
  for (const item of items) {
    const key = item.place[1]
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  const activeCategory = drilledIn && focus ? categories[focus] : null

  return <>
    <div className="nearby-panel-heading">
      {activeCategory && <button className="nearby-back icon-button" ref={back} aria-label="Back to nearby categories"
        onClick={() => {
          if (header.current && !prefersReducedMotion()) pending.current = captureSharedElements(header.current)
          setDrilledIn(false)
        }}><ArrowLeft size={18} /></button>}
      <div className="nearby-title" ref={header}>
        {activeCategory ? <>
          <span data-shared className="overview-icon" style={{ '--category': activeCategory.color } as React.CSSProperties}>
            <activeCategory.icon size={17} aria-hidden="true" />
          </span>
          <strong data-shared>{activeCategory.label}</strong>
        </> : <>
          <List size={17} className="nearby-title-icon" aria-hidden="true" />
          <strong>{showGroup ? 'Places in this group' : 'Nearby places'}</strong>
        </>}
      </div>
      <button className="icon-button nearby-close" aria-label="Close nearby places" onClick={onClose}><X size={17} /></button>
    </div>
    {showGroup && <div className="cluster-list-heading">
      <strong>{items.length} places</strong>
      <button className="text-button" onClick={onClearGroup}>View all places</button>
    </div>}
    {!items.length ? <p className="status">No places found within this walk time.</p> :
      <div className="nearby-navigation">
        {!showGroup && <section className="nearby-view category-view" aria-hidden={showDetails} inert={showDetails}>
          <ul className="nearby-overview" aria-label="Nearby category overview">
            {[...groups].map(([category, places]) => {
              const entry = categories[category]
              const closest = places.reduce((minimum, { minutes }) => Math.min(minimum, minutes), Infinity)
              return <li key={category}><button onClick={event => {
                selectedRow.current = event.currentTarget
                if (!prefersReducedMotion()) pending.current = captureSharedElements(event.currentTarget)
                setFocus(category)
                setDrilledIn(true)
              }}>
                <span data-shared className="overview-icon" style={{ '--category': entry.color } as React.CSSProperties}><entry.icon size={17} /></span>
                <span><strong data-shared>{entry.label}</strong><small>Closest · {closest} min</small></span>
                <span className="category-count">{places.length}</span><ChevronRight size={16} />
              </button></li>
            })}
          </ul>
        </section>}
        <section className="nearby-view detail-view" aria-hidden={!showDetails} inert={!showDetails}>
          <ul className="place-list" aria-label="Nearby places">
            {(focus ? groups.get(focus) ?? [] : showGroup ? items : []).map((destination, i) => {
              const { place, minutes } = destination
              const entry = categories[place[1]]
              return <li key={place[0] + i}><button aria-pressed={selected === destination} onClick={() => onSelect(destination)}>
                <span className="list-icon" style={{ color: entry.color }}><entry.icon size={18} /></span>
                <span>{place[0]}<small>{entry.label}</small></span><strong>{minutes} min</strong>
              </button></li>
            })}
          </ul>
        </section>
      </div>}
  </>
}
