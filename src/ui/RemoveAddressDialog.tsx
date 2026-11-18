import { X } from 'lucide-react'
import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { prefersReducedMotion, settle } from '../map/motion'
import { animateAnchoredSurface } from './panelMotion'

type Props = { address: string; trigger: HTMLButtonElement; onDismiss: () => void; onRemove: () => void }

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
}

export default function RemoveAddressDialog({ address, trigger, onDismiss, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const opening = useRef<Animation[]>([])
  const closing = useRef(false)
  const startedOnBackdrop = useRef(false)

  useLayoutEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    if (typeof dialog.animate === 'function' && !prefersReducedMotion()) {
      const motions = animateAnchoredSurface(dialog, trigger)
      opening.current = motions
      motions[0].onfinish = () => {
        if (closing.current) return
        motions.forEach(motion => motion.cancel())
        opening.current = []
      }
    }
    return () => {
      opening.current.forEach(motion => motion.cancel())
      dialog.close()
    }
  }, [trigger])

  async function finish(remove: boolean) {
    if (closing.current) return
    closing.current = true
    const dialog = ref.current!
    dialog.dataset.closing = ''
    const reduced = prefersReducedMotion()
    if (dialog.animate) {
      if (!remove && !reduced && trigger.isConnected) {
        if (opening.current.length) {
          for (const motion of opening.current) motion.reverse()
        } else {
          opening.current = animateAnchoredSurface(dialog, trigger, false)
        }
        await opening.current[0].finished.catch(() => {})
      } else {
        await dialog.animate([{ opacity: getComputedStyle(dialog).opacity }, { opacity: 0 }],
          { duration: reduced ? 60 : 140, easing: settle, fill: 'forwards' }).finished.catch(() => {})
      }
    }
    if (!dialog.isConnected) return
    if (remove) onRemove()
    else onDismiss()
  }

  return <dialog className="remove-dialog" ref={ref} aria-labelledby="remove-title" aria-describedby="remove-detail"
    onCancel={event => { event.preventDefault(); void finish(false) }}
    onPointerDown={event => { startedOnBackdrop.current = event.button === 0 && isBackdrop(event) }}
    onPointerCancel={() => { startedOnBackdrop.current = false }}
    onClick={event => {
      const dismiss = startedOnBackdrop.current && isBackdrop(event)
      startedOnBackdrop.current = false
      if (dismiss) void finish(false)
    }}>
    <div>
      <div className="remove-header">
        <h2 id="remove-title">Remove {address}?</h2>
        <button type="button" className="remove-close" aria-label="Close" onClick={() => void finish(false)}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p id="remove-detail">This address will be removed from your comparison.</p>
      <div className="remove-actions">
        <button type="button" autoFocus onClick={() => void finish(false)}>Cancel</button>
        <button type="button" className="confirm-remove" onClick={() => void finish(true)}>Remove</button>
      </div>
    </div>
  </dialog>
}
