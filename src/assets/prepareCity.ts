import { loadCity, type City } from './loadAssets'

export async function prepareCity(signal: AbortSignal): Promise<City> {
  if (typeof Worker === 'undefined') return loadCity(signal)

  const worker = new Worker(new URL('./city.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await new Promise<City>((resolve, reject) => {
      signal.throwIfAborted()
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      worker.onmessage = ({ data }: MessageEvent<{ city: City } | { error: string }>) => {
        signal.removeEventListener('abort', abort)
        if ('city' in data) resolve(data.city)
        else reject(new Error(data.error))
      }
      worker.onerror = event => {
        signal.removeEventListener('abort', abort)
        reject(new Error(event.message || 'Could not start the address worker'))
      }
      worker.onmessageerror = () => {
        signal.removeEventListener('abort', abort)
        reject(new Error('Could not read the address worker response'))
      }
    })
  } finally {
    worker.terminate()
  }
}
