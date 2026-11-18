import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Dumbbell } from 'lucide-react'
import { categories } from './categories'
import favicon from '/favicon.svg'

const branches = [
  { ...categories.cafes, color: '#9d5742', path: 'M0 0H-40Q-49 0 -49 -9V-54Q-49 -63 -58 -63H-114Q-123 -63 -123 -72V-112', delay: 0 },
  { ...categories.groceries, color: '#b56723', path: 'M0 0H20Q29 0 29 -9V-45Q29 -54 38 -54H58Q67 -54 67 -63V-121Q67 -130 76 -130H109Q118 -130 118 -139V-178', delay: 80 },
  { ...categories.transit, color: '#3f65ad', path: 'M0 0H120Q129 0 129 -9V-15Q129 -24 138 -24H163', delay: 25 },
  { ...categories.parks, color: '#287a5d', path: 'M0 0H-32Q-41 0 -41 9V40Q-41 49 -50 49H-68Q-77 49 -77 58V91Q-77 100 -86 100H-119Q-128 100 -128 109V124', delay: 55 },
  { label: 'Gyms', icon: Dumbbell, color: '#7252ae', path: 'M0 0H3Q12 0 12 9V46Q12 55 21 55H43Q52 55 52 64V108Q52 117 61 117H95Q104 117 104 126V178', delay: 130 },
]

const expandAt = 2230
const expandDuration = 720

export default function LaunchScene({ onFinish, ready, failed, onRetry, tour = false }: {
  onFinish: () => void
  ready: boolean
  failed: boolean
  onRetry: () => void
  tour?: boolean
}) {
  const [skip, setSkip] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const staticSplash = reduced || typeof Element.prototype.animate !== 'function'
  const scene = useRef<HTMLDivElement>(null)
  const matte = useRef<HTMLSpanElement>(null)
  const icon = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    const timer = window.setTimeout(() => setIntroDone(true), expandAt)
    return () => {
      window.clearTimeout(timer)
      media.removeEventListener('change', update)
    }
  }, [])

  useLayoutEffect(() => {
    if (!ready || failed) return
    if (skip || staticSplash) { onFinish(); return }
    if (!introDone) return
    const layer = scene.current!
    const { width, height } = layer.getBoundingClientRect()
    const x = width / 2
    const y = height / 2
    const iconSize = Math.min(width * .2, height * .145, 80)
    const half = iconSize * .925 / 2
    const edge = Math.max(x, y) * 1.6
    // Cut a growing, rounded opening in the splash background over the live UI.
    function aperture(size: number) {
      const r = size * .52
      const [left, right, top, bottom] = [x - size, x + size, y - size, y + size]
      return `path(evenodd, "M0 0H${width}V${height}H0Z M${left + r} ${top}H${right - r}Q${right} ${top} ${right} ${top + r}V${bottom - r}Q${right} ${bottom} ${right - r} ${bottom}H${left + r}Q${left} ${bottom} ${left} ${bottom - r}V${top + r}Q${left} ${top} ${left + r} ${top}Z")`
    }
    const timing = { duration: expandDuration, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' } as const
    const reveal = matte.current!.animate([{ clipPath: aperture(half) }, { clipPath: aperture(edge) }], timing)
    const mark = icon.current!.animate([
      { scale: .925, opacity: 1 },
      { scale: 2.25, opacity: 0, offset: .52 },
      { scale: edge / half, opacity: 0 },
    ], timing)
    reveal.onfinish = onFinish
    window.addEventListener('resize', onFinish)
    return () => {
      reveal.cancel()
      mark.cancel()
      window.removeEventListener('resize', onFinish)
    }
  }, [ready, failed, skip, staticSplash, introDone, onFinish])

  return <div ref={scene} className="launch-scene" data-static={staticSplash || skip || failed}>
    <span ref={matte} className="launch-matte" />
    {!staticSplash && !skip && !failed && <svg className="launch-branches" viewBox="-219 -219 438 438" aria-hidden="true">
      {branches.map(({ label, icon: Icon, color, path, delay }) =>
        <g key={label} style={{ '--branch-delay': `${delay}ms`, '--branch-hue': color } as CSSProperties}>
          <g className="launch-route">
            <path d={path} pathLength="1" />
            <path d={path} pathLength="1" />
          </g>
          <path d={path} pathLength="1" className="launch-pulse" />
          <g className="launch-marker">
            <animateMotion path={path} begin={`${delay}ms`} dur="2230ms" fill="freeze"
              calcMode="spline" keyPoints="1;1;0;0" keyTimes="0;.74;.96;1"
              keySplines="0 0 1 1;.4 0 .3 1;0 0 1 1" />
            <circle r="16" />
            <Icon x="-9" y="-9" size={18} />
            <text y="31" textAnchor="middle">{label}</text>
          </g>
        </g>)}
    </svg>}
    <img ref={icon} className="launch-icon" src={favicon} alt="" />
    {failed ? <div className="launch-status">
      <p role="alert">The map or address data couldn’t load.</p>
      <button type="button" autoFocus className="text-button" onClick={onRetry}>Try again</button>
    </div> : <>
      {(introDone || staticSplash || skip) && !ready && <p className="launch-status" role="status">Preparing the San Francisco map…</p>}
      {!staticSplash && !skip && <button type="button" className="launch-skip" autoFocus={tour}
        aria-label="Skip opening animation" onClick={() => setSkip(true)} />}
    </>}
  </div>
}
