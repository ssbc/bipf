const varint = require('fast-varint')
const { TAG_SIZE, TAG_MASK } = require('./constants')
const {
  STRING,
  BUFFER,
  INT,
  DOUBLE,
  ARRAY,
  OBJECT,
  BOOLNULL,
} = require('./constants')

//sets buffer, and returns length
const encoders = [
  function String(string, buffer, start) {
    return buffer.write(string, start)
  },
  function Buffer(b, buffer, start) {
    b.copy(buffer, start, 0, b.length)
    return b.length
  },
  function Integer(i, buffer, start) {
    buffer.writeInt32LE(i, start)
    return 4
  },
  function Double(d, buffer, start) {
    buffer.writeDoubleLE(d, start)
    return 8
  },
  function Array(a, buffer, start) {
    let p = start
    for (let i = 0; i < a.length; i++) {
      p += encode(a[i], buffer, p)
    }
    return p - start
  },
  function Object(o, buffer, start) {
    let p = start
    for (let k in o) {
      //TODO filter non json types
      p += encode(k, buffer, p)
      p += encode(o[k], buffer, p)
    }
    return p - start
  },
  function Boolean(b, buffer, start) {
    if (b !== null) buffer[start] = b === false ? 0 : b === true ? 1 : 2 // undefined
    return b === null ? 0 : 1
  },
]

var encodingLengthers = [
  function String(string) {
    return Buffer.byteLength(string)
  },
  function Buffer(b) {
    return b.length
  },
  function Integer(i) {
    return 4
  },
  function Double(d) {
    return 8
  },
  function Array(a) {
    var bytes = 0
    for (var i = 0; i < a.length; i++) bytes += encodingLength(a[i])
    return bytes
  },
  function Object(o) {
    var bytes = 0
    for (var k in o) bytes += encodingLength(k) + encodingLength(o[k])
    return bytes
  },
  function boolnull(b, buffer, start) {
    return b === null ? 0 : 1 // encode null as zero length!
  },
]

function getType(value) {
  if ('string' === typeof value || value instanceof Date) return STRING
  else if (Buffer.isBuffer(value)) return BUFFER
  else if (Number.isInteger(value) && Math.abs(value) <= 2147483647) return INT
  else if ('number' === typeof value && Number.isFinite(value))
    //do not support Infinity or NaN (because JSON)
    return DOUBLE
  else if (Array.isArray(value)) return ARRAY
  else if (value && 'object' === typeof value) return OBJECT
  else if ('boolean' === typeof value || null == value) return BOOLNULL //boolean, null, undefined
}

function encodingLength(value) {
  const type = getType(value)
  if (type === void 0) throw new Error('unknown type: ' + JSON.stringify(value))
  const len = encodingLengthers[type](value)
  return varint.encodingLength(len << TAG_SIZE) + len
}

function encode(value, buffer, start, _len) {
  start = start | 0
  const type = getType(value)
  if (type === void 0) throw new Error('unknown type: ' + JSON.stringify(value))
  const len = _len === undefined ? encodingLengthers[type](value) : _len
  //  if(!buffer)
  //    buffer = Buffer.allocUnsafe(len)
  //throw new Error('buffer must be provided')
  varint.encode((len << TAG_SIZE) | type, buffer, start)
  const bytes = varint.encode.bytes
  return encoders[type](value, buffer, start + bytes) + bytes
}

function getEncodedLength(buffer, start) {
  return varint.decode(buffer, start) >> TAG_SIZE
}

function getEncodedType(buffer, start) {
  return varint.decode(buffer, start) & TAG_MASK
}

function allocAndEncode(value) {
  const len = encodingLength(value)
  const buffer = Buffer.allocUnsafe(len)
  encode(value, buffer, 0)
  return buffer
}

module.exports = {
  encode,
  getType,
  getEncodedLength,
  getEncodedType,
  encodingLength,
  allocAndEncode,
}
