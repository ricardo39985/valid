import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useAnchoredPanel } from './panelMotion'

type Choice<T> = {
  value: T
  label: string
  icon?: LucideIcon
  color?: string
}

export default function FilterMenu<T extends string | number>({ label, value, options, open, onOpen, onChoose }: {
  label: string
  value: T
  options: readonly Choice<T>[]
  open: boolean
  onOpen: (open: boolean) => void
  onChoose: (value: T) => void
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useAnchoredPanel(open, anchor)
  const id = useId()
  const selected = options.find(option => option.value === value) ?? options[0]
  const LeadingIcon = selected.icon

  useLayoutEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
  }, [open, panel])

  useEffect(() => {
    if (!open) return
    function dismiss(event: Event) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) onOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', dismiss)
    }
  }, [open, onOpen])

  function close() {
    onOpen(false)
    anchor.current?.focus({ preventScroll: true })
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    const rows = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % rows.length; break
      case 'ArrowUp': next = (current <= 0 ? rows.length : current) - 1; break
      case 'Home': next = 0; break
      case 'End': next = rows.length - 1; break
      default: {
        if (event.key.length !== 1 || !/[a-z0-9]/i.test(event.key)) return
        const ordered = [...rows.slice(current + 1), ...rows.slice(0, current + 1)]
        const match = ordered.find(row => row.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()))
        if (!match) return
        next = rows.indexOf(match)
      }
    }
    event.preventDefault()
    rows[next]?.focus({ preventScroll: true })
  }

  return <div ref={wrapper} className="filter-control" data-open={open}>
    <button type="button" className="glass-select" ref={anchor} aria-label={`${label}: ${selected.label}`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => onOpen(!open)}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        onOpen(true)
      }}>
      {LeadingIcon && <LeadingIcon size={17} aria-hidden="true" style={{ color: selected.color }} />}
      <span>{selected.label}</span><ChevronDown className="filter-chevron" size={15} aria-hidden="true" />
    </button>
    <div ref={panel} id={id} role="listbox" className="filter-popover" aria-label={label}
      aria-hidden={!open} inert={!open} onKeyDown={navigate}>
      {options.map(option => {
        const Icon = option.icon
        const isSelected = option.value === value
        return <button type="button" key={option.value} role="option" tabIndex={-1} aria-selected={isSelected}
          onClick={() => { onChoose(option.value); close() }}>
          {Icon && <Icon size={16} aria-hidden="true" style={{ color: option.color }} />}
          <span>{option.label}</span>
          {isSelected && <Check size={16} className="filter-check" aria-hidden="true" />}
        </button>
      })}
    </div>
  </div>
}
