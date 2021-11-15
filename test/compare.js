var tape = require('tape')
var bipf = require('../')

function encode(value) {
  var b = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, b, 0)
  return b
}

var a = []
for (var i = 0; i < 100; i++) a.push(encode({ random: Math.random(), i: i }))

var key = Buffer.from('random')

//a.sort(function (a, b) {
//  var _a = bipf.seekKey(a, 0, key)
//  var _b = bipf.seekKey(b, 0, key)
//  return bipf.compare(a, _a, b, _b)
////  return a.compare(b)
//})

a.sort(bipf.createCompareAt([['random']]))

tape('sorted', function (t) {
  var b = a.map(function (b) {
    return bipf.decode(b, 0)
  })
  max = b[0]
  for (var i = 0; i < b.length; i++) {
    t.ok(b[i].random >= max.random)
    max = b[i]
  }
  t.end()
})

tape('sort with null undefined', function (t) {
  var values = [
    null,
    undefined,
    0,
    -1,
    1,
    'hello',
    Buffer.from('abc'),
    [],
    {},
    0.23,
    true,
    false,
  ]

  var encoded = values.map(encode)
  encoded.sort(function (a, b) {
    return bipf.compare(a, 0, b, 0)
  })
  console.log(encoded)
  //console.log(encoded.map(function (b) { return bipf.decode(b, 0) }))
  t.end()
})
