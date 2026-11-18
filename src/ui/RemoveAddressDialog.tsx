import { useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion, settle } from '../map/motion'

type Props = { address: string; onDismiss: () => void; onRemove: () => void }

export default function RemoveAddressDialog({ address, onDismiss, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  useLayoutEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  async function finish(remove: boolean) {
    if (closing.current) return
    closing.current = true
    const dialog = ref.current!
    dialog.dataset.closing = ''
    const duration = prefersReducedMotion() ? 60 : 140
    await dialog.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: prefersReducedMotion() ? 'none' : 'translateY(4px)' }],
      { duration, easing: settle, fill: 'forwards' }).finished.catch(() => {})
    if (remove) onRemove()
    else onDismiss()
  }

  return <dialog className="remove-dialog" ref={ref} aria-labelledby="remove-title" aria-describedby="remove-detail"
    onCancel={event => { event.preventDefault(); void finish(false) }}>
    <h2 id="remove-title">Remove {address}?</h2>
    <p id="remove-detail">This address will be removed from your comparison.</p>
    <div className="remove-actions">
      <button type="button" autoFocus onClick={() => void finish(false)}>Cancel</button>
      <button type="button" className="confirm-remove" onClick={() => void finish(true)}>Remove address</button>
    </div>
  </dialog>
}
