import assert from 'node:assert/strict'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { fetchPackedJson } from './packedJson'

const data = JSON.stringify(['San Francisco'])
for (const [type, bytes] of [['packed', gzipSync(data)], ['decoded by the host', Buffer.from(data)]] as const) {
  test(`loads JSON when the asset is ${type}`, async () => {
    const url = 'data:application/octet-stream;base64,' + bytes.toString('base64')
    assert.deepEqual(await fetchPackedJson(url), ['San Francisco'])
  })
}
