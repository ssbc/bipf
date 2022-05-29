const bipf = require('../')

function generateFixture(value) {
  const jsonValue = JSON.stringify(value)
  const jsonBuf = Buffer.from(jsonValue, 'utf8')
  let f = {
    name: jsonValue,
    json: jsonBuf.toString('hex'),
  }

  const bipfBuffer = bipf.allocAndEncode(value)
  f.binary = bipfBuffer.toString('hex')

  console.log(JSON.stringify(f, null, 2))
}

//generateFixture(1.234)
//generateFixture("möterhead")
