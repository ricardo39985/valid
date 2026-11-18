import { Footprints, List, MapPin, Pencil, Shuffle, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildAddressIndex } from '../data'
import { loadCity, type City } from '../assets/loadAssets'
import WalkMap from '../map/WalkMap'
import type { Address, CategoryFilter, Destination } from '../routing/types'
import { createRouter, filterDestinations, routeSegments } from '../routing/walk'
import AddressSearch from './AddressSearch'
import AddressFocusRing from './AddressFocusRing'
import NearbyList from './NearbyList'
import FilterMenu from './FilterMenu'
import { useAnchoredPanel } from './panelMotion'
import { prefersReducedMotion, settle } from '../map/motion'
import { categories, homeColors, letters, sharedColor } from './categories'

const walkLimits = [5, 10, 15, 20]
const categoryOptions = (Object.keys(categories) as CategoryFilter[]).map(value => ({ value, ...categories[value] }))
const walkOptions = walkLimits.map(value => ({ value, label: `${value} min walk`, icon: Footprints }))
const maxAddresses = 5
const noDestinations: Destination[] = []

type Home = { address: Address; destinations: Destination[] }

export default function App() {
  const [city, setCity] = useState<City | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(false)
  const [homes, setHomes] = useState<Home[]>([])
  const [focus, setFocus] = useState(0)
  const [minutes, setMinutes] = useState(10)
  const [openFilter, setOpenFilter] = useState<'category' | 'walk' | null>(null)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [editing, setEditing] = useState<number | null>(null)
  const [cluster, setCluster] = useState<Destination[] | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [listRevision, setListRevision] = useState(0)
  const [selected, setSelected] = useState<Destination | null>(null)
  const [message, setMessage] = useState('')
  const rail = useRef<HTMLDivElement>(null)

  const listButton = useRef<HTMLButtonElement>(null)
  const nearbyPanel = useAnchoredPanel(listOpen, listButton)

  const sheet = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = sheet.current
    if (!element) return
    let previousTop = element.offsetTop
    let animation: Animation | undefined
    const observer = new ResizeObserver(() => {
      const next = element.offsetTop
      const delta = previousTop - next
      previousTop = next
      if (!delta || prefersReducedMotion() || !element.animate) return
      animation?.cancel()
      animation = element.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: 300, easing: settle })
    })
    observer.observe(element)
    return () => { observer.disconnect(); animation?.cancel() }
  }, [])

  useLayoutEffect(() => {
    const container = rail.current
    const card = container?.querySelectorAll('.address-card-wrap')[focus]
    if (!container || !card || container.scrollWidth <= container.clientWidth) return
    const offset = card.getBoundingClientRect().left - container.getBoundingClientRect().left
    if (offset < 0 || offset + card.clientWidth > container.clientWidth) {
      container.scrollBy({ left: offset - 10, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
    }
  }, [focus, homes.length])

  useEffect(() => {
    let current = true
    loadCity().then(data => { if (current) setCity(data) })
      .catch(error => { if (current) { console.error(error); setError(true) } })
    return () => { current = false }
  }, [attempt])

  const index = useMemo(() => buildAddressIndex(city?.addresses ?? []), [city])
  const walkFrom = useMemo(() => city && createRouter(city.network), [city])
  const active = homes[focus]
  const nearby = useMemo(() => homes.map(home =>
    filterDestinations(home.destinations, category, minutes)), [homes, category, minutes])
  const destinations = nearby[focus]
  const mapDestinations = useMemo(() => selected ? [selected] : destinations ?? noDestinations, [selected, destinations])
  const segments = useMemo(() => active && city
    ? routeSegments(city.network, active.address, mapDestinations) : [], [active, city, mapDestinations])

  const selectPlace = useCallback((destination: Destination) => {
    setSelected(current => current === destination ? null : destination)
  }, [])

  const showCluster = useCallback((items: Destination[]) => {
    setCluster(items)
    setListOpen(true)
  }, [])

  function toggleList() {
    setCluster(null)
    if (!listOpen) setListRevision(value => value + 1)
    setListOpen(!listOpen)
  }

  const closePlace = useCallback(() => setSelected(null), [])

  function pickAddress(address: Address) {
    const existing = homes.findIndex(home => home.address === address)
    setSelected(null)
    setCluster(null)
    setMessage('')
    if (existing !== -1) {
      setFocus(existing)
      setEditing(null)
      return
    }
    if (!walkFrom || homes.length >= maxAddresses) return
    setHomes([...homes, { address, destinations: walkFrom(address, 20) }])
    setFocus(homes.length)
    setEditing(null)
  }

  function replaceAddress(address: Address) {
    if (editing === null || !walkFrom) return
    if (homes.some((home, i) => i !== editing && home.address === address)) {
      setMessage('That address is already in your comparison.')
      return
    }
    setHomes(homes.map((home, i) => i === editing ? { address, destinations: walkFrom(address, 20) } : home))
    setFocus(editing)
    setEditing(null)
    setMessage('')
    setCluster(null)
    setSelected(null)
  }

  function randomHome(excluded: Address[]) {
    if (!city || !walkFrom) return null
    let fallback: Home | null = null
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const address = city.addresses[Math.floor(Math.random() * city.addresses.length)]
      if (!address || excluded.includes(address)) continue
      const destinations = walkFrom(address, 20)
      if (!destinations.length) continue
      fallback = { address, destinations }
      if (destinations.filter(place => place.minutes <= 10).length >= 3) return fallback
    }
    return fallback
  }

  function surprise() {
    if (homes.length >= maxAddresses) return
    const first = randomHome(homes.map(home => home.address))
    if (!first) { setMessage('Could not find a random address. Try again or search by street.'); return }
    if (homes.length) {
      pickAddress(first.address)
      return
    }
    const second = randomHome([first.address])
    setHomes(second ? [first, second] : [first])
    setFocus(0)
    setSelected(null)
    setCluster(null)
    setMessage('')
  }

  function removeAddress(at: number) {
    if (homes.length === 1) setListOpen(false)
    setEditing(null)
    setCluster(null)
    setHomes(homes.filter((_, index) => index !== at))
    setFocus(focus > at ? focus - 1 : Math.min(focus, Math.max(0, homes.length - 2)))
    setSelected(null)
  }

  function focusAddress(at: number) {
    setCluster(null)
    setFocus(at)
    setSelected(null)
  }

  return (
    <div className={`app ${active ? 'has-results' : 'empty-map'} ${listOpen ? 'list-open' : ''}`}>
      <main className="workspace">
        <div className="map-region">
          <WalkMap address={active?.address} homeIndex={focus} segments={segments}
            destinations={mapDestinations} framing={destinations ?? noDestinations} selected={selected}
            onCluster={showCluster} onSelect={selectPlace} onClose={closePlace} />
          <div className="map-chrome">
            <AddressSearch index={index} disabled={!city || homes.length >= maxAddresses} onChoose={pickAddress}
              placeholder={homes.length >= maxAddresses ? 'Five addresses added' : active ? 'Add a San Francisco address' : 'Enter your first address'} />
            <div className="map-toolbar">
              <FilterMenu label="Destination category" value={category} options={categoryOptions}
                open={openFilter === 'category'} onOpen={open => setOpenFilter(current => open ? 'category' : current === 'category' ? null : current)}
                onChoose={value => { setCategory(value); setSelected(null); setCluster(null) }} />
              <FilterMenu label="Maximum walking time" value={minutes} options={walkOptions}
                open={openFilter === 'walk'} onOpen={open => setOpenFilter(current => open ? 'walk' : current === 'walk' ? null : current)}
                onChoose={value => { setMinutes(value); setSelected(null); setCluster(null) }} />
            </div>
          </div>
          {editing !== null && homes[editing] && <div className="map-editor" role="dialog" aria-label="Edit address"
            onKeyDown={event => { if (event.key === 'Escape') { setEditing(null); setMessage('') } }}>
            <div className="editor-title"><strong>Edit {homes[editing].address[0]}</strong>
              <button className="icon-button" aria-label="Close address editor" onClick={() => { setEditing(null); setMessage('') }}><X size={18} /></button>
            </div>
            <AddressSearch key={editing} initialValue={homes[editing].address[0]} autoFocus
              index={index} disabled={!city} onChoose={replaceAddress} />
            {message && <p role="status" className="status">{message}</p>}
          </div>}
          {active && !selected && <div className="map-legend" aria-label="Map legend">
            {category === 'all' && <>
              <span><i className="legend-line" style={{ background: sharedColor }} />Shared path</span>
              {(Object.keys(categories) as CategoryFilter[]).filter(key => key !== 'all').map(key => {
                const entry = categories[key]
                return <span key={key}><entry.icon size={13} style={{ color: entry.color }} />{entry.label}</span>
              })}
            </>}
          </div>}

        </div>

        <aside className="board" ref={sheet} aria-label={active ? 'Address comparison' : 'Find an address'}>
          {!active ? <div className="empty-board">
            <h1>Enter your first address</h1>
            <button className="surprise" disabled={!city} onClick={surprise}><Shuffle size={17} />Surprise me</button>
            {!city && !error && <p className="status" role="status">Loading San Francisco addresses…</p>}
            {error && <div className="load-error" role="alert">The city data didn’t load. <button className="text-button" onClick={() => {
              setError(false)
              setAttempt(value => value + 1)
            }}>Try again</button></div>}
            {message && <p role="status" className="status">{message}</p>}
          </div> : <>
            <button className="sheet-handle" type="button" aria-label={listOpen ? 'Collapse nearby places' : 'Expand nearby places'}
              aria-expanded={listOpen} aria-controls="nearby-panel" onClick={toggleList}><span /></button>
            <div className="board-heading">
              <div>
                {homes.length > 1 && <p className="comparison-label">Compare {homes.length} addresses</p>}
                <h1 key={active.address[0] + category} className="focus-heading">{category === 'all' ? active.address[0] : `${categories[category].label} near ${active.address[0]}`}</h1>
              </div>
              <button ref={listButton} className="subtle-button nearby-trigger" aria-expanded={listOpen} aria-controls="nearby-panel"
                onClick={toggleList}>
                <List size={17} />List
              </button>
            </div>

            <div id="nearby-panel" ref={nearbyPanel} className="list-drawer" aria-hidden={!listOpen} inert={!listOpen}
              onKeyDown={event => {
                if (event.key === 'Escape') { setListOpen(false); listButton.current?.focus({ preventScroll: true }) }
              }}>
              <div className="list-drawer-content">
                <NearbyList key={active.address[0] + category + minutes + listRevision + (cluster ? cluster.map(item => item.place[0]).join() : "")}
                  items={cluster ?? destinations ?? noDestinations} selected={selected} showGroup={!!cluster} open={listOpen}
                  onClose={() => { setListOpen(false); listButton.current?.focus({ preventScroll: true }) }}
                  onClearGroup={() => setCluster(null)}
                  onSelect={destination => {
                    selectPlace(destination)
                    if (window.matchMedia('(max-width: 860px)').matches) setListOpen(false)
                  }} />
              </div>
            </div>
            <div className="address-rail" ref={rail}><div className={`address-cards ${homes.length === 1 ? 'single-card' : ''}`}
              style={{ '--focus-color': homeColors[focus] } as React.CSSProperties}>
              <AddressFocusRing activeIndex={focus} count={homes.length} editing={editing !== null} />
              {homes.map((home, i) => {
                const results = nearby[i]
                const isActive = focus === i
                return <div className="address-card-wrap" key={home.address[0] + home.address[4]}>
                  <button type="button" className="address-card" style={{ '--home': homeColors[i] } as React.CSSProperties}
                    aria-pressed={isActive} onClick={() => focusAddress(i)}>
                    <span className="address-label"><span className="letter">{letters[i]}</span><span>{home.address[0]}</span></span>
                    <strong key={category + minutes} className="result-number">{category === 'all' ? results.length : results[0] ? `${results[0].minutes} min` : 'None'}</strong>
                    <span className="address-metric">{category === 'all' ? (results.length === 1 ? 'place' : 'places') :
                      results.length ? `${results.length} nearby` : 'within range'}</span>
                    <span className="on-map">{isActive && <><MapPin size={12} />On map</>}</span>
                  </button>
                  <div className="card-actions">
                    <button type="button" aria-label={`Edit ${home.address[0]}`} onClick={() => {
                      focusAddress(i)
                      setListOpen(false)
                      setMessage('')
                      setEditing(i)
                    }}><Pencil size={14} /></button>
                    <button type="button" aria-label={`Remove ${home.address[0]}`} onClick={() => removeAddress(i)}><X size={16} /></button>
                  </div>
                </div>
              })}
            </div></div>

            {!destinations?.length && !listOpen && <p className="status">Nothing mapped within this walk time. Try a longer walk or another category.</p>}
            <p className="method-note">Estimated walking times · Overture Maps {city?.network.release}</p>
          </>}
        </aside>
      </main>
    </div>
  )
}
