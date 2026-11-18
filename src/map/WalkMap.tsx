import { Building2, LocateFixed, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import { loadBasemap, loadRegion } from '../assets/loadAssets'
import type { Address, Coordinate, Destination, RouteSegment } from '../routing/types'
import { categories, homeColors, letters } from '../ui/categories'
import { addBasemap, addRegion } from './basemap'
import { enterMapFeature, prefersReducedMotion, settle } from './motion'
import { clusterPins } from './cluster'
import PlaceCallout from './PlaceCallout'
import { addRoutes, fadeRoutes } from './routeLayers'
import 'leaflet/dist/leaflet.css'

const cityBounds: L.LatLngBoundsExpression = [[37.704, -122.514], [37.833, -122.354]]
const regionBounds: L.LatLngBoundsExpression = [[37.50, -122.70], [38.00, -122.10]]

function showCity(map: L.Map, animate = false) {
  map.fitBounds(cityBounds, {
    paddingTopLeft: [16, 116], paddingBottomRight: [16, 85], maxZoom: 12.5, animate,
  })
}

function markerIcon(name: string, size: number) {
  const ns = 'http://www.w3.org/2000/svg'
  const icon = document.createElementNS(ns, 'svg')
  icon.setAttribute('width', String(size))
  icon.setAttribute('height', String(size))
  const use = document.createElementNS(ns, 'use')
  use.setAttribute('href', '#map-icon-' + name)
  icon.append(use)
  return icon
}
const toLatLng = ([longitude, latitude]: Coordinate): L.LatLngTuple => [latitude, longitude]

type Props = {
  address?: Address
  homeIndex: number
  destinations: Destination[]
  segments: RouteSegment[]
  framing: Destination[]
  onCluster: (destinations: Destination[]) => void
  selected: Destination | null
  onSelect: (destination: Destination) => void
  onClose: () => void
}

type Pin = { button: HTMLButtonElement; marker: L.Marker }

export default function WalkMap({ address, homeIndex, destinations, segments, framing, onCluster, selected, onSelect, onClose }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef(new Map<Destination, Pin>())
  const frameDestinations = useRef(framing)
  useLayoutEffect(() => { frameDestinations.current = framing }, [framing])
  const [sceneAddress, setSceneAddress] = useState(address)
  const currentAddress = useRef(address)
  useLayoutEffect(() => { currentAddress.current = address }, [address])
  const lastScene = useRef({ address, homeIndex, destinations, segments })
  const currentScene = { address, homeIndex, destinations, segments }
  const displayed = sceneAddress === address ? currentScene : lastScene.current
  const sceneReady = sceneAddress === address
  useLayoutEffect(() => {
    if (sceneReady) lastScene.current = { address, homeIndex, destinations, segments }
  }, [sceneReady, address, homeIndex, destinations, segments])
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
        minZoom: 10, maxZoom: 18, zoomSnap: .5,
        maxBounds: regionBounds, maxBoundsViscosity: .65, zoomControl: false, renderer: L.svg({ padding: .45 }),
      })
    } catch (error) {
      console.error(error)
      setFailed(true)
      return
    }
    showCity(instance)
    instance.createPane('regional-context').style.zIndex = '390'
    instance.attributionControl.setPrefix(false)
    instance.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>')
    const outlinePane = instance.createPane('walk-outlines')
    outlinePane.style.zIndex = '405'
    const routePane = instance.createPane('walk-routes')
    routePane.style.zIndex = '406'
    for (const pane of [outlinePane, routePane, instance.getPane('markerPane')]) pane?.classList.add('scene-pane')
    instance.createPane('street-labels').style.zIndex = '440'
    const host = document.createElement('div')
    setPopupHost(host)
    map.current = instance
    setReady(true)
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        instance.invalidateSize({ animate: false, debounceMoveend: true })
        if (!currentAddress.current) showCity(instance)
      })
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
    let loadingDetail = false
    function detail() {
      if (!instance || loadingDetail || instance.getZoom() < 13 || !instance.getBounds().intersects(cityBounds)) return
      loadingDetail = true
      loadBasemap().then(data => {
        if (current) detailCleanup = addBasemap(instance, data)
      }).catch(error => { if (current) { console.error(error); setBaseError(true) } })
    }
    let region: L.Layer | undefined
    let detailCleanup: (() => void) | undefined
    loadRegion().then(data => {
      if (current) region = addRegion(instance, data)
    }).catch(error => { if (current) { console.error(error); setBaseError(true) } })
    setBaseError(false)
    detail()
    instance.on('moveend', detail)
    return () => {
      current = false
      instance.off('moveend', detail)
      region?.remove()
      detailCleanup?.()
    }
  }, [attempt, ready])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    cancelRouteExit.current?.()
    if (routes.current) cancelRouteExit.current = fadeRoutes(routes.current)
    routes.current = displayed.segments.length ? addRoutes(instance, displayed.segments) : null
  }, [ready, displayed.segments])

  const fitAddress = useCallback(() => {
    const instance = map.current
    if (!address || !instance) return
    instance.stop().invalidateSize({ animate: false })
    const points = [toLatLng(address[1]), ...frameDestinations.current.map(item => toLatLng(item.place[2]))]
    const bounds = L.latLngBounds(points)
    const onPhone = window.matchMedia('(max-width: 860px)').matches
    const height = instance.getSize().y
    const options: L.FitBoundsOptions = {
      maxZoom: 16, paddingTopLeft: L.point(30, 150),
      paddingBottomRight: L.point(52, onPhone ? Math.min(248, Math.floor(height * .37)) : 72),
      animate: !prefersReducedMotion(), duration: .72,
    }
    if (options.animate) instance.flyToBounds(bounds, options)
    else instance.fitBounds(bounds, options)
  }, [address])

  useLayoutEffect(() => {
    const element = container.current
    if (!ready || !element) return
    if (address) fitAddress()
    else if (map.current) showCity(map.current, !prefersReducedMotion())

    if (prefersReducedMotion()) {
      setSceneAddress(address)
      return
    }

    // Change map annotations while their panes are transparent, then reveal
    // them in place as the camera approaches the new neighborhood.
    element.classList.add('scene-out')
    const replace = window.setTimeout(() => setSceneAddress(address), 170)
    const reveal = window.setTimeout(() => element.classList.remove('scene-out'), address ? 480 : 250)
    return () => {
      window.clearTimeout(replace)
      window.clearTimeout(reveal)
      element.classList.remove('scene-out')
    }
  }, [ready, address, fitAddress])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !displayed.address) return
    const building = document.createElement('div')
    building.className = 'home-marker'
    building.style.setProperty('--pin', homeColors[displayed.homeIndex])
    building.append(markerIcon('home', 19))
    const letter = document.createElement('span')
    letter.textContent = letters[displayed.homeIndex]
    const label = document.createElement('span')
    label.className = 'home-map-label'
    label.textContent = displayed.address[0]
    building.append(letter, label)
    building.setAttribute('aria-label', displayed.address[0])
    building.setAttribute('role', 'img')
    const marker = L.marker(toLatLng(displayed.address[1]), {
      icon: L.divIcon({ className: 'marker-anchor', html: building, iconSize: [54, 53], iconAnchor: [27, 52] }),
      keyboard: false, interactive: false, zIndexOffset: 500,
    }).addTo(instance)
    enterMapFeature(building)
    return () => { marker.remove() }
  }, [ready, displayed.address, displayed.homeIndex])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    const clusters = L.layerGroup().addTo(instance)
    function renderPins() {
      if (!instance) return
      clusters.clearLayers()
      const projected = clusterPins(displayed.destinations, item => instance.latLngToContainerPoint(toLatLng(item.place[2])))
      const singles = new Set(projected.filter(group => group.members.length === 1).map(group => group.members[0]))
      for (const [destination, pin] of pins.current) {
        if (singles.has(destination)) continue
        pin.marker.remove()
        pins.current.delete(destination)
      }
      let added = 0
      for (const group of projected) {
        const [destination] = group.members
        if (group.members.length === 1 && pins.current.has(destination)) continue
        const { place, minutes } = destination
        const button = document.createElement('button')
        button.type = 'button'
        button.className = group.members.length === 1 ? 'place-marker' : 'cluster-marker'
        L.DomEvent.disableClickPropagation(button)
        if (group.members.length > 1) {
          button.textContent = String(group.members.length)
          button.setAttribute('aria-label', `Show ${group.members.length} nearby places`)
          button.addEventListener('click', () => {
            if (instance.getZoom() >= 17) onCluster(group.members)
            else {
              const center = instance.containerPointToLatLng(L.point(group.point.x, group.point.y))
              if (prefersReducedMotion()) instance.setView(center, instance.getZoom() + 1.5)
              else instance.flyTo(center, instance.getZoom() + 1.5, { duration: .42 })
            }
          })
          L.marker(instance.containerPointToLatLng(L.point(group.point.x, group.point.y)), {
            icon: L.divIcon({ className: 'marker-anchor', html: button, iconSize: [34, 34], iconAnchor: [17, 17] }),
            keyboard: false, interactive: false,
          }).addTo(clusters)
          continue
        }
        button.style.setProperty('--pin', categories[place[1]].color)
        button.setAttribute('aria-label', `${place[0]}, ${minutes} minute walk`)
        button.setAttribute('aria-pressed', String(destination === selected))
        button.append(markerIcon(place[1], 15))
        button.addEventListener('click', () => onSelect(destination))
        const marker = L.marker(toLatLng(place[2]), {
          icon: L.divIcon({ className: 'marker-anchor', html: button, iconSize: [29, 29], iconAnchor: [14, 24] }),
          keyboard: false, interactive: false,
        }).addTo(instance)
        pins.current.set(destination, { button, marker })
        enterMapFeature(button, Math.min(added++, 8) * 11)
      }
      for (const [destination, { button, marker }] of pins.current) {
        button.setAttribute('aria-pressed', String(destination === selected))
        marker.setZIndexOffset(destination === selected ? 650 : 0)
      }
    }
    renderPins()
    instance.on('zoomend', renderPins)
    return () => {
      instance.off('zoomend', renderPins)
      clusters.remove()
    }
  }, [ready, displayed.destinations, selected, onSelect, onCluster])

  const refreshPopup = useCallback(() => popup.current?.update(), [])
  useLayoutEffect(() => {
    const instance = map.current
    if (!instance || !selected || !popupHost) return
    const card = L.popup({
      className: 'pin-popup', closeButton: false, closeOnClick: false, closeOnEscapeKey: false,
      offset: L.point(0, -29), autoPanPaddingTopLeft: L.point(14, 100),
      autoPanPaddingBottomRight: L.point(14, window.matchMedia('(max-width: 860px)').matches ? 220 : 45), maxWidth: 268, minWidth: 208,
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


  return (
    <section className="map" aria-label="Neighborhood map">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><defs>
        <symbol id="map-icon-home" viewBox="0 0 24 24"><Building2 width="24" height="24" /></symbol>
        {Object.entries(categories).map(([key, entry]) => <symbol key={key} id={'map-icon-' + key} viewBox="0 0 24 24"><entry.icon width="24" height="24" /></symbol>)}
      </defs></svg>
      <div className="map-canvas" ref={container} />
      {selected && popupHost && <PlaceCallout key={selected.place.join('|')} destination={selected} host={popupHost}
        onClose={closeCallout} onLayout={refreshPopup} />}
      {failed && <p className="map-message">The map couldn’t start. Walking times are available in the list.</p>}
      {baseError && <div className="map-message" role="alert">The basemap didn’t load.
        <button className="text-button" onClick={() => { setBaseError(false); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {ready && <div className="map-buttons">
        {address && <button title="Center on address" aria-label="Center on address" onClick={fitAddress}><LocateFixed size={18} /></button>}
        <button title="Zoom in" aria-label="Zoom in" onClick={() => map.current?.zoomIn(1, { animate: !prefersReducedMotion() })}><Plus size={18} /></button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => map.current?.zoomOut(1, { animate: !prefersReducedMotion() })}><Minus size={18} /></button>
      </div>}
      <a className="overture-credit" href="https://overturemaps.org/" target="_blank" rel="noreferrer">Overture Maps</a>
    </section>
  )
}
