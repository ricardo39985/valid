import { useRef, type PointerEvent } from 'react'

type Props = { collapsed: boolean; onChange: (collapsed: boolean) => void }

export default function SheetHandle({ collapsed, onChange }: Props) {
  const gesture = useRef<{ id: number; start: number; offset: number; limit: number; moved: boolean } | null>(null)
  const skipClick = useRef(false)

  function end(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = gesture.current
    if (!drag || drag.id !== event.pointerId) return
    gesture.current = null
    const board = event.currentTarget.closest('aside')!
    const distance = event.clientY - drag.start
    if (!cancelled && drag.moved) {
      skipClick.current = true
      const next = Math.abs(distance) > 36 ? distance > 0 : drag.offset + distance > drag.limit / 2
      onChange(next)
    }
    board.style.removeProperty('--sheet-drag')
    delete board.dataset.dragging
  }

  return <button className="sheet-handle" type="button" aria-expanded={!collapsed} aria-controls="sheet-content"
    aria-label={collapsed ? 'Show bottom sheet' : 'Hide bottom sheet'}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return
      skipClick.current = false
      const board = event.currentTarget.closest('aside')!
      const offset = new DOMMatrixReadOnly(getComputedStyle(board).transform === 'none' ? undefined : getComputedStyle(board).transform).m42
      const limit = board.offsetHeight + parseFloat(getComputedStyle(board).bottom) - event.currentTarget.offsetHeight - 1
      gesture.current = { id: event.pointerId, start: event.clientY, offset, limit, moved: false }
      event.currentTarget.setPointerCapture(event.pointerId)
      board.style.setProperty('--sheet-drag', offset + 'px')
      board.dataset.dragging = ''
    }}
    onPointerMove={event => {
      const drag = gesture.current
      if (!drag || drag.id !== event.pointerId) return
      const distance = event.clientY - drag.start
      if (Math.abs(distance) > 3) drag.moved = true
      event.currentTarget.closest('aside')!.style.setProperty('--sheet-drag', Math.max(0, Math.min(drag.limit, drag.offset + distance)) + 'px')
    }}
    onPointerUp={event => end(event)} onLostPointerCapture={event => end(event, true)}
    onPointerCancel={event => end(event, true)} onClick={event => {
      if (!skipClick.current || event.detail === 0) onChange(!collapsed)
      skipClick.current = false
    }}><span /></button>
}
