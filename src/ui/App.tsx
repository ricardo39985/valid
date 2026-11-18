import { Building2, ChevronDown, Footprints, List, Plus, Shuffle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildAddressIndex } from '../data'
import { loadCity, type City } from '../assets/loadAssets'
import WalkMap from '../map/WalkMap'
import type { Address, CategoryFilter, Destination } from '../routing/types'
import { createRouter, filterDestinations, routeSegments } from '../routing/walk'
import AddressSearch from './AddressSearch'
import { categories, homeColors, letters, sharedColor } from './categories'

const walkLimits = [5, 10, 15, 20]
const maxAddresses = 5

type Home = { address: Address; destinations: Destination[] }

export default function App() {
  const [city, setCity] = useState<City | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(false)
  const [homes, setHomes] = useState<Home[]>([])
  const [focus, setFocus] = useState(0)
  const [minutes, setMinutes] = useState(10)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [editing, setEditing] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [selected, setSelected] = useState<Destination | null>(null)
  const [message, setMessage] = useState('')

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
  const mapDestinations = useMemo(() => selected ? [selected] : destinations ?? [], [selected, destinations])
  const segments = useMemo(() => active && city
    ? routeSegments(city.network, active.address, mapDestinations) : [], [active, city, mapDestinations])

  const selectPlace = useCallback((destination: Destination) => {
    setSelected(current => current === destination ? null : destination)
  }, [])

  function pickAddress(address: Address) {
    const existing = homes.findIndex(home => home.address === address)
    setSelected(null)
    setMessage('')
    if (existing !== -1) {
      setFocus(existing)
      setEditing(false)
      return
    }
    if (!walkFrom || homes.length >= maxAddresses) return
    setHomes([...homes, { address, destinations: walkFrom(address, 20) }])
    setFocus(homes.length)
    setEditing(false)
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
    setMessage('')
  }

  function removeAddress(at: number) {
    setHomes(homes.filter((_, index) => index !== at))
    setFocus(focus > at ? focus - 1 : Math.min(focus, Math.max(0, homes.length - 2)))
    setSelected(null)
  }

  function focusAddress(at: number) {
    setFocus(at)
    setSelected(null)
  }

  const CategoryIcon = categories[category].icon

  return (
    <div className={`app ${active ? 'has-results' : 'start'}`}>
      <header className="topbar">
        <div className="wordmark"><span><Building2 size={20} /></span>Before You Sign</div>
        <div className="city-label">San Francisco<span> · </span><span className="city-region">California</span></div>
        {active && <button className="text-button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit addresses'}
        </button>}
      </header>

      <main className="workspace">
        <div className="map-region">
          <WalkMap address={active?.address} homeIndex={focus} segments={segments}
            destinations={destinations ?? []} selected={selected} onSelect={selectPlace} />
          {active && <div className="map-toolbar">
            <label className="glass-select"><CategoryIcon size={17} style={{ color: categories[category].color }} aria-hidden="true" />
              <select aria-label="Destination category" value={category} onChange={event => {
                setCategory(event.target.value as CategoryFilter)
                setSelected(null)
              }}>
                {Object.entries(categories).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
              </select><ChevronDown size={15} aria-hidden="true" /></label>
            <label className="glass-select"><Footprints size={17} aria-hidden="true" />
              <select aria-label="Maximum walking time" value={minutes} onChange={event => {
                setMinutes(Number(event.target.value))
                setSelected(null)
              }}>
                {walkLimits.map(limit => <option key={limit} value={limit}>{limit} min walk</option>)}
              </select><ChevronDown size={15} aria-hidden="true" /></label>
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
          {selected && <div className="place-preview" role="status">
            <div><strong>{selected.place[0]}</strong><span>{selected.minutes} min walk · {categories[selected.place[1]].label}</span></div>
            <button className="icon-button" aria-label="Clear selected place" onClick={() => setSelected(null)}><X size={19} /></button>
          </div>}
        </div>

        <aside className="board" aria-label={active ? 'Address comparison' : 'Find an address'}>
          {!active ? <div className="intro">
            <div className="intro-icon"><Footprints size={27} /></div>
            <h1>What’s near your next home?</h1>
            <p>See what you can walk to from any address on your San Francisco shortlist.</p>
            <AddressSearch index={index} disabled={!city} onChoose={pickAddress} />
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
                <h1>{category === 'all' ? active.address[0] : `${categories[category].label} near ${active.address[0]}`}</h1>
              </div>
              <button className="subtle-button" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
                <List size={17} />{listOpen ? 'Hide list' : 'List'}
              </button>
            </div>

            <div className={`address-cards ${homes.length === 1 ? 'single-card' : ''}`}>
              {homes.map((home, i) => {
                const results = nearby[i]
                const isActive = focus === i
                return <div className="address-card-wrap" key={home.address[0] + home.address[4]}>
                  <button type="button" className="address-card" style={{ '--home': homeColors[i] } as React.CSSProperties}
                    aria-pressed={isActive} onClick={() => focusAddress(i)}>
                    <span className="address-label"><span className="letter">{letters[i]}</span><span>{home.address[0]}</span></span>
                    <strong>{category === 'all' ? results.length : results[0] ? `${results[0].minutes} min` : 'None'}</strong>
                    <span className="address-metric">{category === 'all' ? (results.length === 1 ? 'place' : 'places') :
                      results.length ? `${results.length} nearby` : 'within range'}</span>
                    <span className="on-map">{isActive && 'On map'}</span>
                  </button>
                  {editing && <button className="remove-address icon-button" aria-label={`Remove ${home.address[0]}`}
                    onClick={() => removeAddress(i)}><X size={16} /></button>}
                </div>
              })}
            </div>

            {editing ? (homes.length < maxAddresses && <div className="edit-controls">
              <AddressSearch index={index} disabled={!city} onChoose={pickAddress} />
              <button className="surprise" onClick={surprise}><Shuffle size={16} />Add a random address</button>
              {message && <p className="status" role="status">{message}</p>}
            </div>) : homes.length < maxAddresses && <button className="add-address" onClick={() => setEditing(true)}>
              <Plus size={18} />{homes.length === 1 ? 'Compare another address' : 'Add an address'}
            </button>}

            {!destinations?.length && <p className="status">Nothing mapped within this walk time. Try a longer walk or another category.</p>}

            {listOpen && !!destinations?.length && <ul className="place-list" aria-label="Nearby places">
              {destinations.map((destination, i) => {
                const { place, minutes } = destination
                const entry = categories[place[1]]
                return <li key={place[0] + i}><button aria-pressed={selected === destination} onClick={() => selectPlace(destination)}>
                  <span className="list-icon" style={{ color: entry.color }}><entry.icon size={18} /></span>
                  <span>{place[0]}<small>{entry.label}</small></span><strong>{minutes} min</strong>
                </button></li>
              })}
            </ul>}
            <p className="method-note">Estimated walking times · Overture Maps {city?.network.release}</p>
          </>}
        </aside>
      </main>
    </div>
  )
}
