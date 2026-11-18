import { ArrowLeft, ArrowRight, House, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import launch from '../assets/launch.webp'
import walk from '../assets/tour/walk.webp'
import filter from '../assets/tour/filter.webp'
import compare from '../assets/tour/compare.webp'

const steps = [
  { image: walk, title: 'What’s within walking distance?', body: 'Before you sign the lease, enter the apartment’s San Francisco address to see what you can walk to from your front door.' },
  { image: filter, title: 'Groceries within ten minutes?', body: 'Choose Groceries and a 10-minute walk to see which stores are close enough to reach on foot.' },
  { image: compare, title: 'Which apartment has the shorter walk?', body: 'Compare up to five addresses to see how long you’d walk from each one to the places you visit most.' },
]

export default function Onboarding({ intro, onIntroDone, onDone }: { intro: boolean; onIntroDone: () => void; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const [page, setPage] = useState(0)
  const [closing, setClosing] = useState(false)
  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const finish = () => setClosing(true)
  return <dialog ref={dialog} className="tour" data-closing={closing} data-intro={intro} aria-labelledby="tour-title"
    onTouchStart={e => {
      const interactive = (e.target as Element).closest('button')
      swipe.current = !intro && !closing && !interactive && e.touches.length === 1
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
    }}
    onTouchCancel={() => { swipe.current = null }}
    onTouchEnd={e => {
      const start = swipe.current
      swipe.current = null
      if (!start || e.touches.length || !e.changedTouches.length) return
      const dx = e.changedTouches[0].clientX - start.x
      const dy = e.changedTouches[0].clientY - start.y
      if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      setPage(current => Math.max(0, Math.min(steps.length - 1, current + (dx < 0 ? 1 : -1))))
    }}
    onCancel={e => { e.preventDefault(); if (intro) onIntroDone(); else finish() }}
    onAnimationEnd={e => { if (closing && e.target === dialog.current && e.animationName === 'tour-exit') onDone() }}>
    {intro && <button className="tour-launch" aria-label="Skip opening animation" autoFocus onClick={onIntroDone}
      onAnimationEnd={e => { if (e.target === e.currentTarget) onIntroDone() }}>
      <span><img src={launch} alt="" /><b>610 20th St</b></span>
    </button>}
    <header inert={intro}><span className="tour-brand"><span><House size={19} /></span>Before You Sign</span>
      <button className="tour-close" autoFocus={!intro} onClick={finish} aria-label="Close tour"><X size={18} aria-hidden="true" /></button></header>
    <div className="tour-visual" aria-hidden="true"><div className="tour-track" style={{ transform: `translateX(-${page * 100}%)` }}>
      {steps.map(step => <img key={step.image} src={step.image} alt="" />)}
    </div></div>
    <div className="tour-copy" aria-live="polite" aria-atomic="true"><div key={page}>
      <h1 id="tour-title">{steps[page].title}</h1><p>{steps[page].body}</p>
    </div></div>
    <div className="tour-progress" inert={intro} aria-label={`Step ${page + 1} of 3`}>{steps.map((step, i) =>
      <button key={step.title} aria-label={`Step ${i + 1}`} aria-current={i === page ? 'step' : undefined}
        onClick={() => setPage(i)}><span /></button>)}</div>
    <footer inert={intro}>{page > 0 && <button className="tour-back" onClick={() => setPage(page - 1)} aria-label="Previous step"><ArrowLeft size={18} /></button>}
      <button className="tour-next" onClick={() => page === 2 ? finish() : setPage(page + 1)}>
        {page === 2 ? 'Enter an address' : 'Continue'}<ArrowRight size={18} /></button></footer>
  </dialog>
}
