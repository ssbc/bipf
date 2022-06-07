const varint = require('fast-varint')

const {
  types,
  TAG_SIZE,
  TAG_MASK,
  STRING,
  BUFFER,
  INT,
  DOUBLE,
  OBJECT,
  ARRAY,
  BOOLNULL,
} = require('./constants')
const { decode } = require('./decode')
const {
  encode,
  encodeIdempotent,
  markIdempotent,
  isIdempotent,
  encodingLength,
  allocAndEncode,
  allocAndEncodeIdempotent,
  getEncodedLength,
  getEncodedType,
  getType,
} = require('./encode')
const {
  seekKey,
  seekKey2,
  seekKeyCached,
  createSeekPath,
  seekPath,
} = require('./seekers')
const { compareString, compare, createCompareAt } = require('./compare')

function slice(buffer, start) {
  const tagValue = varint.decode(buffer, start)
  const length = tagValue >> TAG_SIZE
  return buffer.slice(
    start + varint.decode.bytes,
    start + varint.decode.bytes + length
  )
}

function pluck(buffer, start) {
  const tagValue = varint.decode(buffer, start)
  const length = tagValue >> TAG_SIZE
  return buffer.slice(start, start + varint.decode.bytes + length)
}

function iterate(buffer, start, iter) {
  const tag = varint.decode(buffer, start)
  const len = tag >> TAG_SIZE
  const type = tag & TAG_MASK
  if (type === OBJECT) {
    for (let c = varint.decode.bytes; c < len; ) {
      const keyStart = start + c
      const keyTag = varint.decode(buffer, keyStart)
      c += varint.decode.bytes
      c += keyTag >> TAG_SIZE
      const valueStart = start + c
      const valueTag = varint.decode(buffer, valueStart)
      const nextStart = varint.decode.bytes + (valueTag >> TAG_SIZE)
      if (iter(buffer, valueStart, keyStart)) return start
      c += nextStart
    }
    return start
  } else if (type === ARRAY) {
    let i = 0
    for (let c = varint.decode.bytes; c < len; ) {
      if (iter(buffer, start + c, i++)) return start
      var valueTag = varint.decode(buffer, start + c)
      c += varint.decode.bytes + (valueTag >> TAG_SIZE)
    }
    return start
  } else return -1
}

module.exports = {
  encode,
  encodeIdempotent,
  markIdempotent,
  isIdempotent,
  decode,
  allocAndEncode,
  allocAndEncodeIdempotent,
  encodingLength,
  buffer: true,
  slice,
  pluck,
  getValueType: getType,
  getEncodedLength,
  getEncodedType,

  seekKey,
  seekKeyCached,
  seekKey2,
  createSeekPath,
  seekPath,

  compareString,
  compare,
  createCompareAt,

  iterate,

  types,
}
