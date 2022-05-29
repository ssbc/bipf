const tape = require('tape')
const bipf = require('../')
const fixtures = require('bipf-spec/fixtures.json')

tape('fixtures compare', (t) => {
  for (let i = 0; i < fixtures.length; ++i) {
    const f = fixtures[i]
    t.comment(`testing: ${f.name}`)
    t.ok(f.json, 'has json data')

    const buf = Buffer.from(f.json, 'hex')
    const jsonValue = JSON.parse(buf.toString('utf8'))
    const bipfBuffer = bipf.allocAndEncode(jsonValue)

    t.equal(f.binary, bipfBuffer.toString('hex'))
  }

  t.end()
})
