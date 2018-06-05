# binary

flume binary codec, a compact, cannonical, schemaless, json equivalent,
encoding with in-place field access.

## format

every item is encoded with a varint shifted 3 bits,
with a type stored in the lowest 3 bits. Then the encoding of the value.
```
<tag: varint(encoding_length(value)) << 3 | type><value>
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
```

All values must have a correct length field. This makes it possible
to traverse all fields without looking at the values. Theirfor it is possible
to quickly jump to any subvalue if you know it's path. If you are looking for
a particular string, you can also skip any with the wrong length!
Since object and array fields also begin with a length, you can jump past
them if you know the do not contain the value you are looking for.
This means that seeking inside a more tree like object is more efficient
than seeking into a more list like object!

## License

MIT

