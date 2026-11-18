import { useLayoutEffect, useRef } from 'react'
import artwork from '../assets/launch.webp'
import { settle } from '../map/motion'

// The address chip is the live search field throughout the handoff.
export default function LaunchScene({ onFinish }: { onFinish: () => void }) {
  const scene = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const layer = scene.current!
    const workspace = layer.closest('main')!
    const search = workspace.querySelector<HTMLElement>('.map-chrome .search-field')!
    const box = search.getBoundingClientRect()
    const art = layer.firstElementChild!.getBoundingClientRect()
    const dx = art.x + art.width / 2 - box.x - box.width / 2
    const dy = art.y + art.height * .35 - box.y - box.height / 2
    const cutX = Math.max(0, (box.width - 108) / 2)
    const cutY = Math.max(0, (box.height - 30) / 2)
    const motions: Animation[] = []
    const move = (element: Element, frames: Keyframe[], delay: number, duration: number) => {
      const animation = element.animate(frames, { delay, duration, easing: settle, fill: 'both' })
      motions.push(animation)
      return animation
    }

    move(search, [
      { transform: `translate(${dx}px, ${dy}px)`, clipPath: `inset(${cutY}px ${cutX}px round 27px)` },
      { transform: 'translate(0,0)', clipPath: 'inset(-16px -24px round 27px)' },
    ], 1080, 680)
    for (const child of search.children) move(child, [{ opacity: 0 }, { opacity: 1 }], 1280, 350)
    move(layer.firstElementChild!, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.91)' }], 1080, 350)
    move(layer, [{ opacity: 1 }, { opacity: 0 }], 1160, 540)
    for (const selector of ['.board', '.map-toolbar', '.search-tools', '.map-buttons']) {
      const element = workspace.querySelector(selector)
      if (element) move(element, [
        { opacity: 0, transform: `translateY(${selector === '.map-toolbar' ? -10 : 16}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], 1320, 470)
    }
    const skip = () => onFinish()
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', skip)
    window.addEventListener('resize', skip)
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip, true)
    motions[motions.length - 1].onfinish = onFinish
    return () => {
      for (const motion of motions) motion.cancel()
      preference.removeEventListener('change', skip)
      window.removeEventListener('resize', skip)
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip, true)
    }
  }, [onFinish])
  return <div ref={scene} className="launch-scene" aria-hidden="true"><img src={artwork} alt="" /></div>
}
