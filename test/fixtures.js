const tape = require('tape')
const bipf = require('../')
const fs = require('fs')
const fixtures = require('bipf-spec/fixtures.json')

tape('fixtures compare', (t) => {
  try {
    for (let i = 0; i < fixtures.length; ++i) {
      const f = fixtures[i]
      t.comment(`testing: ${f.name}`)
      t.ok(f.json, 'has json data')

      const buf = Buffer.from(f.json, 'hex')
      const jsonValue = JSON.parse(buf.toString('utf8'))
      const bipfBuffer = bipf.allocAndEncode(jsonValue)

      t.equal(f.binary, bipfBuffer.toString('hex'))
    }
  } catch (error) {
    console.warn('failed to read fixture data:')
    console.error(error)
    t.equal(error, null, 'failed to compare fixture')
  }

  t.end()
})
