var co = require('co')
var expect = require('expect.js')

var redismodel = require('../lib/redismodel')
var client = require('./client')

// name, scheme, index fields
var Thing = redismodel('thing', {
    scheme: {
      id: 'int'
    },
    indices: [],
    unique: [],
    client: client
})

Thing.idFactory = function*() {

}

Thing.onBeforeInsert = function*() {
  console.log('inserting')
}
Thing.onBeforeUpdate = function*() {
  console.log('updating')
}
Thing.onBeforeSave = function*() {
  console.log('saving')
}
Thing.onInsert = function*() {
  console.log('insert')
}
Thing.onUpdate = function*() {
  console.log('update')
}
Thing.onSave = function*() {
  console.log('save')
}

describe('thing', function() {
    var id
    it('should save thing', function(done) {
        co(function*() {
            var thing = yield Thing.insert({name: 'myname', int: 9})
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('myname')
            expect(thing.int).to.eql(9)
            id = thing.id
        })(done)
    })

    it('should get thing', function(done) {
        co(function*() {
            var thing = yield Thing.get(id)
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('myname')
            expect(thing.int).to.eql(9)
        })(done)
    })

    it('should update thing', function(done) {
        co(function*() {
            yield Thing.update(id, {name:'name2', int:8})
            var thing = yield Thing.get(id)
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('myname')
            expect(thing.int).to.eql(8)
        })(done)
    })

    it('should filter range things', function(done) {
        co(function*() {
            var things = yield Thing.range(50, 0, {int: -1}, [10, 20])
        })(done)
    })
})
