const tape = require('tape')
const bipf = require('../')

function encode(value) {
  const buf = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, buf, 0)
  return buf
}

tape('createCompareAt() can be used for sorting', (t) => {
  const items = []
  for (let i = 0; i < 100; i++) {
    const item = { random: Math.random(), i }
    items.push(item)
  }
  const encodedItems = items.map(encode)

  encodedItems.sort(bipf.createCompareAt([['random']]))
  const decodedItems = encodedItems.map((b) => bipf.decode(b, 0))
  let max = decodedItems[0]
  for (let i = 0; i < decodedItems.length; i++) {
    if (decodedItems[i].random < max.random) {
      t.fail('not sorted')
    }
    max = decodedItems[i]
  }
  t.pass('sorted correctly')
  t.end()
})

tape('compare() can sort with null undefined too', (t) => {
  const values = [
    null,
    undefined,
    0,
    -1,
    1,
    'hello',
    Buffer.from('abc'),
    [],
    {},
    0.23,
    true,
    false,
  ]

  const sorted = [
    null,
    'hello',
    Buffer.from('abc'),
    -1,
    0,
    1,
    0.23,
    [],
    {},
    false,
    true,
    undefined,
  ]

  const encoded = values.map(encode)
  encoded.sort((a, b) => bipf.compare(a, 0, b, 0))
  const decoded = encoded.map((buf) => bipf.decode(buf, 0))
  t.deepEquals(decoded, sorted)
  t.end()
})
