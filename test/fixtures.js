var tape = require('tape')
var bipf = require('../')


var fs = require('fs')

var fixtures = null

try {
    data = fs.readFileSync('./fixtures.json')   
    fixtures = JSON.parse(data)
} catch (error) {
    console.warn('failed to read fixture data:')
    console.error(error)
    return
}

tape('fixtures compare', (t) => {
    t.notEqual(fixtures, null, "did not get fixtures")
    for(var i = 0; i < fixtures.length; i++) {
        const f = fixtures[i]
        t.comment(`testing: ${f.name}`)
        t.ok(f.json, 'has json data')
        
        const buf = Buffer.from(f.json, 'hex')
        const f_value = JSON.parse(buf.toString('utf8'))

        const value_buf = Buffer.alloc(bipf.encodingLength(f_value))
        const encoded = bipf.encode(f_value, value_buf, 0)

        var enc_buf = value_buf.slice(0, encoded)
        
        t.equal(f.binary, enc_buf.toString('hex'))
    }

    t.end()
})
