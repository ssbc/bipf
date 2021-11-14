//create a magic js object that parses as you access fields.
//this is way way slower. not recommended.

var binary = require('./')
var handler = {
  get: function (base, key) {
    //    if(base.data[key] != undefined) return base.data[key]
    var ptr = binary.seekKey(base.buffer, base.start, key)
    if (ptr == -1) return undefined
    var type = binary.getEncodedType(base.buffer, ptr)
    if (type === binary.types.object || type === binary.types.array)
      return BinaryProxy(base.buffer, ptr)
    //      return base.data[key] = binary.decode(base.buffer, ptr)
    else return binary.decode(base.buffer, ptr)
  },
}

function BinaryProxy(buffer, start) {
  var base = { buffer: buffer, start: start, data: {} }

  var proxy = new Proxy(base, handler)
  return proxy
  //  base.buffer = buffer
  //  base.start = start
  //  return proxy
}

//module.exports = BinaryProxy
var _base = { buffer: null, start: -1 }
var _proxy = new Proxy(_base, handler)

module.exports = function (buffer, start) {
  _base.buffer = buffer
  _base.start = start
  return _proxy
}
