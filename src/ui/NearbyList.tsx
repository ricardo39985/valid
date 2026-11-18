import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Category, Destination } from '../routing/types'
import { categories } from './categories'

export default function NearbyList({ items, selected, onSelect, showGroup }: {
  items: Destination[]
  selected: Destination | null
  onSelect: (destination: Destination) => void
  showGroup: boolean
}) {
  const [focus, setFocus] = useState<Category | null>(null)
  const groups = new Map<Category, Destination[]>()
  for (const item of items) {
    const key = item.place[1]
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }

  if (!items.length) return <p className="status">No places found within this walk time.</p>
  if (!focus && !showGroup) return <ul className="nearby-overview" aria-label="Nearby category overview">
    {[...groups].map(([category, places]) => {
      const entry = categories[category]
      const closest = places.reduce((minimum, { minutes }) => Math.min(minimum, minutes), Infinity)
      return <li key={category}><button onClick={() => setFocus(category)}>
        <span className="overview-icon" style={{ '--category': entry.color } as React.CSSProperties}><entry.icon size={17} /></span>
        <span><strong>{entry.label}</strong><small>Closest · {closest} min</small></span>
        <span className="category-count">{places.length}</span><ChevronRight size={16} />
      </button></li>
    })}
  </ul>

  return <>
    {focus && <button className="nearby-back" onClick={() => setFocus(null)}><ArrowLeft size={16} />{categories[focus].label}</button>}
    <ul className="place-list" aria-label="Nearby places">
      {(focus ? groups.get(focus) ?? [] : items).map((destination, i) => {
        const { place, minutes } = destination
        const entry = categories[place[1]]
        return <li key={place[0] + i}><button aria-pressed={selected === destination} onClick={() => onSelect(destination)}>
          <span className="list-icon" style={{ color: entry.color }}><entry.icon size={18} /></span>
          <span>{place[0]}<small>{entry.label}</small></span><strong>{minutes} min</strong>
        </button></li>
      })}
    </ul>
  </>
}
