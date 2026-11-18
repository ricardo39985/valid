import { Building2, LocateFixed, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection, LineString } from 'geojson'
import type { Address, Coordinate, Destination, RouteSegment } from '../routing/types'
import { categories, homeColors, letters, sharedColor } from '../ui/categories'
import 'maplibre-gl/dist/maplibre-gl.css'

const initialCenter: Coordinate = [-122.433, 37.762]
const blank: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }

type Props = {
  address?: Address
  homeIndex: number
  destinations: Destination[]
  segments: RouteSegment[]
  selected: Destination | null
  onSelect: (destination: Destination) => void
}

export default function WalkMap({ address, homeIndex, destinations, segments, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [baseError, setBaseError] = useState(false)

  useEffect(() => {
    if (!container.current) return
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: initialCenter, zoom: 12, minZoom: 10, maxZoom: 18,
        style: 'https://tiles.openfreemap.org/styles/positron',
        dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
      })
    } catch {
      setFailed(true)
      return
    }
    map.current = instance
    instance.touchZoomRotate.disableRotation()
    instance.on('load', () => {
      instance.addSource('walking-routes', { type: 'geojson', data: blank })
      instance.addLayer({
        id: 'route-outline', type: 'line', source: 'walking-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 6, 'line-color': '#fff', 'line-opacity': 0.94 },
      })
      instance.addLayer({
        id: 'route-categories', type: 'line', source: 'walking-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 3.2, 'line-color': ['get', 'color'] },
      })
      setBaseError(false)
      setReady(true)
    })
    instance.on('error', () => {
      if (!instance.getSource('walking-routes')) setBaseError(true)
    })
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !map.current) return
    const source = map.current.getSource<GeoJSONSource>('walking-routes')
    source?.setData({
      type: 'FeatureCollection',
      features: segments.map(({ category, coordinates }) => ({
        type: 'Feature', geometry: { type: 'LineString', coordinates },
        properties: { color: category === 'shared' ? sharedColor : categories[category].color },
      })),
    })
  }, [ready, segments])

  useEffect(() => {
    if (!ready || !map.current || !address) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.current.easeTo({ center: address[1], zoom: 14.55, duration: reducedMotion ? 0 : 650 })
  }, [ready, address])

  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !address) return
    const building = document.createElement('div')
    building.className = 'home-marker'
    building.style.setProperty('--pin', homeColors[homeIndex])
    building.innerHTML = renderToStaticMarkup(<Building2 size={19} aria-hidden="true" />)
    const letter = document.createElement('span')
    letter.textContent = letters[homeIndex]
    building.append(letter)
    building.setAttribute('aria-label', address[0])
    building.setAttribute('role', 'img')
    const home = new maplibregl.Marker({ element: building, anchor: 'bottom' }).setLngLat(address[1]).addTo(instance)

    const pins = destinations.map(destination => {
      const { place, minutes } = destination
      const category = categories[place[1]]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'place-marker'
      button.style.setProperty('--pin', category.color)
      button.setAttribute('aria-label', `${place[0]}, ${minutes} minute walk`)
      button.setAttribute('aria-pressed', String(destination === selected))
      button.title = `${place[0]} · ${minutes} min`
      button.innerHTML = renderToStaticMarkup(<category.icon size={15} aria-hidden="true" />)
      button.addEventListener('click', () => onSelect(destination))
      return new maplibregl.Marker({ element: button, anchor: 'bottom' }).setLngLat(place[2]).addTo(instance)
    })

    return () => {
      home.remove()
      pins.forEach(marker => marker.remove())
    }
  }, [ready, address, homeIndex, destinations, selected, onSelect])

  return (
    <section className="map" aria-label="Neighborhood map">
      <div className="map-canvas" ref={container} />
      {(failed || baseError) && <p className="map-message">The map is unavailable. You can still check walking times in the list.</p>}
      {ready && <div className="map-buttons">
        {address && <button title="Center on address" aria-label="Center on address" onClick={() => map.current?.flyTo({ center: address[1], essential: false })}><LocateFixed size={18} /></button>}
        <button title="Zoom in" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={18} /></button>
        <button title="Zoom out" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={18} /></button>
      </div>}
      <a className="overture-credit" href="https://overturemaps.org/" target="_blank" rel="noreferrer">Overture Maps</a>
    </section>
  )
}
