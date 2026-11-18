import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAddressIndex, searchAddresses } from '../data'
import type { Address } from './types'

const sample: Address[] = [
  ['500 Castro St', [0, 0], 0, 0, '94114'],
  ['1500 Castro St', [0, 0], 0, 0, '94114'],
  ['2000 23rd St', [0, 0], 0, 0, '94107'],
]
const index = buildAddressIndex(sample)

test('supports partial street names and common suffixes', () => {
  assert.equal(searchAddresses(index, '500 cas')[0][0], '500 Castro St')
  assert.equal(searchAddresses(index, '500 Castro Street, San Francisco').length, 1)
})

test('does not substitute a similar house number or ordinal street', () => {
  assert.deepEqual(searchAddresses(index, '2000 3rd St'), [])
  assert.equal(searchAddresses(index, '500 Castro').length, 1)
})
