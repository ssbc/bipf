# binary

flume binary codec, a compact, cannonical, schemaless, json equivalent,
encoding with in-place field access. NOT READY YET

## format

every item is encoded with a varint shifted 3 bits,
with a type stored in the lowest 3 bits. Then the encoding of the value.
```
<tag: varint(encoding_length(value) << 3 | type)><value>
```
the type indicates the encoding of the value.
valid types are:

```
STRING : 0  // utf8 encoded string
BUFFER : 1  // raw binary buffer
INT    : 2  // little endian 32 bit integer
DOUBLE : 3  // little endian 64 bit float
ARRAY  : 4  // array of any other value
OBJECT : 5  // list of string: value pairs
BOOLNULL:6  // a boolean, or null.
//7 is reserved (not intended to be used)

```

All values must have a correct length field. This makes it possible
to traverse all fields without looking at the values. Theirfor it is possible
to quickly jump to any subvalue if you know it's path. If you are looking for
a particular string, you can also skip any with the wrong length!
Since object and array fields also begin with a length, you can jump past
them if you know the do not contain the value you are looking for.
This means that seeking inside a more tree like object is more efficient
than seeking into a more list like object!

## performance

This design is optimized for the performance of in-place
reads. Encoding is expected to be slower because
of the need to calculate the length of collections
before encoding them. If encoding is within half as fast
as a format intended for encoding perf, that is good.
Of course, the intention with an in-place read system
is that you encode _once_ and then never decode. Just
pass around the binary object, reading fields out when
necessary.

Because of the length encoding, the ability to update
inplace is very limited (not recommended actualy)
but if you are building a system around immutable data,
that is not much of a problem. Although, since subobjects
are fully valid as an encoded value, you can easily
copy a subobject into a new object, etc, without re-encoding.

## benchmark

I did a simple benchmark, where I encoded and decoded
this module's package.json file in various ways. Please
not that I am comparing the performance of code written
in C with code written in javascript. If the javascript
is within 10x the performance of the C then we are doing
well! (and a C implementation would likely close that gap)

The measurement is milliseconds to perform 10k operations.
Code is at the end of `./test.js`

```
binary.encode 228
JSON.stringify 38
binary.decode 212
JSON.parse 52
JSON.parse(buffer) 66
JSON.stringify(JSON.parse()) 96
binary.seek(string) 44
binary.seek(buffer) 10
```
As expected, `binary.encode` is much slower than `JSON.stringify`,
but it's only 6 times worse.
But the interesting comparison is `JSON.stringify(JSON.parse())`
and `binary.seek(buffer)`. Often, in implementing
a database, you need to read something from disk,
examine one or two fields (to check if it matches a query)
and then write it to network.

(note: the `binary.seek` operation is fairly realistic,
we seek to the "dependencies" object, then look up "varint"
inside of that, then decode the version range of "varint".
So it's two comparisons and decoding a string out)

So, in JSON land, that usually means reading it,
parsing it, checking it, stringifying it again.
This involves reading each byte in the input and
allocating memory. Then traversing that object in
memory and writing something to a string
(more memory allocation, and all this memory allocation
impacts the GC in a memory managed language)

But if we have in-place reads, we just read raw binary,
seek into the appropiate places to check wether it's
the objects we want, and then write it to the network
directly. We don't allocate _any_ new memory after
reading it.

Further benchmarks and tests are necessary, but that
it can be this fast using a _javascript implementation_
is impressive.

## cannonicisity

For a system with signatures, it's highly important
that data is _cannonical_. There should be exactly
one way to encode a given data structure. There are
a few edge cases here that need to be checked for.
(not implemented yet)

* varints must not be zero padded
* chrome and firefox preserve order of object keys,
  but any integer keys greater than zero come first,
  and are in increasing order.
* the length of subfields *must* be checked to not excede their container's length. (This is a security issue)

These properties can all be checked by traversing the
tags but without reading the keys or values.
I will not consider this module _ready_ until there
are tests that cover these invalid cases, to ensure
that implementations throw an error.

## License

MIT


