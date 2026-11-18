// Let the settled camera paint before rebuilding map detail.
export function afterFrame(callback: () => void) {
  let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(callback) })
  return () => cancelAnimationFrame(frame)
}
