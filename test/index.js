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

let fixtures = []

function test (value) {
  tape('encode/decode:'+JSON.stringify(value), function (t) {
    let json_value = JSON.stringify(value)
    const json_buf = Buffer.from(json_value, 'utf8')
    let f = {
      "name": json_value,
      "json": json_buf.toString('hex')
    }

    console.log('test:', value)
    var b = Buffer.alloc(binary.encodingLength(value))
    var l = binary.encode(value, b, 0)
    var enc = b.slice(0, l)
    console.log('encoded:', enc)
    f.binary = enc.toString('hex')
    //''+jsonString to get 'undefined' string.
    var jl = Buffer.byteLength(''+JSON.stringify(value))
    console.log('length:', l, 'json-length:', jl)
    if(l > jl) console.log("WARNING: binary encoding longer than json for:", value)
    if(l == 1)
      t.equal(b[0]>>3, 0, 'single byte encodings must have zero length in tag')
    console.log('decoded:', binary.decode(b, 0))
    console.log('---')
    t.deepEqual(binary.decode(b, 0), value)
    t.deepEqual(binary.decode(b.slice(0, l), 0), value)
    fixtures.push(f)
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
// test(undefined) //added undefined for compatibility with charwise
test('')
// test(Buffer.alloc(0))
test([])
test({})
test([1,2,3,4,5,6,7,8,9])
test('hello')
test({foo: true})
test([-1, {foo: true}, Buffer.from('deadbeef', 'hex')])
test(pkg)
test({1: true})


// generate the fixtures.json
/* there must be a better way to know when the above things passed..
setTimeout(() => {
  var fix_data = JSON.stringify(fixtures)
  require('fs').writeFileSync('fixtures_test.json', fix_data)
  console.warn('fixtures generated')
}, 3000)
return
*/

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

tape('iterate object', function (t) {
  var pkg_buf = Buffer.alloc(binary.encodingLength(pkg))
  binary.encode(pkg, pkg_buf, 0)

  var s = ''
  binary.iterate(pkg_buf, 0, function (buffer, pointer, key) {
    var type = binary.getEncodedType (buffer, pointer)
    console.log(JSON.stringify(key), pointer, JSON.stringify(binary.decode(buffer, pointer)))
  })
  t.end()

})

tape('iterate array', function (t) {
  var myarr = ['cat', 'dog', 'bird', 'elephant'];
  var myarr_buf = Buffer.alloc(binary.encodingLength(myarr));
  binary.encode(myarr, myarr_buf, 0);

  var expectedResults = [
    [0, 2, 'cat'],
    [1, 6, 'dog'],
    [2, 10, 'bird'],
    [3, 15, 'elephant'],
  ];
  binary.iterate(myarr_buf, 0, function (buffer, pointer, key) {
    var expected = expectedResults.shift();
    t.equal(key, expected[0], '' + expected[0]);
    t.equal(pointer, expected[1], '' + expected[1]);
    t.equal(binary.decode(buffer, pointer), expected[2], '' + expected[2]);
  });
  t.end();
});
