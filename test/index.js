const tape = require('tape')
const bipf = require('../')

const pkg = {
  name: 'test',
  version: '1.0.0',
  description: 'test package',
  repository: {
    type: 'git',
    url: 'git://github.com/ssbc/bipf.git',
  },
  dependencies: {
    varint: '^5.0.0',
  },
  husky: {
    hooks: {
      'pre-commit': 'npm run format-code-staged',
    },
  },
}

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
testEncodeDecode(-100)
testEncodeDecode(123.456)
testEncodeDecode(2147483647)
testEncodeDecode(2200000000)
testEncodeDecode(-123.456)
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
testEncodeDecode(
  '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_' +
    '123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_'
)
testEncodeDecode({ foo: true })
testEncodeDecode([-1, { foo: true }, Buffer.from('deadbeef', 'hex')])
testEncodeDecode(pkg)
testEncodeDecode({ 1: true })

tape('seekPath', (t) => {
  const path = ['dependencies', 'varint']
  const pathBuf = bipf.allocAndEncode(path)

  const pkgBuf = bipf.allocAndEncode(pkg)

  t.equal(
    bipf.decode(pkgBuf, bipf.seekPath(pkgBuf, 0, pathBuf, 0)),
    pkg.dependencies.varint
  )

  t.end()
})

tape('seekPath on fields that dont exist returns -1', (t) => {
  const path = ['dependencies', 'varint', 'foo']
  const pathBuf = bipf.allocAndEncode(path)

  const pkgBuf = bipf.allocAndEncode(pkg)

  t.equal(bipf.seekPath(pkgBuf, 0, pathBuf, 0), -1)
  t.end()
})

tape('error: seekPath on a non-array path', (t) => {
  const path = 'dependencies'
  const pathBuf = bipf.allocAndEncode(path)

  const pkgBuf = bipf.allocAndEncode(pkg)

  t.throws(
    () => bipf.decode(pkgBuf, bipf.seekPath(pkgBuf, 0, pathBuf, 0)),
    /path must be encoded array/
  )

  t.end()
})

tape('error: encode(NaN)', (t) => {
  t.throws(() => bipf.encode(NaN), /unknown type/)
  t.end()
})

tape('seekKey() on an object', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  const pointer = bipf.seekKey(objEncoded, 0, Buffer.from('y', 'utf-8'))
  t.equals(pointer, 10)
  const twenty = bipf.decode(objEncoded, pointer)
  t.equals(twenty, 20)
  t.end()
})

tape('seekKey2() on an object', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  const key = bipf.allocAndEncode('y')
  const pointer = bipf.seekKey2(objEncoded, 0, key, 0)
  t.equals(pointer, 10)
  const twenty = bipf.decode(objEncoded, pointer)
  t.equals(twenty, 20)
  t.end()
})

tape('seekKeyCached() on an object with buffer target', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  t.throws(() => {
    bipf.seekKeyCached(objEncoded, 0, Buffer.from('y', 'utf-8'))
  }, /seekKeyCached only supports string target/)
  t.end()
})

tape('seekKeyCached() on an object with string target', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  const pointer = bipf.seekKeyCached(objEncoded, 0, 'y')
  t.equals(pointer, 10)
  const twenty = bipf.decode(objEncoded, pointer)
  t.equals(twenty, 20)
  t.end()
})

tape('seekKey() with a negative start on an object', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  const pointer = bipf.seekKey(objEncoded, -1, Buffer.from('y', 'utf-8'))
  t.equals(pointer, -1)
  t.end()
})

tape('seekKey() on an array', (t) => {
  const objEncoded = bipf.allocAndEncode([10, 20])
  const pointer = bipf.seekKey(objEncoded, 0, Buffer.from('y', 'utf-8'))
  t.equals(pointer, -1)
  t.end()
})

tape('slice() on an object field', (t) => {
  const objEncoded = bipf.allocAndEncode({ x: 'foo', y: 'bar' })
  const pointer = bipf.seekKey(objEncoded, 0, Buffer.from('y', 'utf-8'))
  const sliced = bipf.slice(objEncoded, pointer)
  t.equal(sliced.toString('utf-8'), 'bar')
  t.end()
})

