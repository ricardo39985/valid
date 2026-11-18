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
  }, [applied, systemDark])
  useEffect(() => { savePreference('appearance', applied) }, [applied])
  const activeReveal = useRef<ViewTransition | null>(null)
  const revision = useRef(0)
  function chooseMode(next: Mode, button: HTMLElement) {
    const turn = ++revision.current
    activeReveal.current?.skipTransition()
    setMode(next)
    const nextDark = next === 'auto' ? systemDark : next === 'dark'
    if (nextDark === (document.documentElement.dataset.theme === 'dark') || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setApplied(next)
      return
    }
    const box = button.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const root = document.documentElement
    root.style.setProperty('--reveal-origin', `${x}px ${y}px`)
    root.style.setProperty('--reveal-radius', `${Math.ceil(radius)}px`)
    root.dataset.appearanceReveal = ''
    const reveal = document.startViewTransition(() => { if (turn === revision.current) flushSync(() => setApplied(next)) })
    activeReveal.current = reveal
    const cleanup = () => {
      if (activeReveal.current !== reveal) return
      activeReveal.current = null
      delete root.dataset.appearanceReveal
      root.style.removeProperty('--reveal-origin')
      root.style.removeProperty('--reveal-radius')
    }
    void reveal.finished.then(cleanup, cleanup)
  }
  return { dark, mode, chooseMode }
}
