import { gunzipSync, strFromU8 } from 'fflate'

export async function fetchPackedJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Some static hosts decompress files before the browser sees them.
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes
  return JSON.parse(strFromU8(json)) as T
}
