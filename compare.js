const varint = require('varint')
const { INT, DOUBLE, STRING, TAG_SIZE, TAG_MASK } = require('./constants')
const { createSeekPath } = require('./seekers')

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

module.exports = {
  compareString(buffer, start, target) {
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
  },

  compare,

  createCompareAt(paths) {
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
  },
}
