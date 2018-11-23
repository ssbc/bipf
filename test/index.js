var binary = require('../')
var tape = require('tape')
var pkg = require('../package.json')
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

/*
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
*/

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
test(pkg)

function encode (string) {
  var b = Buffer.alloc(binary.encodingLength(string))
  binary.encode(string, b, 0)
  return b
}

tape('perf', function (t) {
  var value = pkg
  var b = Buffer.alloc(binary.encodingLength(value))
  var start = Date.now(), json
  var json = JSON.stringify(value)
  var buffer = new Buffer(JSON.stringify(value))
  var N = 100000
  console.log('operation, ops/ms')

  for(var i = 0; i < N; i++) {
    binary.encode(value, b, 0)
  }
  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.stringify(value)
  }
  console.log('JSON.stringify', N/(Date.now() - start))
  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    binary.decode(b, 0)
  }
  console.log('binary.decode', N/(Date.now() - start))
  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.parse(json)
  }
  console.log('JSON.parse', N/(Date.now() - start))
  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.parse(buffer)
  }
  console.log('JSON.parse(buffer)', N/(Date.now() - start))
  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    JSON.stringify(JSON.parse(json))
  }
  console.log('JSON.stringify(JSON.parse())', N/(Date.now() - start))


  // ---
  start = Date.now()
  for(var i = 0; i < N; i++) {
    binary.decode(b, binary.seekKey(b, binary.seekKey(b, 0, 'dependencies'), 'varint'))
  }
  console.log('binary.seek(string)', N/(Date.now() - start))

  var _varint = encode('varint'), _dependencies = encode('dependencies')
  start = Date.now()
  for(var i = 0; i < N; i++) {
    binary.decode(b, binary.seekKey2(b, binary.seekKey2(b, 0, _dependencies, 0), _varint, 0))
  }
  console.log('binary.seek2(encoded)', N/(Date.now() - start))
  // ---

  start = Date.now()
  var dependencies = new Buffer('dependencies')
  var varint = new Buffer('varint')
  for(var i = 0; i < N; i++) {
    var c, d
    binary.decode(b, d=binary.seekKey(b, c = binary.seekKey(b, 0, dependencies), varint))
  }
  console.log('binary.seek(buffer)', N/(Date.now() - start))
  // ---

  start = Date.now()
  var path = encode(['dependencies', 'varint'])
  for(var i = 0; i < N; i++) {
    var c, d
    binary.decode(b, d=binary.seekPath(b, c, path))
  }
  console.log('binary.seekPath(encoded)', N/(Date.now() - start))
  // ---

  //What Would Mafintosh Do?
  //he'd take the path and generate javascript that unrolled seek...

  var seekPath = binary.createSeekPath(['dependencies', 'varint'])
  start = Date.now()
  for(var i = 0; i < N; i++) {
    var d
    binary.decode(b, d=seekPath(b, 0))
  }
  console.log('binary.seekPath(compiled)', N/(Date.now() - start))

  //compare

  var compare = binary.createCompareAt([['name'], ['version']])
  start = Date.now()
  for(var i = 0; i < N; i++) {
    compare(b, 0, b, 0)
  }
  console.log('binary.compare()', N/(Date.now() - start))

  t.end()
})


tape('seekPath', function (t) {
  var path = ['dependencies', 'varint']
  var path_buf = Buffer.alloc(binary.encodingLength(path))
  binary.encode(path, path_buf, 0)


  var pkg_buf = Buffer.alloc(binary.encodingLength(pkg))
  binary.encode(pkg, pkg_buf, 0)

  t.equal(
    binary.decode(pkg_buf, binary.seekPath(pkg_buf, 0, path_buf, 0)),
    pkg.dependencies.varint
  )

  t.end()
})

function traverse (buffer, start) {

}

tape('iterate', function (t) {
  var pkg_buf = Buffer.alloc(binary.encodingLength(pkg))
  binary.encode(pkg, pkg_buf, 0)

  var s = ''
  binary.iterate(pkg_buf, 0, function (buffer, pointer, key) {
    var type = binary.getEncodedType (buffer, pointer)
    console.log(JSON.stringify(key), pointer, JSON.stringify(binary.decode(buffer, pointer)))
  })
  t.end()

})

