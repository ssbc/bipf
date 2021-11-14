var File = require('pull-file')
var pull = require('pull-stream')

var l = 0,
  c = 0,
  start = Date.now()
pull(
  File(process.argv[2]),
  pull.drain(
    function (e) {
      c++
      l += e.length
    },
    function (err, value) {
      console.log(l, c, l / c, Date.now() - start)
    }
  )
)
