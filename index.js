var varint = require('varint')

var STRING = 0 // 000
var BUFFER = 1 // 001

var INT = 2 // 010 // 32bit int
var DOUBLE = 3 // 011 // use next 8 bytes to encode 64bit float

var ARRAY = 4 // 100
var OBJECT = 5 // 101

var BOOLNULL = 6 // 110 // and use the rest of the byte as true/false/null
var RESERVED = 7 // 111

var TAG_SIZE = 3
var TAG_MASK = 7

//sets buffer, and returns length
var encoders = [
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
    var p = start
    for (var i = 0; i < a.length; i++) {
      p += encode(a[i], buffer, p)
    }
    return p - start
  },
  function Object(o, buffer, start) {
    var p = start
    for (var k in o) {
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

function decode_string(buffer, start, length) {
  return buffer.toString('utf8', start, start + length)
}

function decode_buffer(buffer, start, length) {
  return buffer.slice(start, start + length)
}

function decode_integer(buffer, start, length) {
  return buffer.readInt32LE(start) //TODO: encode in minimum bytes
}

function decode_double(buffer, start, length) {
  return buffer.readDoubleLE(start) //TODO: encode in minimum bytes
}

function decode_array(buffer, start, length) {
  var a = []
  for (var c = 0; c < length; ) {
    var tag = varint.decode(buffer, start + c)
    var type = tag & TAG_MASK
    if (type === 7) throw new Error('reserved type')
    var len = tag >> TAG_SIZE
    c += varint.decode.bytes
    var value = decode_type(type, buffer, start + c, len)
    a.push(value)
    c += len
  }
  return a
}

function decode_object(buffer, start, length) {
  var o = {}
  for (var c = 0; c < length; ) {
    var tag = varint.decode(buffer, start + c)
    // JavaScript only allows string-valued and Symbol keys for objects
    if (tag & TAG_MASK) throw new Error('required type:string')
    var len = tag >> TAG_SIZE
    c += varint.decode.bytes
    var key = decode_string(buffer, start + c, len)
    c += len

    var tag2 = varint.decode(buffer, start + c)
    var type2 = tag2 & TAG_MASK
    if (type2 === 7) throw new Error('reserved type:value')
    var len2 = tag2 >> TAG_SIZE
    c += varint.decode.bytes
    var value = decode_type(type2, buffer, start + c, len2)
    c += len2
    o[key] = value
  }
  return o
}

function decode_boolnull(buffer, start, length) {
  if (length === 0) return null
  if (buffer[start] > 2) throw new Error('invalid boolnull')
  if (length > 1) throw new Error('invalid boolnull, length must = 1')
  return buffer[start] === 0 ? false : buffer[start] === 1 ? true : undefined
}

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
  var type = getType(value)
  if ('function' !== typeof encodingLengthers[type])
    throw new Error('unknown type:' + type + ', ' + JSON.stringify(value))
  var len = encodingLengthers[type](value)
  return varint.encodingLength(len << TAG_SIZE) + len
}

function slice(buffer, start) {
  var tag_value = varint.decode(buffer, start)
  var length = tag_value >> TAG_SIZE
  return buffer.slice(
    start + varint.decode.bytes,
    start + varint.decode.bytes + length
  )
}

function getEncodedLength(buffer, start) {
  return varint.decode(buffer, start) >> TAG_SIZE
}

function getEncodedType(buffer, start) {
  return varint.decode(buffer, start) & TAG_MASK
}

function encode(value, buffer, start, _len) {
  start = start | 0
  var type = getType(value)
  if ('function' !== typeof encodingLengthers[type])
    throw new Error('unknown type:' + type + ', ' + JSON.stringify(value))
  var len = _len === undefined ? encodingLengthers[type](value) : _len
  //  if(!buffer)
  //    buffer = Buffer.allocUnsafe(len)
  //throw new Error('buffer must be provided')
  varint.encode((len << TAG_SIZE) | type, buffer, start)
  var bytes = varint.encode.bytes
  return encoders[type](value, buffer, start + bytes) + bytes
}

function allocAndEncode(value) {
  var len = encodingLength(value)
  var buffer = Buffer.allocUnsafe(len)
  encode(value, buffer, 0)
  return buffer
}

function decode_type(type, buffer, start, len) {
  switch (type) {
    case STRING:
      return decode_string(buffer, start, len)
    case BUFFER:
      return decode_buffer(buffer, start, len)
    case INT:
      return decode_integer(buffer, start, len)
    case DOUBLE:
      return decode_double(buffer, start, len)
    case ARRAY:
      return decode_array(buffer, start, len)
    case OBJECT:
      return decode_object(buffer, start, len)
    case BOOLNULL:
      return decode_boolnull(buffer, start, len)
    default:
      throw new Error('unable to decode type=' + type + ' ' + buffer)
  }
}

function decode(buffer, start) {
  start = start | 0
  var tag = varint.decode(buffer, start)
  var type = tag & TAG_MASK
  var len = tag >> TAG_SIZE
  var bytes = varint.decode.bytes
  start += bytes
  var value = decode_type(type, buffer, start, len)
  decode.bytes = len + bytes
  return value
}

function seekKey(buffer, start, target) {
  if (start === -1) return -1
  var tag = varint.decode(buffer, start)
  var type = tag & TAG_MASK
  if (type !== OBJECT) return -1
  target = Buffer.isBuffer(target) ? target : Buffer.from(target)
  var targetLength = target.length
  var len = tag >> TAG_SIZE
  for (var c = varint.decode.bytes; c < len; ) {
    var key_tag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    var key_len = key_tag >> TAG_SIZE
    var key_type = key_tag & TAG_MASK
    if (key_type === STRING && targetLength === key_len)
      if (
        buffer.compare(
          target,
          0,
          targetLength,
          start + c,
          start + c + targetLength
        ) === 0
      )
        return start + c + key_len

    c += key_len
    var value_tag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    var value_len = value_tag >> TAG_SIZE
    c += value_len
  }
  return -1
}

function seekKey2(buffer, start, target, t_start) {
  var tag = varint.decode(buffer, start)
  var type = tag & TAG_MASK
  if (type !== OBJECT) return -1
  var c = varint.decode.bytes
  var len = tag >> TAG_SIZE
  var t_tag = varint.decode(target, t_start)
  var t_length = (t_tag >> TAG_SIZE) + varint.decode.bytes
  for (; c + t_length < len; ) {
    var b_tag = varint.decode(buffer, start + c)
    if (
      b_tag === t_tag &&
      buffer.compare(
        target,
        t_start,
        t_length,
        start + c,
        start + c + t_length
      ) === 0
    )
      return start + c + (b_tag >> TAG_SIZE) + varint.decode.bytes
    else {
      c += (b_tag >> TAG_SIZE) + varint.decode.bytes //key
      c += (varint.decode(buffer, start + c) >> TAG_SIZE) + varint.decode.bytes //value
    }
  }
  return -1
}

// TODO rewrite the seek methods so that there is minimal copies.

function seekPath(buffer, start, target, target_start) {
  target_start = target_start || 0
  var ary = decode(target, target_start)
  if (!Array.isArray(ary)) throw new Error('path must be encoded array')
  for (var i = 0; i < ary.length; i++) {
    var string = ary[i]
    start = seekKey(buffer, start, string)
    if (start === -1) return -1
  }
  return start
}

//for some reason, seek path
function createSeekPathSrc(target) {
  return (
    '"use strict";\n' + //go fast sauce!
    target
      .map(function (e, i) {
        return '  var k' + i + ' = Buffer.from(' + JSON.stringify(e) + ');' //strings only!
      })
      .join('\n') +
    '\n' +
    '  return function (buffer, start) {\n' +
    target
      .map(function (_, i) {
        return '  start = seekKey(buffer, start, k' + i + ')'
      })
      .join('\n') +
    '\n' +
    '  return start;\n' +
    '}\n'
  )
}

function createSeekPath(target) {
  return new Function('seekKey', createSeekPathSrc(target))(seekKey)
}

function compareString(buffer, start, target) {
  if (start === -1) return null
  target = Buffer.isBuffer(target) ? target : Buffer.from(target)
  var tag = varint.decode(buffer, start)
  if ((tag & TAG_MASK) !== STRING) return null
  var len = tag >> TAG_SIZE
  var _len = Math.min(target.length, len)
  return (
    buffer.compare(
      target,
      0,
      _len,
      start + varint.decode.bytes,
      start + varint.decode.bytes + _len
    ) || target.length - len
  )
}

function isNull(tag) {
  return tag === 6
}
function isUndefined(tag, firstByte) {
  // prettier-ignore
  return tag === 0xE && firstByte === 2
}

function compare(buffer1, start1, buffer2, start2) {
  //handle null pointers...
  //  console.log(start1, start2)
  if (start1 === -1 || start2 === -1) return start1 - start2

  var tag1 = varint.decode(buffer1, start1)
  var len1 = varint.decode.bytes
  var tag2 = varint.decode(buffer2, start2)
  var len2 = varint.decode.bytes
  var type1 = tag1 & TAG_MASK
  var type2 = tag2 & TAG_MASK

  //null, lowest value
  if (isNull(tag1)) return isNull(tag2) ? 0 : -1
  else if (isNull(tag2)) return 1

  //undefined, highest value
  if (isUndefined(tag1, buffer1[start1 + 1]))
    return isUndefined(tag2, buffer2[start2 + 1]) ? 0 : 1
  else if (isUndefined(tag2, buffer2[start2 + 1])) return -1

  //allow comparison of number types. **javascriptism**
  //maybe it's better to just have one number type? how can I make a varint double?
  if (type1 === INT && type2 === DOUBLE)
    return (
      buffer1.readInt32LE(start1 + len1) - buffer2.readDoubleLE(start2 + len2)
    )

  if (type1 === DOUBLE && type2 === INT)
    return (
      buffer1.readDoubleLE(start1 + len1) - buffer2.readInt32LE(start2 + len2)
    )

  if (type1 !== type2) return type1 - type2
  //if they are the same type, compare encoded value.
  //TODO: compare by type semantics...
  if (type1 === DOUBLE)
    return (
      buffer1.readDoubleLE(start1 + len1) - buffer2.readDoubleLE(start2 + len2)
    )
  if (type1 === INT)
    return (
      buffer1.readInt32LE(start1 + len1) - buffer2.readInt32LE(start2 + len2)
    )

  return buffer1.compare(
    buffer2,
    start2 + len2,
    start2 + len2 + (tag2 >> TAG_SIZE),
    start1 + len1,
    start1 + len1 + (tag1 >> TAG_SIZE)
  )
}

function iterate(buffer, start, iter) {
  var tag = varint.decode(buffer, start)
  var len = tag >> TAG_SIZE
  var type = tag & TAG_MASK
  if (type === OBJECT) {
    for (var c = varint.decode.bytes; c < len; ) {
      var key_start = start + c
      var key_tag = varint.decode(buffer, key_start)
      c += varint.decode.bytes
      c += key_tag >> TAG_SIZE
      var value_start = start + c
      var value_tag = varint.decode(buffer, value_start)
      var next_start = varint.decode.bytes + (value_tag >> TAG_SIZE)
      if (iter(buffer, value_start, key_start)) return start
      c += next_start
    }
    return start
  } else if (type === ARRAY) {
    var i = 0
    for (var c = varint.decode.bytes; c < len; ) {
      if (iter(buffer, start + c, i++)) return start
      var value_tag = varint.decode(buffer, start + c)
      c += varint.decode.bytes + (value_tag >> TAG_SIZE)
    }
    return start
  } else return -1
}

function createCompareAt(paths) {
  var getPaths = paths.map(createSeekPath)
  return function (a, b) {
    for (var i = 0; i < getPaths.length; i++) {
      var _a = getPaths[i](a, 0)
      var _b = getPaths[i](b, 0)
      var r = compare(a, _a, b, _b)
      if (r) return r
    }
    return 0
  }
}

module.exports = {
  encode: encode,
  decode: decode,
  allocAndEncode: allocAndEncode,
  encodingLength: encodingLength,
  buffer: true,
  slice: slice,
  getValueType: getType,
  getEncodedLength: getEncodedLength,
  getEncodedType: getEncodedType,
  seekKey: seekKey,
  seekKey2: seekKey2,
  createSeekPath: createSeekPath,
  seekPath: seekPath,
  compareString: compareString,
  compare: compare,
  createCompareAt: createCompareAt,
  iterate: iterate,
  types: {
    string: STRING,
    buffer: BUFFER,
    int: INT,
    double: DOUBLE,
    array: ARRAY,
    object: OBJECT,
    boolnull: BOOLNULL,
    reserved: RESERVED,
  },
}
