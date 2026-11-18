import { useEffect, useLayoutEffect, useState } from 'react'

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
  const dark = mode === 'auto' ? systemDark : mode === 'dark'
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171722' : '#f5f4f9')
    savePreference('appearance', mode)
  }, [mode, dark])
  return { dark, mode, setMode }
}
