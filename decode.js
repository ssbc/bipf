const varint = require('varint')
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
  const a = []
  for (let c = 0; c < length; ) {
    const tag = varint.decode(buffer, start + c)
    const type = tag & TAG_MASK
    if (type === 7) throw new Error('reserved type')
    const len = tag >> TAG_SIZE
    c += varint.decode.bytes
    const value = decode_type(type, buffer, start + c, len)
    a.push(value)
    c += len
  }
  return a
}

function decode_object(buffer, start, length) {
  const o = {}
  for (let c = 0; c < length; ) {
    const tag = varint.decode(buffer, start + c)
    // JavaScript only allows string-valued and Symbol keys for objects
    if (tag & TAG_MASK) throw new Error('required type:string')
    const len = tag >> TAG_SIZE
    c += varint.decode.bytes
    const key = decode_string(buffer, start + c, len)
    c += len

    const tag2 = varint.decode(buffer, start + c)
    const type2 = tag2 & TAG_MASK
    if (type2 === 7) throw new Error('reserved type:value')
    const len2 = tag2 >> TAG_SIZE
    c += varint.decode.bytes
    const value = decode_type(type2, buffer, start + c, len2)
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
  const tag = varint.decode(buffer, start)
  const type = tag & TAG_MASK
  const len = tag >> TAG_SIZE
  const bytes = varint.decode.bytes
  start += bytes
  const value = decode_type(type, buffer, start, len)
  decode.bytes = len + bytes
  return value
}

module.exports = {
  decode,
}
