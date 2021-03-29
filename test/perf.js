var binary = require('../')
var tape = require('tape')
var pkg = require('../package.json')

function encode (string) {
  var b = Buffer.alloc(binary.encodingLength(string))
  binary.encode(string, b, 0)
  return b
}

var value = pkg
var b = Buffer.alloc(binary.encodingLength(value))
var start, json
var json = JSON.stringify(value)
var buffer = Buffer.from(JSON.stringify(value))
var N = 100000

console.log('operation, ops/ms')
start = Date.now()
for(var i = 0; i < N; i++) {
  //not an honest test
  b = Buffer.allocUnsafe(binary.encodingLength(value))
  binary.encode(value, b, 0)
}
console.log('binary.encode', N/(Date.now() - start))
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
var dependencies = Buffer.from('dependencies')
var varint = Buffer.from('varint')
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


