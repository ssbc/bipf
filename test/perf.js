var BIPF = require('../')
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
var fakeData = buildStructure(0)
console.log('Structure generated in ' + (new Date() - genDate) + 'ms')
const pkg = require('../package.json')

function encode(string) {
  var b = Buffer.alloc(BIPF.encodingLength(string))
  BIPF.encode(string, b, 0)
  return b
}

var b = Buffer.alloc(BIPF.encodingLength(fakeData))
const msgs = []
var start, json
var json = JSON.stringify(fakeData)
var buffer = Buffer.from(JSON.stringify(fakeData))
var N = 10000
var M = 100 // number of messages

console.log('operation, ops/ms')
start = Date.now()
for (var i = 0; i < N; i++) {
  //not an honest test
  b = Buffer.allocUnsafe(BIPF.encodingLength(fakeData))
  BIPF.encode(fakeData, b, 0)
  if (i < M) {
    msgs.push(
      BIPF.allocAndEncode({
        name: 'bipf',
        version: '' + i,
        dependencies: { varint: '1.2.3' },
      })
    )
  }
}
console.log('BIPF.encode', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  JSON.stringify(fakeData)
}
console.log('JSON.stringify', N / (Date.now() - start))
// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  BIPF.decode(b, 0)
}
console.log('BIPF.decode', N / (Date.now() - start))
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

var b = Buffer.alloc(BIPF.encodingLength(pkg))
BIPF.encode(pkg, b, 0)

// ---
start = Date.now()
for (var i = 0; i < N; i++) {
  BIPF.decode(b, BIPF.seekKey(b, BIPF.seekKey(b, 0, 'dependencies'), 'varint'))
}
console.log('BIPF.seek(string)', N / (Date.now() - start))

// ---

start = Date.now()
var dependencies = Buffer.from('dependencies')
var varint = Buffer.from('varint')
for (var i = 0; i < N; i++) {
  BIPF.decode(b, BIPF.seekKey(b, BIPF.seekKey(b, 0, dependencies), varint))
}
console.log('BIPF.seek(buffer)', N / (Date.now() - start))

var _varint = encode('varint'),
  _dependencies = encode('dependencies')
start = Date.now()
for (var i = 0; i < N; i++) {
  BIPF.decode(
    b,
    BIPF.seekKey2(b, BIPF.seekKey2(b, 0, _dependencies, 0), _varint, 0)
  )
}
console.log('BIPF.seek2(encoded)', N / (Date.now() - start))

start = Date.now()
for (var i = 0; i < N; i++) {
  BIPF.decode(
    b,
    BIPF.seekKey2(b, BIPF.seekKey2(b, 0, _dependencies, 0), _varint, 0)
  )
}
console.log('BIPF.seek2(encoded) second run', N / (Date.now() - start))
// ---

start = Date.now()
for (var i = 0; i < N; i++) {
  var c, d
  BIPF.decode(
    b,
    (d = BIPF.seekKeyCached(
      b,
      (c = BIPF.seekKeyCached(b, 0, 'dependencies')),
      'varint'
    ))
  )
}
console.log('BIPF.seekCached(buffer)', N / (Date.now() - start))
// ---

start = Date.now()
var path = encode(['dependencies', 'varint'])
for (var i = 0; i < N; i++) {
  var c, d
  BIPF.decode(b, (d = BIPF.seekPath(b, c, path)))
}
console.log('BIPF.seekPath(encoded)', N / (Date.now() - start))
// ---

//What Would Mafintosh Do?
//he'd take the path and generate javascript that unrolled seek...

var seekPath = BIPF.createSeekPath(['dependencies', 'varint'])
start = Date.now()
for (var i = 0; i < N; i++) {
  var d
  BIPF.decode(b, (d = seekPath(b, 0)))
}
console.log('BIPF.seekPath(compiled)', N / (Date.now() - start))

//compare

var compare = BIPF.createCompareAt([['name'], ['version']])
start = Date.now()
for (var i = 0; i < N; i++) {
  compare(b, b)
}
console.log('BIPF.compare()', N / (Date.now() - start))

start = Date.now()
var dependencies = Buffer.from('dependencies')
var varint = Buffer.from('varint')
var NM = N / M
for (var i = 0; i < N; i++) {
  var msg = msgs[Math.floor(i / NM)]
  var c, d
  BIPF.decode(
    msg,
    (d = BIPF.seekKey(msg, (c = BIPF.seekKey(msg, 0, dependencies)), varint))
  )
}
console.log('BIPF.seek(uniqueMsg)', N / (Date.now() - start))
// ---

start = Date.now()
for (var i = 0; i < N; i++) {
  var msg = msgs[Math.floor(i / NM)]
  var c, d
  BIPF.decode(
    msg,
    (d = BIPF.seekKeyCached(
      msg,
      (c = BIPF.seekKeyCached(msg, 0, 'dependencies')),
      'varint'
    ))
  )
}
console.log('BIPF.seekCached(uniqueMsg)', N / (Date.now() - start))
// ---
