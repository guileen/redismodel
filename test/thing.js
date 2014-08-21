var co = require('co')
var expect = require('expect.js')
var util = require('./util')

var redismodel = require('../lib/redismodel')
var client = require('./client')

var before = util.cobefore
var it = util.coit
var after = util.coafter
var Thing

before(function*() {
    yield function(cb) {
      client.flushdb(cb)
    }

    // name, scheme, index fields
    Thing = redismodel('thing', {
        scheme: {
          id: 'int',
          type: String,
          int: 'int',
          color: String,
          owner: String
        },
        indices: [],
        unique: [],
        maxIndexLen: 25,
        client: client,
        hash: function defaultHash(str) {
          return require('crypto').createHash('md5').update(str).digest("hex").substring(0, 16)
        }
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

})

describe('thing', function() {
    var id
    it('should save thing', function*() {
            var thing = yield Thing.insert({name: 'myname', int: 9})
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('myname')
            expect(thing.int).to.eql(9)
            id = thing.id
    })

    it('should get thing', function*() {
            var thing = yield Thing.get(id)
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('myname')
            expect(thing.int).to.eql(9)
    })

    it('should update thing', function*() {
            yield Thing.update(id, {name:'name2', int:8})
            var thing = yield Thing.get(id)
            expect(thing.id).to.be.ok()
            expect(thing.name).to.eql('name2')
            expect(thing.int).to.eql(8)
    })

    it('should remove thing', function*() {
            yield Thing.remove(id)
            var thing = yield Thing.get(id)
            expect(thing).to.be.null
    })
    describe('index', function() {
        var things
        before(function*() {
            var types = ['dog', 'cat', 'pig']
            var owners = ['jack', 'tom']
            var colors = ['blue', 'red', 'orange', 'black', 'white']
            for(var i=0;i<60;i++) {
              yield Thing.insert({
                  name:'name',
                  age:i,
                  type: types[i % types.length],
                  color: colors[i % colors.length],
                  owner: owners[i % owners.length]
              })
            }
        })
        it('could filter default range', function*() {
            things = yield Thing.range(100)
            expect(things.length).to.eql(60)
        })

        it('should be empty when out of range', function*() {
            things = yield Thing.range(100, 61)
            expect(things.length).to.eql(0)
        })

        it('should ensureIndex dynamic', function*() {
            yield Thing._ensureIndex('age')
        })

        it('should range with index', function*() {
            things = yield Thing.range(50, 0, {age: -1}, [50, 100])
            expect(things.length).to.eql(0)

            things = yield Thing.range(20, 5, {age: -1}, [20, 0])
            expect(things.length).to.eql(16)
            expect(things[0].age).to.eql(15)
            expect(things[15].age).to.eql(0)
        })

        it('should throw error without index', function*() {
            // TODO
        })

        it('should ensureIndex with one subset', function*() {
            yield Thing._ensureIndex(['createTime', ['type']])
        })

        it('should find with one subset', function*() {
            things = yield Thing.range({type: 'cat'}, 100, 0)
            expect(things.length).to.eql(20)
            things = yield Thing.range({type: 'cat'}, 100, 21)
            expect(things.length).to.eql(0)
        })

        it('should ensureIndex with multi subset', function*() {
            yield Thing._ensureIndex(['createTime', ['type', 'owner']])
        })

        it('should find with multi subset', function*() {
            things = yield Thing.range({type: 'cat', owner: 'tom'}, 100, 0)
            expect(things.length).to.eql(10)
        })

        it('should ensureIndex with multi subset with hash', function*() {
            yield Thing._ensureIndex(['createTime', ['type', 'owner', 'color'], true])
        })

        it('should find with multi subset with hash', function*() {
            things = yield Thing.range({type: 'cat', owner: 'tom', color: 'black'}, 100, 0)
            expect(things.length).to.eql(2)
        })
    })
})
