var co = require('co')
var expect = require('expect.js')

var redismodel = require('../lib/redismodel')
var client = require('./client')

before(function(done) {
    client.flushdb(done)
})

// name, scheme, index fields
var Thing = redismodel('thing', {
    scheme: {
      id: 'int'
    },
    indices: [],
    unique: [],
    client: client
})

function log(str){}

Thing.idFactory = function*() {

}

Thing.onBeforeInsert = function*() {
  log('inserting')
}
Thing.onBeforeUpdate = function*() {
  log('updating')
}
Thing.onBeforeSave = function*() {
  log('saving')
}
Thing.onInsert = function*() {
  log('insert')
}
Thing.onUpdate = function*() {
  log('update')
}
Thing.onSave = function*() {
  log('save')
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
            expect(thing.name).to.eql('name2')
            expect(thing.int).to.eql(8)
        })(done)
    })

    it('should remove thing', function(done) {
        co(function*() {
            yield Thing.remove(id)
            var thing = yield Thing.get(id)
            expect(thing).to.be.null
        })(done)
    })

    it('should filter range things', function(done) {
        co(function*() {
            for(var i=0;i<50;i++) {
              yield Thing.insert({name:'name', int:i})
            }
            Thing.ensureIndex('int')
            var things
            things = yield Thing.range(10, 0)
            expect(things.length).to.eql(10)

            things = yield Thing.range(10, 50)
            expect(things.length).to.eql(0)

            things = yield Thing.range(50, 0, {int: -1}, [50, 100])
            expect(things.length).to.eql(0)

            things = yield Thing.range(20, 5, {int: -1}, [20, 0])
            expect(things.length).to.eql(16)
            expect(things[0].int).to.eql(15)
            expect(things[15].int).to.eql(0)
        })(done)
    })
})
