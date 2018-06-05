var varint = require('varint')

var STRING = 0    // 000
var BUFFER = 1    // 001

var INT = 2       // 101 //32bit int
var DOUBLE = 3    // 010 //use next 8 bytes to encode 64bit float

var ARRAY = 4     // 011
var OBJECT = 5    // 100

var BOOLNULL = 6  // 110 //and use the rest of the byte as true/false/null
var RESERVED = 7  // 111

var TAG_SIZE = 3, TAG_MASK = 7

var bytes = 0
var encoders = [
  function String (string, buffer, start) {
    return buffer.write(string, start)
  },
  function Buffer (b, buffer, start) {
    b.copy(buffer, start, 0, b.length)
    return b.length
  },
  function Integer (i, buffer, start) {
    buffer.writeInt32LE(i, start)
    return 4
  },
  function Double (d, buffer, start) {
    buffer.writeDoubleLE(d, start)
    return 8
  },
  function Array (a, buffer, start) {
    var p = start
    for(var i = 0; i < a.length; i++) {
      p+=encode(a[i], buffer, p)
    }
    return p - start
  },
  function Object (o, buffer, start) {
    var p = start
    for(var k in o) {
      //TODO filter non json types
      p+=encode(k, buffer, p)
      p+=encode(o[k], buffer, p)
    }
    return p - start
  },
  function Boolean (b, buffer, start) {
    buffer[start] = +!!b
    return b == null ? 0 : 1
  }
]

var encodingLengthers = [
  function String (string) {
    return Buffer.byteLength(string)
  },
  function Buffer (b) {
    return b.length
  },
  function Integer (i) {
    return 4
  },
  function Double (d) {
    return 8
  },
  function Array (a) {
    var bytes = 0
    for(var i = 0; i < a.length; i++)
      bytes += encodingLength(a[i])
    return bytes
  },
  function Object (o) {
    var bytes = 0
    for(var k in o)
      bytes+=encodingLength(k)+ encodingLength(o[k])
    return bytes
  },
  function boolnull (b, buffer, start) {
    return b === null ? 0 : 1 //encode null as zero length!
  }
]

var decoders = [
  function string (buffer, start, length) {
    return buffer.toString('utf8', start, start+length)
  },
  function buffer (buffer, start, length) {
    return buffer.slice(start, start+length)
  },
  function integer (buffer, start, length) {
    return buffer.readInt32LE(start) //TODO: encode in minimum bytes
  },
  function double (buffer, start, length) {
    return buffer.readDoubleLE(start) //TODO: encode in minimum bytes
  },
  function array (buffer, start, length) {
    var a = [], i = 0
    for(var c = 0; c < length;) {
      var tag = varint.decode(buffer, start+c)
      var type = tag & TAG_MASK
      if(type === 7) throw new Error('reserved type')
      var len = tag >> TAG_SIZE
      c += varint.decode.bytes
      var value = decoders[type](buffer, start+c, len)
      a.push(value)
      c += len
    }
    return a
  },
  function object (buffer, start, length) {
    var o = {}
    for(var c = 0; c < length;) {
      var tag = varint.decode(buffer, start+c)
      var type = tag & TAG_MASK
      var len = tag >> TAG_SIZE
      c += varint.decode.bytes
      //TODO: positive integers keys are always in order!
      //floats or negative numbers encoded as strings. or may not be keys?
      if(type === 7) throw new Error('reserved type:key')
      var key = decoders[type](buffer, start+c, len)
      c += len

      var tag2 = varint.decode(buffer, start+c)
      var type2 = tag2 & TAG_MASK
      if(type2 === 7) throw new Error('reserved type:value')
      var len2 = tag2 >> TAG_SIZE
      c += varint.decode.bytes
      var value = decoders[type2](buffer, start+c, len2)

      c+= len2
      o[key] = value
    }
    return o

  },
  function boolnull (buffer, start, length) {
    if(length === 0) return null
    if(buffer[start] > 1) throw new Error('invalid boolnull')
    return buffer[start] === 1
  }
]

function getType (value) {
  if('string' === typeof value || value instanceof Date)
    return STRING
  else if(Buffer.isBuffer(value))
    return BUFFER
  else if(Number.isInteger(value) && Math.abs(value) <= 4294967296)
    return INT
  else if('number' === typeof value && Number.isFinite(value)) //do not support Infinity or NaN (because JSON)
    return DOUBLE
  else if(Array.isArray(value))
    return ARRAY
  else if(value && 'object' === typeof value)
    return OBJECT
  else if('boolean' === typeof value || null === value)
    return BOOLNULL
}

function encodingLength (value) {
  var type = getType(value)
  var len = encodingLengthers[type](value)
  return varint.encodingLength(len << TAG_SIZE) + len
}

function encode (value, buffer, start) {
  var type = getType(value)
  var len = encodingLengthers[type](value)
  if(!buffer)
    throw new Error('buffer must be provided')
  if(type === 7) throw new Error('reserved type')
  varint.encode(len << TAG_SIZE | type, buffer, start)
  var bytes = varint.encode.bytes
  return encoders[type](value, buffer, start+bytes) + bytes
}

function decode (buffer, start) {
  start = start | 0
  var tag = varint.decode(buffer, start)
  var type = tag & TAG_MASK
  var len = tag >> TAG_SIZE
  var bytes = varint.decode.bytes
  start += bytes
  var value = decoders[type](buffer, start, len)
  decode.bytes = len + bytes
  return value
}

function seekKey (buffer, start, target) {
  target = Buffer.isBuffer(target) ? target : new Buffer(target)
  var targetLength = target.length // = Buffer.byteLength(target) //Buffer.isBuffer(target) ? target.length : Buffer.byteLength(target)
  var tag = varint.decode(buffer, start)
  var len = tag >> TAG_SIZE
  var type = tag & TAG_MASK
  if(type != OBJECT) throw new Error('expected object')
  for(var c = varint.decode.bytes; c < len;) {
    var key_tag = varint.decode(buffer, start+c)
    c += varint.decode.bytes
    var key_len = key_tag >> TAG_SIZE
    var key_type = key_tag & TAG_MASK
    if(key_type === STRING && targetLength === key_len) {
      if(buffer.compare(target, 0, targetLength, start+c, start+c+targetLength) === 0)
        return start+c+key_len
    }
    c += key_len
    var value_tag = varint.decode(buffer, start+c)
    c += varint.decode.bytes
    var value_len = value_tag >> TAG_SIZE
    c += value_len
  }
  return -1
}

module.exports = {
  encode: encode,
  decode: decode,
  encodingLength: encodingLength,
  buffer: true,
  seekKey: seekKey
}

