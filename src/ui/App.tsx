import { Footprints, List, MapPin, Pencil, Shuffle, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadCity, type City } from '../assets/loadAssets'
import WalkMap from '../map/WalkMap'
import type { Address, Category, CategoryFilter, Destination } from '../routing/types'
import { createRouter, filterDestinations, routeSegments } from '../routing/walk'
import AddressSearch from './AddressSearch'
import Onboarding from './Onboarding'
import SearchTools from './SearchTools'
import { readPreference, savePreference } from './preferences'
import LaunchScene from './LaunchScene'
import NearbyList from './NearbyList'
import FilterMenu from './FilterMenu'
import { useAnchoredPanel } from './panelMotion'
import { flushSync } from 'react-dom'
import RemoveAddressDialog from './RemoveAddressDialog'
import SheetHandle from './SheetHandle'
import { prefersReducedMotion } from '../map/motion'
import { categories, homeColors, letters, sharedColor } from './categories'

const walkLimits = [5, 10, 15, 20]
const categoryOptions = (Object.keys(categories) as CategoryFilter[]).map(value => ({ value, ...categories[value] }))
const walkOptions = walkLimits.map(value => ({ value, label: `${value} min walk`, icon: Footprints }))
const maxAddresses = 5
const emptyIndex: City['index'] = []
const noDestinations: Destination[] = []

type Home = { address: Address; destinations: Destination[] }

