const tape = require('tape')
const bipf = require('../')

function encode(value) {
  const buf = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, buf, 0)
  return buf
}

function decode(buf) {
  return bipf.decode(buf, 0)
}

tape('createCompareAt() can be used for sorting', (t) => {
  const items = []
  for (let i = 0; i < 100; i++) {
    const item = { random: Math.random(), i }
    items.push(item)
  }
  const encodedItems = items.map(encode)

  encodedItems.sort(bipf.createCompareAt([['random']]))
  const decodedItems = encodedItems.map(decode)
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

tape('createCompareAt() for paths that dont exist', (t) => {
  t.deepEquals(
    [{ x: 10 }, { x: 5 }]
      .map(encode)
      .sort(bipf.createCompareAt([['y']]))
      .map(decode),
    [{ x: 10 }, { x: 5 }]
  )
  t.end()
})

tape('compareString()', (t) => {
  const strBuf = bipf.allocAndEncode({ x: 'foo' })
  const pointer = bipf.seekKey(strBuf, 0, Buffer.from('x'))
  const eq = bipf.compareString(strBuf, pointer, 'foo')
  const lt = bipf.compareString(strBuf, pointer, 'abc')
  const gt = bipf.compareString(strBuf, pointer, 'good')
  t.equals(eq, 0)
  t.equals(lt, 1)
  t.equals(gt, -1)
  t.end()
})

tape('compareString() with a negative start', (t) => {
  const strBuf = bipf.allocAndEncode('foo')
  const result = bipf.compareString(strBuf, -1, 'foo')
  t.equals(result, null)
  t.end()
})

tape('compareString() on a non-string input', (t) => {
  const nullBuf = bipf.allocAndEncode(null)
  const result = bipf.compareString(nullBuf, 0, 'foo')
  t.equals(result, null)
  t.end()
})

tape('compareString() with a buffer target', (t) => {
  const strBuf = bipf.allocAndEncode('foo')
  const eq = bipf.compareString(strBuf, 0, Buffer.from('foo'))
  t.equals(eq, 0)
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
    0.23,
    1,
    [],
    {},
    false,
    true,
    undefined,
  ]

  const encoded = values.map(encode)
  encoded.sort((a, b) => bipf.compare(a, 0, b, 0))
  const decoded = encoded.map(decode)
  t.deepEquals(decoded, sorted)
  t.end()
})

tape('compare() undefined and null', (t) => {
  t.deepEquals(
    [undefined, null]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [null, undefined]
  )
  t.end()
})

tape('compare() 1 and undefined', (t) => {
  t.deepEquals(
    [1, undefined]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [1, undefined]
  )
  t.end()
})

tape('compare() undefined and undefined', (t) => {
  t.deepEquals(
    [undefined, undefined]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [undefined, undefined]
  )
  t.end()
})

tape('compare() null and null', (t) => {
  t.deepEquals(
    [null, null]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [null, null]
  )
  t.end()
})

tape('compare() DOUBLE and INT', (t) => {
  t.deepEquals(
    [3.1415, 1]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [1, 3.1415]
  )
  t.end()
})

tape('compare() INT and DOUBLE ', (t) => {
  t.deepEquals(
    [4, 3.1415]
      .map(encode)
      .sort((a, b) => bipf.compare(a, 0, b, 0))
      .map(decode),
    [3.1415, 4]
  )
  t.end()
})
