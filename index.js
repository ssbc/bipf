const varint = require('varint')

const { types, TAG_SIZE, TAG_MASK, OBJECT, ARRAY } = require('./constants')
const { decode } = require('./decode')
const {
  encode,
  encodingLength,
  allocAndEncode,
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
  const tag_value = varint.decode(buffer, start)
  const length = tag_value >> TAG_SIZE
  return buffer.slice(
    start + varint.decode.bytes,
    start + varint.decode.bytes + length
  )
}

function iterate(buffer, start, iter) {
  const tag = varint.decode(buffer, start)
  const len = tag >> TAG_SIZE
  const type = tag & TAG_MASK
  if (type === OBJECT) {
    for (let c = varint.decode.bytes; c < len; ) {
      const key_start = start + c
      const key_tag = varint.decode(buffer, key_start)
      c += varint.decode.bytes
      c += key_tag >> TAG_SIZE
      const value_start = start + c
      const value_tag = varint.decode(buffer, value_start)
      const next_start = varint.decode.bytes + (value_tag >> TAG_SIZE)
      if (iter(buffer, value_start, key_start)) return start
      c += next_start
    }
    return start
  } else if (type === ARRAY) {
    let i = 0
    for (let c = varint.decode.bytes; c < len; ) {
      if (iter(buffer, start + c, i++)) return start
      var value_tag = varint.decode(buffer, start + c)
      c += varint.decode.bytes + (value_tag >> TAG_SIZE)
    }
    return start
  } else return -1
}

module.exports = {
  encode,
  decode,
  allocAndEncode,
  encodingLength,
  buffer: true,
  slice,
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

  iterate: iterate,

  types,
}
