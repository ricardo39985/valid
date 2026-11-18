import { ArrowLeft, ArrowRight, House } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import launch from '../assets/launch.webp'
import walk from '../assets/tour/walk.webp'
import filter from '../assets/tour/filter.webp'
import compare from '../assets/tour/compare.webp'

const steps = [
  { image: walk, title: 'See what’s a walk away.', body: 'Enter a San Francisco address to see walking routes to groceries, transit, cafés, parks and pharmacies.' },
  { image: filter, title: 'Find your everyday stops.', body: 'Choose a category and a walk of 5 to 20 minutes. Tap a pin to see the place and its estimated walking time.' },
  { image: compare, title: 'Compare before you sign.', body: 'Add up to five addresses. Compare their nearby places side by side, then tap a home to see its routes on the map.' },
]

export default function Onboarding({ intro, onIntroDone, onDone }: { intro: boolean; onIntroDone: () => void; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState(0)
  const [closing, setClosing] = useState(false)
  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const finish = () => setClosing(true)
  return <dialog ref={dialog} className="tour" data-closing={closing} data-intro={intro} aria-labelledby="tour-title"
    onCancel={e => { e.preventDefault(); if (intro) onIntroDone(); else finish() }}
    onAnimationEnd={e => { if (closing && e.target === dialog.current && e.animationName === 'tour-exit') onDone() }}>
    {intro && <button className="tour-launch" aria-label="Skip opening animation" autoFocus onClick={onIntroDone}
      onAnimationEnd={e => { if (e.target === e.currentTarget) onIntroDone() }}>
      <span><img src={launch} alt="" /><b>610 20th St</b></span>
    </button>}
    <header inert={intro}><span className="tour-brand"><span><House size={19} /></span>Before You Sign</span>
      <button autoFocus={!intro} onClick={finish}>Skip</button></header>
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
