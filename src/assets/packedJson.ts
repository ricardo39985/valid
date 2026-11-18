export async function fetchPackedJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Some static hosts decompress files before the browser sees them.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes)) as T
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).json() as Promise<T>
  }
  const { gunzipSync, strFromU8 } = await import('fflate')
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T
}