tape('pluck() on an object', (t) => {
  const ageEncoded = bipf.allocAndEncode({ age: 3 })
  const objEncoded = bipf.allocAndEncode({ x: 'foo', y: { age: 3 } })
  const pointer = bipf.seekKey(objEncoded, 0, Buffer.from('y', 'utf-8'))
  const plucked = bipf.pluck(objEncoded, pointer)
  t.deepEquals(plucked, ageEncoded)
  t.end()
})

tape('encodeIdempotent()', (t) => {
  const buf1 = bipf.allocAndEncode({ address: { street: '123 Main St' } })
  const streetBipf = bipf.allocAndEncodeIdempotent({ street: '123 Main St' })
  t.true(bipf.isIdempotent(streetBipf))
  const buf2 = bipf.allocAndEncode({ address: streetBipf })
  t.deepEquals(buf1, buf2)
  t.end()
})

tape('tagIdempotent()', (t) => {
  const buf1 = bipf.allocAndEncode({ address: { street: '123 Main St' } })
  const streetBipf = bipf.markIdempotent(
    bipf.allocAndEncode({ street: '123 Main St' })
  )
  t.true(bipf.isIdempotent(streetBipf))
  const buf2 = bipf.allocAndEncode({ address: streetBipf })
  t.deepEquals(buf1, buf2)
  t.end()
})

tape('iterate() over an encoded object', (t) => {
  const obj = { x: 10, y: 'foo', z: { age: 80 } }
  const objBuf = bipf.allocAndEncode(obj)

  const expectedResults = [
    [2, 'x', 4, 10],
    [9, 'y', 11, 'foo'],
    [15, 'z', 17, { age: 80 }],
  ]

  bipf.iterate(objBuf, 0, (buffer, valuePointer, keyPointer) => {
    const value = bipf.decode(buffer, valuePointer)
    const key = bipf.decode(buffer, keyPointer)
    const [eKeyPointer, eKey, eValuePointer, eValue] = expectedResults.shift()
    t.deepEquals(keyPointer, eKeyPointer, 'iter keyPointer is correct')
    t.deepEquals(key, eKey, 'iter key is correct')
    t.deepEquals(valuePointer, eValuePointer, 'iter valuePointer is correct')
    t.deepEquals(value, eValue, 'iter value is correct')
  })

  t.end()
})

