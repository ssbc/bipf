# BIPF

Binary In-Place Format. A binary format designed for in-place (without
parsing) reads, with schemaless json-like semantics.

## Motivation

### In-place reads

In a database there are many cases where you need to read a bunch of
records, filter out most of it (if one or two fields do not match) and
then immediately write whats left to a network socket. With json, this
means parsing possibly hundreds of thousands of json objects (which is
suprisingly slow), and then reserializing whats left.  An inplace
format doesn't actually require parsing as a whole at all. You only
need to parse the fields you actually read, and using length delimited
fields instead of escapes, means you do not have to look at every byte
to parse a field.

### Length delimited collections

Unfortunately, most binary json-like formats (such as msgpack and
cbor) use element counts on collections (objects and arrays, in
json-land) this means to find the end of a collection, you have to
step past each item in it (including the fields in any object
contained inside of it).  However, if the collections are length
delimited, meaning marked by the encoded byte length of the object,
not the number of items inside it, then it's easy to jump right to the
end of the object in one go.  For this reason, databases (for example,
mongodb, and couchdb) use length delimited collections.

## Format

The format of BIPF is specificed in the
[spec](https://github.com/ssbc/bipf-spec).

All values must have a correct length field. This makes it possible to
traverse all fields without looking at the values. Therefore it is
possible to quickly jump to any subvalue if you know it's path. If you
are looking for a particular string, you can also skip any with the
wrong length! Since object and array fields also begin with a length,
you can jump past them if you know they do not contain the value you
are looking for. This means that seeking inside a more tree like
object is more efficient than seeking inside a more list like object!

## Performance

This design is optimized for the performance of in-place
reads. Encoding is expected to be slower because of the need to
calculate the length of collections before encoding them. If encoding
is within half as fast as a format intended for encoding perf, that is
good. Of course, the intention with an in-place read system is that
you encode _once_ and then never decode. Just pass around the binary
object, reading fields out when necessary.

Because of the length encoding, the ability to update in-place is very
limited (not recommended actually) but if you are building a system
around immutable data, that is not much of a problem. Although, since
subobjects are fully valid as an encoded value, you can easily copy a
subobject into a new object, etc, without re-encoding.

## Benchmark

I did a simple benchmark, where I encoded and decoded this module's
package.json file in various ways. Please not that I am comparing the
performance of code written in C with code written in javascript. If
the javascript is within 10x the performance of the C then we are
doing well! (and a C implementation would likely close that gap)

The measurement is run 10k operations, then divide by number of ms
taken, higher number means more faster!

Benchmark code is in `./test/perf.js`

```
operation, ops/ms
binary.encode 62.61740763932373
JSON.stringify 325.7328990228013
binary.decode 83.40283569641367
JSON.parse 242.13075060532688
JSON.parse(buffer) 198.4126984126984
JSON.stringify(JSON.parse()) 127.55102040816327
binary.seek(string) 500
binary.seek2(encoded) 1219.5121951219512
binary.seek(buffer) 1333.3333333333333
binary.seekPath(encoded) 558.659217877095
binary.seekPath(compiled) 1265.8227848101267
binary.compare() 1785.7142857142858
```

As expected, `binary.encode` is much slower than `JSON.stringify`, but
it's only 6 times worse. But the interesting comparison is
`JSON.stringify(JSON.parse())` and `binary.seek(buffer)`. Often, in
implementing a database, you need to read something from disk, examine
one or two fields (to check if it matches a query) and then write it
to network.

(note: the `binary.seek` operation is fairly realistic, we seek to the
"dependencies" object, then look up "varint" inside of that, then
decode the version range of "varint". So it's two comparisons and
decoding a string out)

So, in JSON land, that usually means reading it, parsing it, checking
it, stringifying it again. This involves reading each byte in the
input and allocating memory for the parsed object. Then traversing
that object in memory and writing something to a string (more memory
allocation, and all this memory allocation means the garbage collector
needs to handle it too)

But if we have in-place reads, we just read raw binary, seek into the
appropiate places to check wether it's the objects we want, and then
write it to the network directly. We don't allocate _any_ new memory
after reading it.

Further benchmarks and tests are necessary, but that it can be this
fast using a _javascript implementation_ is impressive.

## Cannonicisity

For a system with signatures, it's highly important that data is
_cannonical_. There should be exactly one way to encode a given data
structure. There are a few edge cases here that need to be checked
for. (not implemented yet)

* varints must not be zero padded
* chrome and firefox preserve order of object keys, but any integer
  keys greater than zero come first, and are in increasing order.
* the length of subfields *must* be checked to not excede their
  container's length. (This is a security issue)

These properties can all be checked by traversing the tags but without
reading the keys or values. I will not consider this module _ready_
until there are tests that cover these invalid cases, to ensure that
implementations throw an error.

## API

`encode, decode, encodingLength` follow the interface specified by
[`abstract-encoding`](https://github.com/mafintosh/abstract-encoding)

### encodingLength(value) => length

returns the length needed to encode `value`

### encode(value, buffer, start) => length

write `value` to `buffer` from start.  returns the number of bytes
used.

### allocAndEncode(value) => buffer

allocate a new buffer and write `value` into it.  returns the newly
created buffer.

### encodeIdempotent(value, buffer, start) => length

same as `encode`, but *tags* the buffer as being a `bipf` buffer, such
that you can place this buffer in another encoded bipf, and it won't
be "double encoded", it will just be embedded inside the larger buffer.

### allocAndEncodeIdempotent(value) => buffer

same as `allocAndEncode`, but *tags* the resulting buffer as being a
`bipf` buffer.

Example:

```js
var obj = {address: {street: '123 Main St'}}
var buf1 = bipf.allocAndEncode(obj)

var innerObj = {street: '123 Main St'}
var innerBuf = bipf.allocAndEncodeIdempotent(innerObj)
var outerObj = {address: innerBuf}
var buf2 = bipf.allocAndEncode(outerObj)

deepEquals(buf1, buf2) // true
```

Counter-example:

```js
var obj = {address: {street: '123 Main St'}}
var buf1 = bipf.allocAndEncode(obj)

var innerObj = {street: '123 Main St'}
var innerBuf = bipf.allocAndEncode(innerObj)
var outerObj = {address: innerBuf}
var buf2 = bipf.allocAndEncode(outerObj)

deepEquals(buf1, buf2) // false
```

### markIdempotent(buffer) => buffer

does nothing else but *tag* the buffer as being a `bipf` buffer, such
that you can place it in another encoded bipf, and it won't be "double
encoded", it will just be embedded inside the larger buffer.

returns the same buffer as the input.

### isIdempotent(buffer) => boolean

returns true if `buffer` received an `encodeIdempotent()` call or a
`markIdempotent()` call.

### decode(buffer, start) => value

read the next value from `buffer` at `start`.  returns the value, and
sets `decode.bytes` to number of bytes used.

### pluck(buffer, start) => buffer

reads the value from BIPF-encoded `buffer` at `start`, and returns the
*encoded* value at that pointer, without decoding it.

### getValueType(value) => type

returns the type tag that will be used to encode this type.

### getEncodedType(buffer, start) => type

get the `type` tag at `start`

### types.{string,buffer,int,double,array,object,boolnull,reserved}

an object containing the type tags.

### iterate(buffer, start, fn) => void

If the field at `start` is an object or array, then `iterate` will
call the `fn` with arguments `fn(buffer, pointer, key)` for each
subfield. If the field at `start` is not an array or object, this
returns `-1`. You can stop/abort the iteration by making `fn` return
any truthy value.

### seekKey(buffer, start, target) => pointer

Seek for a key `target` within an object. If `getEncodedType(buffer,
start) !== types.object` then will return `-1`. Otherwise, seekKey
will iterate over the encoding object and return a pointer to where it
starts.

Since this defines a recursive encoding, a pointer to any valid
sub-encoding is a valid start value.

``` js
var obj = {
  foo: 1,
  bar: true,
  baz: 'hello'
}
//allocate a correctly sized buffer
var length = b.encodingLength(obj)
var buffer = Buffer.alloc(length)

//encode object to buffer
b.encode(obj, buffer, 0)

//parse entire object and read a single value
console.log(b.decode(buffer, 0).baz)

//seek and decode a single value
console.log(b.decode(buffer, b.seekKey(buffer, 0, 'baz')))
```

See performance section for discussion on the performance of seek - if
it's only needed to parse a couple of elements, it can be
significantly faster than parsing.

### seekKey2(buffer, start, target, target_start) => pointer

Same as `seekKey`, except `target` must be an encoded value. This is
usually done using `allocAndEncode`. This is a bit faster.

### seekKeyCached(buffer, start, target) => pointer

Same as `seekKey`, but uses a cache to avoid re-seeking the pointers
if the same arguments have been provided in the past. However,
`target` must be a string, not a buffer.

### seekPath(buffer, start, array_of_buffers) => pointer

The same as `seekKey`, except for a recursive path.  `path` should be
an array of node buffers, just holding the key values, not encoded as
`bipf`.

### createSeekPath(path) => seekPath(buffer, start)

Compiles a javascript function that does a seekPath. This is
significantly faster than iterating over a javascript array and then
looking for each thing, because it will get optimized by the js
engine's jit compiler.


## License

MIT


