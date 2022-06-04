const varint = require('fast-varint')
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
    const keyTag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    const keyLen = keyTag >> TAG_SIZE
    const keyType = keyTag & TAG_MASK
    if (keyType === STRING && targetLength === keyLen)
      if (
        buffer.compare(
          target,
          0,
          targetLength,
          start + c,
          start + c + targetLength
        ) === 0
      )
        return start + c + keyLen

    c += keyLen
    const valueTag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    const valueLen = valueTag >> TAG_SIZE
    c += valueLen
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

function seekKey2(buffer, start, target, targetStart) {
  const tag = varint.decode(buffer, start)
  const type = tag & TAG_MASK
  if (type !== OBJECT) return -1
  let c = varint.decode.bytes
  const len = tag >> TAG_SIZE
  const targetTag = varint.decode(target, targetStart)
  const targetLen = (targetTag >> TAG_SIZE) + varint.decode.bytes
  for (; c < len; ) {
    const keyTag = varint.decode(buffer, start + c)

    if (
      keyTag === targetTag &&
      buffer.compare(
        target,
        targetStart,
        targetLen,
        start + c,
        start + c + targetLen
      ) === 0
    )
      return start + c + targetLen

    c += varint.decode.bytes
    const keyLen = keyTag >> TAG_SIZE
    c += keyLen

    const valueTag = varint.decode(buffer, start + c)
    c += varint.decode.bytes
    const valueLen = valueTag >> TAG_SIZE
    c += valueLen
  }
  return -1
}

function seekKeyCached(buffer, start, target) {
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
}

function seekPath(buffer, start, target, targetStart) {
  targetStart = targetStart || 0
  const ary = decode(target, targetStart)
  if (!Array.isArray(ary)) throw new Error('path must be encoded array')
  for (let i = 0; i < ary.length; i++) {
    var string = ary[i]
    start = seekKey(buffer, start, string)
    if (start === -1) return -1
  }
  return start
}

function createSeekPath(target) {
  return new Function('seekKey', createSeekPathSrc(target))(seekKey)
}

module.exports = {
  seekKey,
  seekKey2,
  seekKeyCached,
  seekPath,
  createSeekPathSrc,
  createSeekPath,
}
