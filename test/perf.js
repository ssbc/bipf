var binary = require('../')
var faker = require('faker')

function getNonNested() {
  switch (faker.datatype.number(7)) {
    case 0:
      return Buffer.from(faker.random.words(faker.datatype.number(5) + 1))
    case 1:
      return faker.datatype.number(300)
    case 2:
      return faker.datatype.float()
    case 3:
      return faker.datatype.boolean()
    case 4:
      return undefined
    case 5:
      return null
    case 6:
    default:
      return faker.random.words(faker.datatype.number(5) + 1)
  }
}

function getRandomArray(level) {
  return new Array(faker.datatype.number(10) + 1).fill(1).map(function () {
    return buildStructure(level + 1)
  })
}

function buildStructure(level) {
  var selection
  if (level < 1) selection = faker.datatype.number(1)
  else if (level > 3) selection = 2
  else selection = faker.datatype.number(2)
  switch (selection) {
    case 0:
      return getRandomArray(level).reduce(function (agg, e) {
        agg[faker.random.word()] = e
        return agg
      }, {})
    case 1:
      return getRandomArray(level)
    default:
      return getNonNested()
  }
}

faker.seed(348230432)
console.log('Generating JSON structure...')
const genDate = new Date()
var pkg = buildStructure(0)
console.log('Structure generated in ' + (new Date() - genDate) + 'ms')

function encode(string) {
  var b = Buffer.alloc(binary.encodingLength(string))
  binary.encode(string, b, 0)
  return b
}

var value = pkg
var b = Buffer.alloc(binary.encodingLength(value))
var start, json
var json = JSON.stringify(value)
var buffer = Buffer.from(JSON.stringify(value))
var N = 10000

console.log('operation, ops/ms')
start = Date.now()
for (var i = 0; i < N; i++) {
  //not an honest test
  b = Buffer.allocUnsafe(binary.encodingLength(value))
  binary.encode(value, b, 0)
}
console.log('binary.encode', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  JSON.stringify(value)
}
console.log('JSON.stringify', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  binary.decode(b, 0)
}
console.log('binary.decode', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  JSON.parse(json)
}
console.log('JSON.parse', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  JSON.parse(buffer)
}
console.log('JSON.parse(buffer)', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  JSON.stringify(JSON.parse(json))
}
console.log('JSON.stringify(JSON.parse())', N / (Date.now() - start))

// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  binary.decode(
    b,
    binary.seekKey(b, binary.seekKey(b, 0, 'dependencies'), 'varint')
  )
}
console.log('binary.seek(string)', N / (Date.now() - start))

var _varint = encode('varint'),
  _dependencies = encode('dependencies')
start = Date.now()
for (var i = 0; i < N; i++) {
  binary.decode(
    b,
    binary.seekKey2(b, binary.seekKey2(b, 0, _dependencies, 0), _varint, 0)
  )
}
console.log('binary.seek2(encoded)', N / (Date.now() - start))
// ---

start = Date.now()
var dependencies = Buffer.from('dependencies')
var varint = Buffer.from('varint')
for (var i = 0; i < N; i++) {
  var c, d
  binary.decode(
    b,
    (d = binary.seekKey(b, (c = binary.seekKey(b, 0, dependencies)), varint))
  )
}
console.log('binary.seek(buffer)', N / (Date.now() - start))
// ---

start = Date.now()
var path = encode(['dependencies', 'varint'])
for (var i = 0; i < N; i++) {
  var c, d
  binary.decode(b, (d = binary.seekPath(b, c, path)))
}
console.log('binary.seekPath(encoded)', N / (Date.now() - start))
// ---

//What Would Mafintosh Do?
//he'd take the path and generate javascript that unrolled seek...

var seekPath = binary.createSeekPath(['dependencies', 'varint'])
start = Date.now()
for (var i = 0; i < N; i++) {
  var d
  binary.decode(b, (d = seekPath(b, 0)))
}
console.log('binary.seekPath(compiled)', N / (Date.now() - start))

//compare

var compare = binary.createCompareAt([['name'], ['version']])
start = Date.now()
for (var i = 0; i < N; i++) {
  compare(b, 0, b, 0)
}
console.log('binary.compare()', N / (Date.now() - start))
