const varint = require('varint')
const { decode } = require('./decode')
const { STRING, OBJECT, TAG_SIZE, TAG_MASK } = require('./constants')

//         buffer ->   start ->    target -> result
// WeakMap<Buffer, Map<number, Map<string, number>>>
const cache1 = new WeakMap()

// TODO rewrite the seek methods so that there is minimal copies.

function seekKey(buffer, start, target) {
  if (start === -1) return -1
  const tag = varint.decode(buffer, start)
  const type = tag & TAG_MASK
  if (type !== OBJECT) return -1
  target = Buffer.isBuffer(target) ? target : Buffer.from(target)
  const targetLength = target.length
  const len = tag >> TAG_SIZE
  for (let c = varint.decode.bytes; c < len; ) {
    const key_tag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    const key_len = key_tag >> TAG_SIZE
    const key_type = key_tag & TAG_MASK
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
    const value_tag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    const value_len = value_tag >> TAG_SIZE
    c += value_len
  }
  return -1
}

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

module.exports = {
  seekKey,

  seekKey2(buffer, start, target, t_start) {
    const tag = varint.decode(buffer, start)
    const type = tag & TAG_MASK
    if (type !== OBJECT) return -1
    let c = varint.decode.bytes
    const len = tag >> TAG_SIZE
    const t_tag = varint.decode(target, t_start)
    const t_length = (t_tag >> TAG_SIZE) + varint.decode.bytes
    for (; c < len; ) {
      const key_tag = varint.decode(buffer, start + c)

      if (
        key_tag === t_tag &&
        buffer.compare(
          target,
          t_start,
          t_length,
          start + c,
          start + c + t_length
        ) === 0
      )
        return start + c + t_length

      c += varint.decode.bytes
      const key_len = key_tag >> TAG_SIZE
      c += key_len

      const value_tag = varint.decode(buffer, start + c)
      c += varint.decode.bytes
      const value_len = value_tag >> TAG_SIZE
      c += value_len
    }
    return -1
  },

  seekKeyCached(buffer, start, target) {
    let cache2 = cache1.get(buffer)
    if (!cache2) cache1.set(buffer, (cache2 = new Map()))
    let cache3 = cache2.get(start)
    if (!cache3) cache2.set(start, (cache3 = new Map()))
    if (typeof target !== 'string') {
      throw new Error('seekKeyCached only supports string target')
    }
    if (cache3.has(target)) {
      return cache3.get(target)
    } else {
      const result = seekKey(buffer, start, target)
      cache3.set(target, result)
      return result
    }
  },

  seekPath(buffer, start, target, target_start) {
    target_start = target_start || 0
    const ary = decode(target, target_start)
    if (!Array.isArray(ary)) throw new Error('path must be encoded array')
    for (let i = 0; i < ary.length; i++) {
      var string = ary[i]
      start = seekKey(buffer, start, string)
      if (start === -1) return -1
    }
    return start
  },

  createSeekPathSrc,

  createSeekPath(target) {
    return new Function('seekKey', createSeekPathSrc(target))(seekKey)
  },
}
