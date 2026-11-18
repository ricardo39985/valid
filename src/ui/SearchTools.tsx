import { BookOpen, Download, Ellipsis, Code2, Moon, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAnchoredPanel } from './panelMotion'
import { useAppearance } from './preferences'

const repository = 'https://github.com/ricardo39985/valid'

export default function SearchTools({ onTour }: { onTour: () => void }) {
  const { dark, mode, chooseMode } = useAppearance()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const panel = useAnchoredPanel(open, anchor)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
    }
  }, [open])
  return <div className="search-tools">
    <div className="project-tools" ref={root} onKeyDown={e => {
      if (open && e.key === 'Escape') { setOpen(false); anchor.current?.focus(); e.stopPropagation() }
    }}>
      <button className="more-tools" aria-label="Project and help" aria-expanded={open} aria-controls={id}
        ref={anchor} onClick={() => setOpen(!open)}><Ellipsis size={20} /></button>
      <div className="project-menu filter-popover" ref={panel} id={id} inert={!open} aria-hidden={!open}>
        <div>
          <section className="menu-appearance" aria-label="Appearance">
            <h2>Appearance</h2>
            <div className="appearance-row">
              <div className="appearance-segments" data-dark={dark}>
                <span className="appearance-thumb" aria-hidden="true" />
                <button aria-pressed={!dark} onClick={e => chooseMode('light', e.currentTarget)}><Sun size={15} />Light</button>
                <button aria-pressed={dark} onClick={e => chooseMode('dark', e.currentTarget)}><Moon size={15} />Dark</button>
              </div>
              <button className="auto-mode" aria-label="Match system appearance" aria-pressed={mode === 'auto'}
                onClick={e => chooseMode(mode === 'auto' ? (dark ? 'dark' : 'light') : 'auto', e.currentTarget)}>Auto</button>
            </div>
          </section>
          <a href={repository} target="_blank" rel="noreferrer"><Code2 size={17} />View on GitHub</a>
          <a href={repository + '/archive/refs/heads/main.zip'}><Download size={17} />Download source ZIP</a>
          <button onClick={() => { setOpen(false); onTour() }}><BookOpen size={17} />Quick tour</button>
        </div>
      </div>
    </div>
  </div>
}
