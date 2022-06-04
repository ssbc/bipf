const STRING = 0 // 000
const BUFFER = 1 // 001

const INT = 2 // 010 // 32bit int
const DOUBLE = 3 // 011 // use next 8 bytes to encode 64bit float

const ARRAY = 4 // 100
const OBJECT = 5 // 101

const BOOLNULL = 6 // 110 // and use the rest of the byte as true/false/null
const RESERVED = 7 // 111

const ALREADY_BIPF = 8

const TAG_SIZE = 3
const TAG_MASK = 7

module.exports = {
  STRING,
  BUFFER,
  INT,
  DOUBLE,
  ARRAY,
  OBJECT,
  BOOLNULL,
  RESERVED,

  ALREADY_BIPF,

  TAG_SIZE,
  TAG_MASK,

  types: {
    string: STRING,
    buffer: BUFFER,
    int: INT,
    double: DOUBLE,
    array: ARRAY,
    object: OBJECT,
    boolnull: BOOLNULL,
    reserved: RESERVED,
  },
}
