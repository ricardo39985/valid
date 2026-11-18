import { BookOpen, Download, Ellipsis, Code2, Moon, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAnchoredPanel } from './panelMotion'
import { useAppearance } from './preferences'

const repository = 'https://github.com/ricardo39985/valid'

export default function SearchTools({ onTour }: { onTour: () => void }) {
  const { dark, mode, setMode } = useAppearance()
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
    <div className="appearance" role="group" aria-label="Appearance">
      <button className="mode-switch" type="button" role="switch" aria-label="Dark appearance" aria-checked={dark}
        onClick={() => setMode(dark ? 'light' : 'dark')}><span /><Sun size={15} /><Moon size={14} /></button>
      <button className="auto-mode" aria-label="Match system appearance" aria-pressed={mode === 'auto'}
        onClick={() => setMode(mode === 'auto' ? (dark ? 'dark' : 'light') : 'auto')}>Auto</button>
    </div>
    <div className="project-tools" ref={root} onKeyDown={e => {
      if (open && e.key === 'Escape') { setOpen(false); anchor.current?.focus(); e.stopPropagation() }
    }}>
      <button className="more-tools" aria-label="Project and help" aria-expanded={open} aria-controls={id}
        ref={anchor} onClick={() => setOpen(!open)}><Ellipsis size={20} /></button>
      <div className="project-menu filter-popover" ref={panel} id={id} inert={!open} aria-hidden={!open}>
        <div>
          <a href={repository} target="_blank" rel="noreferrer"><Code2 size={17} />View on GitHub</a>
          <a href={repository + '/archive/refs/heads/main.zip'}><Download size={17} />Download source ZIP</a>
          <button onClick={() => { setOpen(false); onTour() }}><BookOpen size={17} />Quick tour</button>
        </div>
      </div>
    </div>
  </div>
}
