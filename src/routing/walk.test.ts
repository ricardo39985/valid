import assert from 'node:assert/strict'
import test from 'node:test'
import { createRouter, filterDestinations, routeSegments } from './walk'
import type { Address, Destination, Network } from './types'

const home: Address = ['100 Test St', [0, 0], 0, 0, '94107']
const network: Network = {
  release: 'test',
  nodes: [[0, 0], [1, 0], [2, 0], [1, 1], [3, 0]],
  edges: [[0, 1, 80, []], [1, 2, 80, []], [1, 3, 160, []]],
  places: [
    ['Market', 'groceries', [2, 0], 2, 0],
    ['Station', 'transit', [1, 1], 3, 0],
    ['Unconnected', 'parks', [3, 0], 4, 0],
  ],
}

test('counts only reachable places within the walk limit', () => {
  assert.deepEqual(createRouter(network)(home, 2).map(item => item.place[0]), ['Market'])
  assert.equal(createRouter(network)(home, 10).length, 2)
})

test('draws the common trunk once and recolors it after filtering', () => {
  const destinations = createRouter(network)(home, 10)
  const segments = routeSegments(network, home, destinations)
  assert.deepEqual(segments.map(segment => segment.category).sort(), ['groceries', 'shared', 'transit'])
  assert.deepEqual(routeSegments(network, home, filterDestinations(destinations, 'groceries', 10))
    .map(segment => segment.category), ['groceries', 'groceries'])
})

test('includes off-network access in the walk estimate', () => {
  const offsetHome: Address = ['100 Test St', [0, 0], 0, 25, '94107']
  assert.equal(createRouter(network)(offsetHome, 2).length, 0)
  assert.equal(createRouter(network)(offsetHome, 3)[0].minutes, 3)
})

test('approaches destinations perpendicular to their mapped street', () => {
  const road: Network = {
    ...network,
    nodes: [[-122.45, 37.75], [-122.44, 37.75]],
    edges: [[0, 1, 880, []]],
    places: [],
  }
  const address: Address = ['100 Test St', [-122.448, 37.7502], 0, 80, '94107']
  const destination: Destination = { place: ['Market', 'groceries', [-122.442, 37.7503], 1, 60], minutes: 13, edges: [0] }
  const result = routeSegments(road, address, [{ ...destination, place: [...destination.place] }])
  assert.deepEqual(result.slice(1).map(segment => segment.coordinates[0][1]), [37.75, 37.75])
  for (const segment of result.slice(1)) {
    assert.ok(Math.abs(segment.coordinates[0][0] - segment.coordinates[1][0]) < 1e-8)
  }
})
