// this function is based on the varint library
//
// It is modified here to only work on smaller numbers (2^27).
// In BIPF this function is a hot-path, so we want it to be as
// fast as humanly possible. vardim is used to encode the tag
// (type + length) and most lengths are small. If your system
// (such as messages in SSB) are capped, then this is no problem.
//
// 27 bits (3 for type) still leaves 24 bits for a max length of
// 16777216.
//
// this function is up to 10x faster than decode in varint

const MSB = 0x80
const REST = 0x7f

module.exports = require('varint')
module.exports.decode = function read(buf, offset) {
  offset = offset || 0
  let res = 0,
    shift = 0,
    counter = offset,
    b

  do {
    b = buf[counter++]

    if (b === undefined || shift >= 28) {
      read.bytes = 0
      throw new RangeError('Could not decode varint')
    }

    res += (b & REST) << shift
    shift += 7
  } while (b >= MSB)

  read.bytes = counter - offset

  return res
}
