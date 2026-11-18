import { Building2, LocateFixed, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as L from 'leaflet'
import { loadBasemap } from '../assets/loadAssets'
import type { Address, Coordinate, Destination, RouteSegment } from '../routing/types'
import { categories, homeColors, letters, sharedColor } from '../ui/categories'
import { addBasemap } from './basemap'
import 'leaflet/dist/leaflet.css'

const initialCenter: L.LatLngTuple = [37.762, -122.433]
const sanFrancisco: L.LatLngBoundsExpression = [[37.704, -122.525], [37.837, -122.349]]
const placeIcons = Object.fromEntries(Object.entries(categories).map(([key, category]) =>
  [key, renderToStaticMarkup(<category.icon size={15} aria-hidden="true" />)]))
const buildingIcon = renderToStaticMarkup(<Building2 size={19} aria-hidden="true" />)

type Props = {
  address?: Address
  homeIndex: number
  destinations: Destination[]
  segments: RouteSegment[]
  selected: Destination | null
  onSelect: (destination: Destination) => void
}

function toLatLng([longitude, latitude]: Coordinate): L.LatLngTuple {
  return [latitude, longitude]
}

function stopMarkerEvents(button: HTMLElement) {
  L.DomEvent.disableClickPropagation(button)
}

export default function WalkMap({ address, homeIndex, destinations, segments, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const buttons = useRef(new Map<Destination, HTMLButtonElement>())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [baseError, setBaseError] = useState(false)

  useEffect(() => {
    if (!container.current) return
    let instance: L.Map
    try {
      instance = L.map(container.current, {
        center: initialCenter, zoom: 12, minZoom: 11, maxZoom: 18, zoomSnap: .5,
        maxBounds: sanFrancisco, maxBoundsViscosity: .65,
        zoomControl: false, preferCanvas: true,
      })
    } catch (error) {
      console.error(error)
      setFailed(true)
      return
    }
    instance.attributionControl.setPrefix(false)
    instance.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>')
    instance.createPane('walk-outlines').style.zIndex = '405'
    instance.createPane('walk-routes').style.zIndex = '406'
    instance.createPane('street-labels').style.zIndex = '440'
    map.current = instance
    setReady(true)
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    let current = true
    loadBasemap().then(data => {
      if (current) {
        addBasemap(instance, data)
        setBaseError(false)
      }
    }).catch(error => {
      if (current) {
        console.error(error)
        setBaseError(true)
      }
    })
    return () => { current = false }
  }, [attempt, ready])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const group = L.layerGroup().addTo(instance)
    for (const { category, coordinates } of segments) {
      const points = coordinates.map(toLatLng)
      L.polyline(points, { pane: 'walk-outlines', color: '#fff', weight: 6, interactive: false }).addTo(group)
      L.polyline(points, {
        pane: 'walk-routes', color: category === 'shared' ? sharedColor : categories[category].color,
        weight: 3, interactive: false,
      }).addTo(group)
    }
    return () => { group.remove() }
  }, [ready, segments])

  useEffect(() => {
    if (!ready || !map.current || !address) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = toLatLng(address[1])
    if (reducedMotion) map.current.setView(target, 14.5, { animate: false })
    else map.current.flyTo(target, 14.5, { duration: .65 })
  }, [ready, address])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !address) return
    const group = L.layerGroup().addTo(instance)
    const building = document.createElement('div')
    building.className = 'home-marker'
    building.style.setProperty('--pin', homeColors[homeIndex])
    building.innerHTML = buildingIcon
    const letter = document.createElement('span')
    letter.textContent = letters[homeIndex]
    building.append(letter)
    building.setAttribute('aria-label', address[0])
    building.setAttribute('role', 'img')
    L.marker(toLatLng(address[1]), {
      icon: L.divIcon({ className: 'marker-anchor', html: building, iconSize: [48, 47], iconAnchor: [24, 47] }),
      keyboard: false, interactive: false, zIndexOffset: 500,
    }).addTo(group)

    for (const destination of destinations) {
      const { place, minutes } = destination
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'place-marker'
      button.style.setProperty('--pin', categories[place[1]].color)
      button.setAttribute('aria-label', `${place[0]}, ${minutes} minute walk`)
      button.title = `${place[0]} · ${minutes} min`
      button.innerHTML = placeIcons[place[1]]
      stopMarkerEvents(button)
      button.addEventListener('click', () => onSelect(destination))
      buttons.current.set(destination, button)
      L.marker(toLatLng(place[2]), {
        icon: L.divIcon({ className: 'marker-anchor', html: button, iconSize: [29, 29], iconAnchor: [14, 24] }),
        keyboard: false, interactive: false,
      }).addTo(group)
    }
    return () => {
      group.remove()
      buttons.current.clear()
    }
  }, [ready, address, homeIndex, destinations, onSelect])

  useEffect(() => {
    for (const [destination, button] of buttons.current) {
      button.setAttribute('aria-pressed', String(destination === selected))
    }
  }, [ready, address, destinations, selected])

  function centerMap() {
    if (!address || !map.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.current.panTo(toLatLng(address[1]), { animate: !reducedMotion })
  }

  return (
    <section className="map" aria-label="Neighborhood map">
      <div className="map-canvas" ref={container} />
      {failed && <p className="map-message">The map couldn’t start. Walking times are available in the list.</p>}
      {baseError && <div className="map-message" role="alert">The basemap didn’t load.
        <button className="text-button" onClick={() => { setBaseError(false); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {ready && <div className="map-buttons">
        {address && <button title="Center on address" aria-label="Center on address" onClick={centerMap}><LocateFixed size={18} /></button>}
        <button title="Zoom in" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={18} /></button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={18} /></button>
      </div>}
      <a className="overture-credit" href="https://overturemaps.org/" target="_blank" rel="noreferrer">Overture Maps</a>
    </section>
  )
}