tape('iterate() over an encoded array', (t) => {
  const arr = ['cat', 'dog', 'bird', 'elephant']
  const arrBuf = bipf.allocAndEncode(arr)

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

tape('iterate() over an encoded object, and abort', (t) => {
  const obj = { x: 10, y: 'foo', z: { age: 80 } }
  const objBuf = bipf.allocAndEncode(obj)

  const eKeyPointer = 2
  const eKey = 'x'
  const eValuePointer = 4
  const eValue = 10

  bipf.iterate(objBuf, 0, (buffer, valuePointer, keyPointer) => {
    const value = bipf.decode(buffer, valuePointer)
    const key = bipf.decode(buffer, keyPointer)
    t.deepEquals(keyPointer, eKeyPointer, 'iter keyPointer is correct')
    t.deepEquals(key, eKey, 'iter key is correct')
    t.deepEquals(valuePointer, eValuePointer, 'iter valuePointer is correct')
    t.deepEquals(value, eValue, 'iter value is correct')
    return true // abort
  })

  t.end()
})

tape('iterate() over an encoded array, and abort', (t) => {
  const arr = ['cat', 'dog', 'bird', 'elephant']
  const arrBuf = bipf.allocAndEncode(arr)

  const expectedIdx = 0
  const expectedPointer = 2
  const expectedVal = 'cat'

  bipf.iterate(arrBuf, 0, (buffer, pointer, idx) => {
    t.equal(idx, expectedIdx, 'iter index is correct')
    t.equal(pointer, expectedPointer, 'iter pointer is correct')
    t.equal(bipf.decode(buffer, pointer), expectedVal, 'iter value is correct')
    return true // abort
  })

  t.end()
})

tape('iterate() on an encoded boolnull returns -1', (t) => {
  const buf = bipf.allocAndEncode(true)

  const result = bipf.iterate(buf, 0, (buffer, pointer, idx) => {
    t.fail('iterator should never be called')
  })

  t.equals(result, -1, 'returned -1')
  t.end()
})

tape('getEncodedLength()', (t) => {
  const trueEncoded = bipf.allocAndEncode(true)
  t.equals(bipf.getEncodedLength(trueEncoded, 0), 1)

  const nullEncoded = bipf.allocAndEncode(null)
  t.equals(bipf.getEncodedLength(nullEncoded, 0), 0)

  t.end()
})

tape('getEncodedType()', (t) => {
  const trueEncoded = bipf.allocAndEncode(true)
  const nullEncoded = bipf.allocAndEncode(null)
  const undefinedEncoded = bipf.allocAndEncode(undefined)
  const stringEncoded = bipf.allocAndEncode('foo')
  const intEncoded = bipf.allocAndEncode(42)
  const doubleEncoded = bipf.allocAndEncode(3.1415)
  const arrayEncoded = bipf.allocAndEncode([10, 20, 30])
  const objectEncoded = bipf.allocAndEncode({ x: 10, y: 20 })
  const bufferEncoded = bipf.allocAndEncode(Buffer.from('abc', 'utf-8'))

  t.equals(bipf.getEncodedType(trueEncoded), bipf.types.boolnull)
  t.equals(bipf.getEncodedType(nullEncoded), bipf.types.boolnull)
  t.equals(bipf.getEncodedType(undefinedEncoded), bipf.types.boolnull)
  t.equals(bipf.getEncodedType(stringEncoded), bipf.types.string)
  t.equals(bipf.getEncodedType(intEncoded), bipf.types.int)
  t.equals(bipf.getEncodedType(doubleEncoded), bipf.types.double)
  t.equals(bipf.getEncodedType(arrayEncoded), bipf.types.array)
  t.equals(bipf.getEncodedType(objectEncoded), bipf.types.object)
  t.equals(bipf.getEncodedType(bufferEncoded), bipf.types.buffer)

  t.end()
})

// Converts a string in binary bits to a buffer
function bufferFromBinary(str) {
  const goodStr = str.replace(/[^01]/g, '')
  const buf = Buffer.alloc(goodStr.length / 8)
  for (let i = 0; i < goodStr.length; i += 8) {
    buf[i / 8] = parseInt(goodStr.substr(i, 8), 2)
  }
  return buf
}

tape('error: decode array with bad item: reserved type', (t) => {
  //                                  len   type    len   type
  const faultyBuf = bufferFromBinary('00001 100' + '00000 111')

  t.throws(
    () => {
      bipf.decode(faultyBuf, 0)
    },
    /reserved type/,
    'throws error'
  )

  t.end()
})

tape('error: decode object with bad value: reserved type', (t) => {
  const faultyBuf = bufferFromBinary(
    // len type    len   type    ascii 78     len   type
    '00011 101' + '00001 000' + '01111000' + '00000 111'
  )

  t.throws(
    () => {
      bipf.decode(faultyBuf, 0)
    },
    /reserved type/,
    'throws error'
  )

  t.end()
})

tape('error: decode object with bad key: boolnull', (t) => {
  const faultyBuf = bufferFromBinary(
    // len type    len   type    true          len   type
    '00011 101' + '00001 110' + '0000 0001' + '00000 111'
  )

  t.throws(
    () => {
      bipf.decode(faultyBuf, 0)
    },
    /required type:string/,
    'throws error'
  )

  t.end()
})

tape('error: decode bad boolnull', (t) => {
  const faultyBuf = bufferFromBinary(
    // len type    number 4
    '00001 110' + '0000 0100'
  )

  t.throws(
    () => {
      bipf.decode(faultyBuf, 0)
    },
    /invalid boolnull/,
    'throws error'
  )

  t.end()
})

tape('error: decode bad length for boolnull', (t) => {
  const faultyBuf = bufferFromBinary(
    // len type    true          number 4
    '00011 110' + '0000 0001' + '0000 0100'
  )

  t.throws(
    () => {
      bipf.decode(faultyBuf, 0)
    },
    /invalid boolnull, length must = 1/,
    'throws error'
  )

  t.end()
})

tape('error: decode reserved', (t) => {
  const buf = bipf.allocAndEncode(null)
  buf[0] = 0x7f

  t.throws(
    () => {
      bipf.decode(buf, 0)
    },
    /unable to decode/,
    'throws error'
  )

  t.end()
})

tape('error: symbols cannot be encoded', (t) => {
  t.throws(() => {
    bipf.encodingLength(Symbol.for('foo'))
  })

  const buf = Buffer.alloc(64)

  t.throws(() => {
    bipf.encode(Symbol.for('foo'), buf, 0)
  }, /unknown type/)

  t.end()
})
