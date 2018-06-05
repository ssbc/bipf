var binary = require('./')
var tape = require('tape')
/*
  json types:

  string, number, array, object, int, buffer?
  boolean-true, boolean-false, null
*/
/*
<object
  <length varint>
    <key_length varint><string bytes>
    <value_length><value>
>

<depth+type varint>
  <object|array|string
    <length varint>
  >
*/
function read_value (pointer, b) {
  var l = b.readUInt16LE(pointer)
  var type = l & 7
  var length = l>>3
  pointer += 2
  return b.toString('utf8', pointer, pointer+length)
}

function read (key, b) {
  var c = 0
  var l = Buffer.byteLength(key)
  while(c < b.length) {
    var len = b.readUInt16LE(c)>>3
    c += 2
    if(len != l) {
      c += len //skip this item, it's not the key we want.
      var len_skip = b.readUInt16LE(c)>>3
      c += len_skip + 2
    }
    else {
      var _key = b.toString('utf8', c, c+l)
//      c+=l
      var l2 = b.readUInt16LE(c + l)>>3
      if(_key == key) //return b.toString('utf8', c, c+l2)
        return c+l //read_value(c-2, b)
//      c += 
      c+=l+2+l2+2
    }
  }
}

function test (value) {
  tape('encode/decode:'+JSON.stringify(value), function (t) {
    console.log('test:', value)
    var b = Buffer.alloc(binary.encodingLength(value))
    var l = binary.encode(value, b, 0)
    console.log('encoded:', b.slice(0, l))
    var jl = Buffer.byteLength(JSON.stringify(value))
    console.log('length:', l, 'json-length:', jl)
    if(l > jl) console.log("WARNING: binary encoding longer than json for:", value)
    if(l == 1)
      t.equal(b[0]>>3, 0, 'single byte encodings must have zero length in tag')
    console.log('decoded:', binary.decode(b, 0))
    console.log('---')
    t.deepEqual(binary.decode(b, 0), value)
    t.deepEqual(binary.decode(b.slice(0, l), 0), value)

    t.end()
  })
}

test(100)
test(0)
test(1)
test(-1)
test(true)
test(false)
test(null)
test('')
test(Buffer.alloc(0))
test([])
test({})
test([1,2,3,4,5,6,7,8,9])
test('hello')
test({foo: true})
test([-1, {foo: true}, new Buffer('deadbeef', 'hex')])
test(require('./package.json'))

tape('perf', function (t) {
  var value = require('./package.json')
  var b = Buffer.alloc(binary.encodingLength(value))
  var start = Date.now(), json
  var json = JSON.stringify(value)
  var buffer = new Buffer(JSON.stringify(value))
  var N = 10000
  for(var i = 0; i < N; i++) {
    binary.encode(value, b, 0)
  }
  console.log('binary.encode', Date.now() - start)
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.stringify(value)
  }
  console.log('JSON.stringify', Date.now() - start)
  start = Date.now()
  for(var i = 0; i < N; i++) {
    binary.decode(b, 0)
  }
  console.log('binary.decode', Date.now() - start)
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.parse(json)
  }
  console.log('JSON.parse', Date.now() - start)
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.parse(buffer)
  }
  console.log('JSON.parse(buffer)', Date.now() - start)
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.stringify(JSON.parse(json))
  }
  console.log('JSON.stringify(JSON.parse())', Date.now() - start)

  start = Date.now()
  var dependencies = new Buffer('dependencies'), varint = new Buffer('varint')
  for(var i = 0; i < N; i++) {
    binary.decode(b, binary.seekKey(b, binary.seekKey(b, 0, 'dependencies'), 'varint'))
  }
  console.log('binary.seek', Date.now() - start)

  t.end()
})

