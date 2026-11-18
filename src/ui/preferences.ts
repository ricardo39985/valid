import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { flushSync } from 'react-dom'

export function readPreference(key: string) {
  try { return localStorage.getItem('before-you-sign.' + key) } catch { return null }
}

export function savePreference(key: string, value: string) {
  try { localStorage.setItem('before-you-sign.' + key, value) } catch { /* Private browsing can disable storage. */ }
}

type Mode = 'light' | 'dark' | 'auto'

export function useAppearance() {
  const [mode, setMode] = useState<Mode>(() => {
    const stored = readPreference('appearance')
    return stored === 'dark' || stored === 'light' ? stored : 'auto'
  })
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [applied, setApplied] = useState(mode)
  const dark = mode === 'auto' ? systemDark : mode === 'dark'
  useLayoutEffect(() => {
    const useDark = applied === 'auto' ? systemDark : applied === 'dark'
    document.documentElement.dataset.theme = useDark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', useDark ? '#1c1c1e' : '#f5f4f9')
    savePreference('appearance', applied)
  }, [applied, systemDark])
  const activeReveal = useRef<HTMLDivElement | null>(null)
  useEffect(() => () => activeReveal.current?.remove(), [])

  function clearReveal() {
    const previous = activeReveal.current
    previous?.getAnimations({ subtree: true }).forEach(animation => animation.cancel())
    previous?.remove()
    activeReveal.current = null
  }
  function chooseMode(next: Mode, button: HTMLElement) {
    clearReveal()
    setMode(next)
    const nextDark = next === 'auto' ? systemDark : next === 'dark'
    if (nextDark === (document.documentElement.dataset.theme === 'dark') || !button.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setApplied(next)
      return
    }

    const box = button.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)))
    const veil = document.createElement('div')
    veil.className = 'appearance-reveal'
    veil.setAttribute('aria-hidden', 'true')
    const circle = document.createElement('div')
    circle.className = 'appearance-reveal-circle'
    circle.dataset.dark = String(nextDark)
    Object.assign(circle.style, { left: `${x - radius}px`, top: `${y - radius}px`, width: `${2 * radius}px`, height: `${2 * radius}px` })
    veil.append(circle)
    document.body.append(veil)
    activeReveal.current = veil

    // Start on the click frame. Apply the theme once the veil covers the map,
    // then let the live UI emerge as the veil fades.
    const spread = circle.animate([{ transform: 'scale(.012)' }, { transform: 'scale(1)' }],
      { duration: 235, easing: 'cubic-bezier(.22,.72,.28,1)', fill: 'both' })
    spread.onfinish = () => {
      if (activeReveal.current !== veil) return
      flushSync(() => setApplied(next))
      const fade = circle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 135, easing: 'ease-out', fill: 'both' })
      fade.onfinish = () => {
        if (activeReveal.current === veil) clearReveal()
      }
    }
  }
  return { dark, mode, chooseMode }
}
