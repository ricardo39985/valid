import { Building2, LocateFixed, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as L from 'leaflet'
import { loadBasemap } from '../assets/loadAssets'
import type { Address, Coordinate, Destination, RouteSegment } from '../routing/types'
import { categories, homeColors, letters } from '../ui/categories'
import { addBasemap } from './basemap'
import { enterMapFeature, prefersReducedMotion, settle } from './motion'
import PlaceCallout from './PlaceCallout'
import { addRoutes, fadeRoutes } from './routeLayers'
import 'leaflet/dist/leaflet.css'

const initialCenter: L.LatLngTuple = [37.762, -122.433]
const sanFrancisco: L.LatLngBoundsExpression = [[37.704, -122.525], [37.837, -122.349]]
const placeIcons = Object.fromEntries(Object.entries(categories).map(([key, category]) =>
  [key, renderToStaticMarkup(<category.icon size={15} aria-hidden="true" />)]))
const buildingIcon = renderToStaticMarkup(<Building2 size={19} aria-hidden="true" />)
const toLatLng = ([longitude, latitude]: Coordinate): L.LatLngTuple => [latitude, longitude]

type Props = {
  address?: Address
  homeIndex: number
  destinations: Destination[]
  segments: RouteSegment[]
  selected: Destination | null
  onSelect: (destination: Destination) => void
  onClose: () => void
}

type Pin = { button: HTMLButtonElement; marker: L.Marker }

export default function WalkMap({ address, homeIndex, destinations, segments, selected, onSelect, onClose }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef(new Map<Destination, Pin>())
  const routes = useRef<ReturnType<typeof addRoutes> | null>(null)
  const cancelRouteExit = useRef<(() => void) | null>(null)
  const popup = useRef<L.Popup | null>(null)
  const [popupHost, setPopupHost] = useState<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [baseError, setBaseError] = useState(false)

  useLayoutEffect(() => {
    if (!container.current) return
    let instance: L.Map
    try {
      instance = L.map(container.current, {
        center: initialCenter, zoom: 12, minZoom: 11, maxZoom: 18, zoomSnap: .5,
        maxBounds: sanFrancisco, maxBoundsViscosity: .65, zoomControl: false,
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
    const host = document.createElement('div')
    setPopupHost(host)
    map.current = instance
    setReady(true)
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => instance.invalidateSize({ animate: false, debounceMoveend: true }))
    })
    observer.observe(container.current)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      cancelRouteExit.current?.()
      instance.remove()
      map.current = null
      routes.current = null
      pins.current.clear()
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
    cancelRouteExit.current?.()
    if (routes.current) cancelRouteExit.current = fadeRoutes(routes.current)
    routes.current = segments.length ? addRoutes(instance, segments) : null
  }, [ready, segments])

  useLayoutEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    instance.stop().invalidateSize({ animate: false })
    const target = address ? toLatLng(address[1]) : initialCenter
    const zoom = address ? 14.5 : 12
    const size = instance.getSize()
    const currentCenter = size.divideBy(2)
    const nextCenter = instance.latLngToContainerPoint(target)
    const reducedMotion = prefersReducedMotion()
    const fitsCurrentView = instance.getZoom() === zoom
      && Math.abs(currentCenter.x - nextCenter.x) < size.x * .7
      && Math.abs(currentCenter.y - nextCenter.y) < size.y * .7
    if (!reducedMotion && fitsCurrentView) {
      instance.panTo(target, { animate: true, duration: .36, easeLinearity: .28 })
    } else {
      instance.setView(target, zoom, { animate: false })
      const animation = reducedMotion ? undefined : container.current?.animate?.(
        [{ opacity: .52 }, { opacity: 1 }], { duration: 240, easing: settle },
      )
      return () => animation?.cancel()
    }
  }, [ready, address])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !address) return
    const building = document.createElement('div')
    building.className = 'home-marker'
    building.style.setProperty('--pin', homeColors[homeIndex])
    building.innerHTML = buildingIcon
    const letter = document.createElement('span')
    letter.textContent = letters[homeIndex]
    const label = document.createElement('span')
    label.className = 'home-map-label'
    label.textContent = address[0]
    building.append(letter, label)
    building.setAttribute('aria-label', address[0])
    building.setAttribute('role', 'img')
    const marker = L.marker(toLatLng(address[1]), {
      icon: L.divIcon({ className: 'marker-anchor', html: building, iconSize: [54, 53], iconAnchor: [27, 52] }),
      keyboard: false, interactive: false, zIndexOffset: 500,
    }).addTo(instance)
    enterMapFeature(building)
    return () => { marker.remove() }
  }, [ready, address, homeIndex])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const retained = new Set(destinations)
    for (const [destination, pin] of pins.current) {
      if (retained.has(destination)) continue
      pin.marker.remove()
      pins.current.delete(destination)
    }
    let added = 0
    for (const destination of destinations) {
      if (pins.current.has(destination)) continue
      const { place, minutes } = destination
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'place-marker'
      button.style.setProperty('--pin', categories[place[1]].color)
      button.setAttribute('aria-label', `${place[0]}, ${minutes} minute walk`)
      button.setAttribute('aria-pressed', 'false')
      button.innerHTML = placeIcons[place[1]]
      L.DomEvent.disableClickPropagation(button)
      button.addEventListener('click', () => onSelect(destination))
      const marker = L.marker(toLatLng(place[2]), {
        icon: L.divIcon({ className: 'marker-anchor', html: button, iconSize: [29, 29], iconAnchor: [14, 24] }),
        keyboard: false, interactive: false,
      }).addTo(instance)
      pins.current.set(destination, { button, marker })
      enterMapFeature(button, Math.min(added++, 8) * 11)
    }
  }, [ready, destinations, onSelect])

  useEffect(() => {
    for (const [destination, { button, marker }] of pins.current) {
      button.setAttribute('aria-pressed', String(destination === selected))
      marker.setZIndexOffset(destination === selected ? 650 : 0)
    }
  }, [ready, destinations, selected])

  const refreshPopup = useCallback(() => popup.current?.update(), [])
  useLayoutEffect(() => {
    const instance = map.current
    if (!instance || !selected || !popupHost) return
    const card = L.popup({
      className: 'pin-popup', closeButton: false, closeOnClick: false, closeOnEscapeKey: false,
      offset: L.point(0, -29), autoPanPaddingTopLeft: L.point(14, 100),
      autoPanPaddingBottomRight: L.point(14, 45), maxWidth: 268, minWidth: 208,
    }).setLatLng(toLatLng(selected.place[2])).setContent(popupHost).openOn(instance)
    popup.current = card
    instance.on('click', onClose)
    const openingPin = selected
    const element = container.current
    element?.addEventListener('keydown', dismiss)
    function dismiss(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      pins.current.get(openingPin)?.button.focus({ preventScroll: true })
      onClose()
    }
    return () => {
      instance.off('click', onClose)
      element?.removeEventListener('keydown', dismiss)
      card.remove()
      popup.current = null
    }
  }, [selected, popupHost, onClose])

  const closeCallout = useCallback(() => {
    if (selected) pins.current.get(selected)?.button.focus({ preventScroll: true })
    onClose()
  }, [onClose, selected])

  function centerMap() {
    if (address) map.current?.stop().panTo(toLatLng(address[1]), { animate: !prefersReducedMotion() })
  }

  return (
    <section className="map" aria-label="Neighborhood map">
      <div className="map-canvas" ref={container} />
      {selected && popupHost && <PlaceCallout key={selected.place.join('|')} destination={selected} host={popupHost}
        onClose={closeCallout} onLayout={refreshPopup} />}
      {failed && <p className="map-message">The map couldn’t start. Walking times are available in the list.</p>}
      {baseError && <div className="map-message" role="alert">The basemap didn’t load.
        <button className="text-button" onClick={() => { setBaseError(false); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {ready && <div className="map-buttons">
        {address && <button title="Center on address" aria-label="Center on address" onClick={centerMap}><LocateFixed size={18} /></button>}
        <button title="Zoom in" aria-label="Zoom in" onClick={() => map.current?.zoomIn(1, { animate: !prefersReducedMotion() })}><Plus size={18} /></button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => map.current?.zoomOut(1, { animate: !prefersReducedMotion() })}><Minus size={18} /></button>
      </div>}
      <a className="overture-credit" href="https://overturemaps.org/" target="_blank" rel="noreferrer">Overture Maps</a>
    </section>
  )
}
