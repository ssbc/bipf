const tape = require('tape')
const bipf = require('../')
const pkg = require('../package.json')

/*
  json types:

  string, number, array, object, int, buffer?
  boolean-true, boolean-false, null
*/
/*
<object
  <length varint>
    <key_length varint><string bytes>
    <value_length><value>
>

<depth+type varint>
  <object|array|string
    <length varint>
  >
*/

function testEncodeDecode(value) {
  tape('encode & decode: ' + JSON.stringify(value), (t) => {
    const buf = Buffer.alloc(bipf.encodingLength(value))
    const len = bipf.encode(value, buf, 0)
    console.log('encoded:', buf.slice(0, len))
    //''+jsonString to get 'undefined' string.
    const jsonLen = Buffer.byteLength('' + JSON.stringify(value))
    console.log('length:', len, 'JSON-length:', jsonLen)
    if (len > jsonLen)
      console.log('WARNING: binary encoding longer than json for:', value)
    if (len === 1) {
      const rest = buf[0] >> 3
      t.equal(rest, 0, 'single byte encodings must have zero length in tag')
    }
    t.deepEqual(bipf.decode(buf, 0), value)
    t.deepEqual(bipf.decode(buf.slice(0, len), 0), value)

    t.end()
  })
}

testEncodeDecode(100)
testEncodeDecode(0)
testEncodeDecode(1)
testEncodeDecode(-1)
testEncodeDecode(true)
testEncodeDecode(false)
testEncodeDecode(null)
testEncodeDecode(undefined) // added undefined for compatibility with charwise
testEncodeDecode('')
testEncodeDecode(Buffer.alloc(0))
testEncodeDecode([])
testEncodeDecode({})
testEncodeDecode([1, 2, 3, 4, 5, 6, 7, 8, 9])
testEncodeDecode('hello')
testEncodeDecode({ foo: true })
testEncodeDecode([-1, { foo: true }, Buffer.from('deadbeef', 'hex')])
testEncodeDecode(pkg)
testEncodeDecode({ 1: true })

tape('seekPath', (t) => {
  const path = ['dependencies', 'varint']
  const pathBuf = Buffer.alloc(bipf.encodingLength(path))
  bipf.encode(path, pathBuf, 0)

  const pkgBuf = Buffer.alloc(bipf.encodingLength(pkg))
  bipf.encode(pkg, pkgBuf, 0)

  t.equal(
    bipf.decode(pkgBuf, bipf.seekPath(pkgBuf, 0, pathBuf, 0)),
    pkg.dependencies.varint
  )

  t.end()
})

tape('iterate() over an encoded object', (t) => {
  const pkgBuf = Buffer.alloc(bipf.encodingLength(pkg))
  bipf.encode(pkg, pkgBuf, 0)

  const expectedResults = [
    ['name', 'bipf'],
    ['description', 'binary in-place format'],
  ]

  bipf.iterate(pkgBuf, 0, (buffer, valuePointer, keyPointer) => {
    const value = bipf.decode(buffer, valuePointer)
    const key = bipf.decode(buffer, keyPointer)
    const [expectedKey, expectedValue] = expectedResults.shift()
    t.deepEquals(key, expectedKey, 'iter key is correct')
    t.deepEquals(value, expectedValue, 'iter value is correct')
    if (expectedResults.length === 0) return true
  })

  t.end()
})

tape('iterate() over an encoded array', (t) => {
  const arr = ['cat', 'dog', 'bird', 'elephant']
  const arrBuf = Buffer.alloc(bipf.encodingLength(arr))
  bipf.encode(arr, arrBuf, 0)

  const expectedResults = [
    [0, 2, 'cat'],
    [1, 6, 'dog'],
    [2, 10, 'bird'],
    [3, 15, 'elephant'],
  ]

  bipf.iterate(arrBuf, 0, (buffer, pointer, idx) => {
    const [expectedIdx, expectedPointer, expectedVal] = expectedResults.shift()
    t.equal(idx, expectedIdx, 'iter index is correct')
    t.equal(pointer, expectedPointer, 'iter pointer is correct')
    t.equal(bipf.decode(buffer, pointer), expectedVal, 'iter value is correct')
  })

  t.end()
})