export default function App() {
  const [launching, setLaunching] = useState(() => !prefersReducedMotion() && typeof Element.prototype.animate === 'function')
  const [tour, setTour] = useState(() => readPreference('tour') !== 'seen')
  const searchRow = useRef<HTMLDivElement>(null)
  function finishTour() {
    savePreference('tour', 'seen')
    setTour(false)
    requestAnimationFrame(() => {
      const field = searchRow.current?.querySelector<HTMLInputElement>('input:enabled')
      const target = field ?? searchRow.current?.querySelector<HTMLButtonElement>('.more-tools')
      target?.focus({ preventScroll: true })
    })
  }
  const finishLaunch = useCallback(() => setLaunching(false), [])
  const [city, setCity] = useState<City | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(false)
  const [homes, setHomes] = useState<Home[]>([])
  const [focus, setFocus] = useState(0)
  const [minutes, setMinutes] = useState(10)
  const [openFilter, setOpenFilter] = useState<'category' | 'walk' | null>(null)
  const [toolbarCategory, setCategory] = useState<CategoryFilter>('all')
  const [listCategory, setListCategory] = useState<Category | null>(null)
  const category = listCategory ?? toolbarCategory
  const [editing, setEditing] = useState<number | null>(null)
  const [cluster, setCluster] = useState<Destination[] | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [listRevision, setListRevision] = useState(0)
  const [selected, setSelected] = useState<Destination | null>(null)
  const [message, setMessage] = useState('')
  const [removal, setRemoval] = useState<Address | null>(null)
  const addressList = useRef<HTMLUListElement>(null)

  const listButton = useRef<HTMLButtonElement>(null)
  const nearbyPanel = useAnchoredPanel(listOpen, listButton)

  const [collapsed, setCollapsed] = useState(false)
  const sheet = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = sheet.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      element.parentElement?.style.setProperty('--board-height', element.offsetHeight + 'px')
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const list = addressList.current
    const row = list?.children[focus]
    if (!list || !row || list.scrollHeight <= list.clientHeight) return
    const bounds = list.getBoundingClientRect()
    const entry = row.getBoundingClientRect()
    const offset = entry.top < bounds.top ? entry.top - bounds.top : Math.max(0, entry.bottom - bounds.bottom)
    if (offset) list.scrollBy({ top: offset, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
  }, [focus, homes.length])

  const [loadComparison, setLoadComparison] = useState(false)
  useEffect(() => {
    if (!launching && !tour) setLoadComparison(true)
  }, [launching, tour])
  useEffect(() => {
    if (!loadComparison) return
    let current = true
    loadCity().then(data => { if (current) setCity(data) })
      .catch(error => { if (current) { console.error(error); setError(true) } })
    return () => { current = false }
  }, [attempt, loadComparison])

  const index = city?.index ?? emptyIndex
  const walkFrom = useMemo(() => city && createRouter(city.network), [city])
  const savedLocations = useMemo(() => homes.map(home => home.address[1]), [homes])
  const active = homes[focus]
  const nearby = useMemo(() => homes.map(home =>
    filterDestinations(home.destinations, category, minutes)), [homes, category, minutes])
  const destinations = nearby[focus]
  const overview = useMemo(() => active
    ? filterDestinations(active.destinations, toolbarCategory, minutes) : noDestinations,
    [active, toolbarCategory, minutes])
  const mapDestinations = useMemo(() => selected ? [selected] : destinations ?? noDestinations, [selected, destinations])
  const segments = useMemo(() => active && city
    ? routeSegments(city.network, active.address, mapDestinations) : [], [active, city, mapDestinations])

  const selectPlace = useCallback((destination: Destination) => {
    setSelected(current => current === destination ? null : destination)
  }, [])

  const showCluster = useCallback((items: Destination[]) => {
    setCollapsed(false)
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
    setCollapsed(false)
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

  async function removeAddress(address: Address) {
    const at = homes.findIndex(home => home.address === address)
    const list = addressList.current
    if (at < 0 || !list) { setRemoval(null); return }
    const rows = Array.from(list.children) as HTMLElement[]
    const row = rows[at]
    const reduced = prefersReducedMotion()
    // Keep the comparison inert until the exit and the state update agree.
    const duration = reduced ? 70 : 180
    await row.animate([{ opacity: 1, transform: 'none' },
      { opacity: 0, transform: reduced ? 'none' : 'translateX(-12px)' }],
      { duration, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {})
    const board = sheet.current!
    const boardTop = board.getBoundingClientRect().top
    const positions = rows.map(item => item.getBoundingClientRect().top)
    flushSync(() => {
      if (homes.length === 1) setListOpen(false)
      setEditing(null)
      setCluster(null)
      setHomes(homes.filter(home => home.address !== address))
      setFocus(focus > at ? focus - 1 : Math.min(focus, Math.max(0, homes.length - 2)))
      setSelected(null)
      setRemoval(null)
    })
    if (!reduced) {
      const boardShift = boardTop - board.getBoundingClientRect().top
      const timing = { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }
      if (boardShift) board.animate([{ translate: `0 ${boardShift}px` }, { translate: '0 0' }], timing)
      rows.forEach((item, i) => {
        if (!item.isConnected) return
        const delta = positions[i] - item.getBoundingClientRect().top
        if (delta) item.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], timing)
      })
    }
    const next = list.children[Math.min(at, list.children.length - 1)]
    const target = next?.querySelector<HTMLButtonElement>('.shortlist-address') ?? searchRow.current?.querySelector('input')
    target?.focus({ preventScroll: true })
  }

  function focusAddress(at: number) {
    setCluster(null)
    setFocus(at)
    setSelected(null)
  }

  return (
    <div className={`app ${active ? 'has-results' : 'empty-map'} ${listOpen ? 'list-open' : ''}`}>
      <main className="workspace" data-sheet-hidden={collapsed || undefined}>
        <div className="map-region">
          <WalkMap savedLocations={savedLocations} address={active?.address} homeIndex={focus} segments={segments}
            destinations={mapDestinations} framing={destinations ?? noDestinations} selected={selected}
            onCluster={showCluster} onSelect={selectPlace} onClose={closePlace} />
          <div className="map-chrome">
            <div className="search-row" ref={searchRow}>
              <AddressSearch index={index} loading={!city && !error} disabled={error || homes.length >= maxAddresses} onChoose={pickAddress}
                placeholder={homes.length >= maxAddresses ? 'Five addresses added' : active ? 'Add a San Francisco address' : 'Enter your first address'} />
              <SearchTools onTour={() => { setLaunching(false); setTour(true) }} />
            </div>
            <div className="map-toolbar">
              <FilterMenu label="Destination category" value={category} options={categoryOptions}
                open={openFilter === 'category'} onOpen={open => setOpenFilter(current => open ? 'category' : current === 'category' ? null : current)}
                onChoose={value => { setCategory(value); setListCategory(null); setSelected(null); setCluster(null) }} />
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
          <SheetHandle collapsed={collapsed} onChange={next => { setCollapsed(next); if (next) setListOpen(false) }} />
          <div id="sheet-content" inert={collapsed || !!removal}>
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
            <div className="board-heading">
              <div>
                {homes.length > 1 && <p className="comparison-label">Compare {homes.length} addresses</p>}
                <h1 key={active.address[0] + category} className="focus-heading"><span className="desktop-only">{homes.length > 1 ? 'Compare addresses' : active.address[0]}</span><span className="mobile-only">{category === 'all' ? active.address[0] : `${categories[category].label} near ${active.address[0]}`}</span></h1>
                <span className="board-subtitle desktop-only">{category === 'all' ? 'Places' : categories[category].label} within a {minutes}-minute walk</span>
              </div>
              <button ref={listButton} className="subtle-button nearby-trigger" aria-expanded={listOpen} aria-controls="nearby-panel"
                onClick={toggleList}>
                <List size={17} /><span className="mobile-only">List</span><span className="desktop-only">Nearby places</span>
              </button>
            </div>

            <div id="nearby-panel" ref={nearbyPanel} className="list-drawer" aria-hidden={!listOpen} inert={!listOpen}
              onKeyDown={event => {
                if (event.key === 'Escape') { setListOpen(false); listButton.current?.focus({ preventScroll: true }) }
              }}>
              <div className="list-drawer-content">
                <NearbyList key={active.address[0] + toolbarCategory + minutes + listRevision + (cluster ? cluster.map(item => item.place[0]).join() : "")}
                  focus={cluster ? null : listCategory}
                  onFocusCategory={value => { setListCategory(value); setSelected(null) }}
                  items={cluster ?? overview} selected={selected} showGroup={!!cluster} open={listOpen}
                  onClose={() => { setListOpen(false); listButton.current?.focus({ preventScroll: true }) }}
                  onClearGroup={() => setCluster(null)}
                  onSelect={destination => {
                    selectPlace(destination)
                    if (window.matchMedia('(max-width: 860px)').matches) setListOpen(false)
                  }} />
              </div>
            </div>
            <ul className="shortlist" aria-label="Addresses to compare" ref={addressList}>
              {homes.map((home, i) => {
                const results = nearby[i]
                const isActive = focus === i
                return <li className="shortlist-row" key={home.address[0] + home.address[4]} style={{ '--home': homeColors[i] } as React.CSSProperties}>
                  <button type="button" className="shortlist-address" aria-pressed={isActive} onClick={() => focusAddress(i)}>
                    <span className="shortlist-letter">{letters[i]}</span>
                    <span className="shortlist-name">{home.address[0]}
                      {isActive && <small className="shortlist-current"><MapPin size={11} />On map</small>}
                    </span>
                    <span className="shortlist-metric"><strong className="result-number" key={category + minutes}>{category === 'all' ? results.length : results[0] ? `${results[0].minutes} min` : 'None'}</strong>
                      <small>{category === 'all' ? (results.length === 1 ? 'place' : 'places') : results.length ? `${results.length} nearby` : 'within range'}</small>
                    </span>
                  </button>
                  <div className="row-actions">
                    <button type="button" aria-label={`Edit ${home.address[0]}`} onClick={() => {
                      focusAddress(i)
                      setListOpen(false)
                      setMessage('')
                      setEditing(i)
                    }}><Pencil size={14} /></button>
                    <button type="button" aria-label={`Remove ${home.address[0]}`} onClick={() => setRemoval(home.address)}><X size={16} /></button>
                  </div>
                </li>
              })}
            </ul>

            {!destinations?.length && !listOpen && <p className="status">Nothing mapped within this walk time. Try a longer walk or another category.</p>}
            <p className="method-note">Estimated walking times · Overture Maps {city?.network.release}</p>
          </>}
          </div>
        </aside>
        {launching && !tour && <LaunchScene onFinish={finishLaunch} />}
      </main>
      {removal && <RemoveAddressDialog address={removal[0]} onDismiss={() => {
        flushSync(() => setRemoval(null))
        const index = homes.findIndex(home => home.address === removal)
        addressList.current?.children[index]?.querySelector<HTMLButtonElement>('.row-actions button:last-child')?.focus({ preventScroll: true })
      }} onRemove={() => void removeAddress(removal)} />}
      {tour && <Onboarding intro={launching} onIntroDone={finishLaunch} onDone={finishTour} />}
    </div>
  )
}
