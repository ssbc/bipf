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

function decodeString(buffer, start, length) {
  return buffer.toString('utf8', start, start + length)
}

function decodeBuffer(buffer, start, length) {
  return buffer.slice(start, start + length)
}

function decodeInteger(buffer, start, length) {
  return buffer.readInt32LE(start) //TODO: encode in minimum bytes
}

function decodeDouble(buffer, start, length) {
  return buffer.readDoubleLE(start) //TODO: encode in minimum bytes
}

function decodeArray(buffer, start, length) {
  const a = []
  for (let c = 0; c < length; ) {
    const tag = varint.decode(buffer, start + c)
    const type = tag & TAG_MASK
    if (type === 7) throw new Error('reserved type')
    const len = tag >> TAG_SIZE
    c += varint.decode.bytes
    const value = decodeType(type, buffer, start + c, len)
    a.push(value)
    c += len
  }
  return a
}

function decodeObject(buffer, start, length) {
  const o = {}
  for (let c = 0; c < length; ) {
    const tag = varint.decode(buffer, start + c)
    // JavaScript only allows string-valued and Symbol keys for objects
    if (tag & TAG_MASK) throw new Error('required type:string')
    const len = tag >> TAG_SIZE
    c += varint.decode.bytes
    const key = decodeString(buffer, start + c, len)
    c += len

    const tag2 = varint.decode(buffer, start + c)
    const type2 = tag2 & TAG_MASK
    if (type2 === 7) throw new Error('reserved type:value')
    const len2 = tag2 >> TAG_SIZE
    c += varint.decode.bytes
    const value = decodeType(type2, buffer, start + c, len2)
    c += len2
    o[key] = value
  }
  return o
}

function decodeBoolnull(buffer, start, length) {
  if (length === 0) return null
  if (buffer[start] > 2) throw new Error('invalid boolnull')
  if (length > 1) throw new Error('invalid boolnull, length must = 1')
  return buffer[start] === 0 ? false : buffer[start] === 1 ? true : undefined
}

function decodeType(type, buffer, start, len) {
  switch (type) {
    case STRING:
      return decodeString(buffer, start, len)
    case BUFFER:
      return decodeBuffer(buffer, start, len)
    case INT:
      return decodeInteger(buffer, start, len)
    case DOUBLE:
      return decodeDouble(buffer, start, len)
    case ARRAY:
      return decodeArray(buffer, start, len)
    case OBJECT:
      return decodeObject(buffer, start, len)
    case BOOLNULL:
      return decodeBoolnull(buffer, start, len)
    default:
      throw new Error('unable to decode type=' + type + ' ' + buffer)
  }
}

function decode(buffer, start) {
  start = start | 0
  const tag = varint.decode(buffer, start)
  const type = tag & TAG_MASK
  const len = tag >> TAG_SIZE
  const bytes = varint.decode.bytes
  start += bytes
  const value = decodeType(type, buffer, start, len)
  decode.bytes = len + bytes
  return value
}

module.exports = {
  decode,
}
