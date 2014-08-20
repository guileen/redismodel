var co = require('co')
var _before = before
var _it = it
var _after = after

exports.cobefore = function (fn) {
  _before(function(done) {
      co(fn)(done)
  })
}

exports.coafter = function (fn) {
  _after(function(done) {
      co(fn)(done)
  })
}

exports.coit = function (description, fn) {
  _it(description, function(done) {
      co(fn)(done)
  })
}
