var co = require('co')
var coredis = require('co-redis')
var formconv = require('formconv')

/**
 * Constructor redis model.
 * A RedisModel will make below keys:
 *   {collection}/seq      the incremental id.
 *   {collection}:id       hash, the object data.
 *   {collection}+{field}  zset, field float index
 *
 *   TODO unique
 *   TODO string sort
 *
 * @param {String} collectionName e.g 'user'
 * @param {Object} opts options
 *        {
 *          scheme: {
 *            id: 'int',
 *            name: String,
 *            createTime: Date
 *          },
 *          indices: [],
 *          unique: []
 *        }
 */
module.exports = function RedisModel(collectionName, opts) {
  var scheme = opts.scheme
  var objScheme = formconv(scheme)
  var indices = opts.indices || []
  var uniques = opts.uniques || []
  var redis = coredis(opts.client)
  uniques.push('id')
  indices.push('createTime')

  var KEY_SEQ = collectionName + '/seq'
  var KEY_ROW_PREFIX = collectionName + ':'
  var KEY_INDEX_PREFIX = collectionName + '+'
  var KEY_INDICES = collectionName + '/indices'

  function* insert(obj) {
    yield checkUniqueIndices(obj)

    if(Model.onBeforeInsert) yield Model.onBeforeInsert(obj)
    if(Model.onBeforeSave) yield Model.onBeforeSave(obj)

    // Do insert
    var id = yield redis.incr(KEY_SEQ)
    obj.id = id
    obj.createTime = Date.now()
    yield redis.hmset(KEY_ROW_PREFIX + id, obj)
    yield updateIndices(id, obj)

    if(Model.onInsert) yield Model.onInsert(obj)
    if(Model.onSave) yield Model.onSave(obj)

    return obj
  }

  function* update(id, obj) {
    if(!id) throw new Error('update require id')
    yield checkUniqueIndices(obj)

    if(Model.onBeforeUpdate) yield Model.onBeforeUpdate(obj)
    if(Model.onBeforeSave) yield Model.onBeforeSave(obj)

    // Do update
    obj.updateTime = Date.now()
    yield redis.hmset(KEY_ROW_PREFIX + id, obj)
    yield updateIndices(id, obj)

    if(Model.onUpdate) yield Model.onUpdate(obj)
    if(Model.onSave) yield Model.onSave(obj)

    return obj
  }

  function* get(id) {
    var obj = yield redis.hgetall(KEY_ROW_PREFIX + id)
    return obj
    // return objScheme.parse(obj)
  }

  function* remove(id) {
    var obj = yield get(id)
    if(Model.onBeforeRemove) yield Model.onBeforeRemove(obj)
    yield redis.del(KEY_ROW_PREFIX +id)
    if(Model.onRemove) yield Model.onRemove(obj)
    yield removeIndices(id, obj)
  }

  /**
   * @param {Object|Array} sort 'age' {age:-1} {age:-1} ['age', 1], ['age', -1]
   * @return [field, 1|-1]
   */
  function normalizeSort(sort) {
    var typeofsort = typeof sort
    if(typeofsort == 'object') {
      var keys = Object.keys(sort)
      if(keys.length > 1) throw new Error("multi sort field")
      else if(keys.length == 1) {
        sort = [keys[0], sort[keys[0]]]
      } else {
        sort = null
      }
    } else if(typeofsort == 'string') {
      sort = [sort, 1]
    }
    return sort || ['createTime', 1]
  }

  /**
   * rangeIds(count, offset, sort, minmax)
   * rangeIds(count, sort, minmax)
   * rangeIds(sort, minmax)
   *
   * @param {Object|Array} sort 'age' {age:-1} {age:-1} ['age', 1], ['age', -1]
   *
   */
  function* rangeIds(count, offset, sort, minmax) {
    // handle arguments
    if(typeof offset == 'object' && minmax === undefined) {
      minmax = sort
      sort = offset
      offset = 0
    } else if(typeof count == 'object' && sort === undefined) {
      minmax = offset
      sort = count
      offset = 0
      count = 50
    }
    if(!minmax) minmax = ['-inf', '+inf']
    sort = normalizeSort(sort)

    // do range
    var key = KEY_INDEX_PREFIX + sort[0]
    if(sort[1] == -1) {
      return yield redis.zrevrangebyscore(key, minmax[0], minmax[1], 'LIMIT', offset, count)
    }
    return yield redis.zrangebyscore(key, minmax[0], minmax[1], 'LIMIT', offset, count)
  }

  function* range(count, offset, sort, minmax) {
    var ids = yield rangeIds(count, offset, sort, minmax)
    return yield ids.map(get)
  }

  function* _ensureIndex(indexField) {
    var isIndex = yield redis.sismember(KEY_INDICES, indexField)
    if(isIndex) return
    indices.push(indexField)
    var count = 100
    var offset = 0
    while(true) {
      var objs = yield range(count, offset)
      yield objs.map(function(obj) {
          return updateIndex(indexField, obj.id, obj)
      })
      if(objs.length < count) break
      offset += objs.length
    }
    yield redis.sadd(KEY_INDICES, indexField)
  }

  function ensureIndex(indexField, callback) {
    co(function*() {
        yield _ensureIndex(indexField)
    })(callback)
  }

  function* updateIndex(indexField, id, obj) {
    var key = KEY_INDEX_PREFIX + indexField
    var value = obj[indexField]
    if(value === undefined) {
      // not provide
      return
    }
    yield redis.zadd(key, value, obj.id)
  }

  function* updateIndices(id, obj) {
    yield indices.map(function(indexField) {
        return updateIndex(indexField, id, obj)
    })
  }

  function* removeIndices(id, obj) {
    yield indices.map(function(indexField) {
        var key = KEY_INDEX_PREFIX + indexField
        var value = obj[indexField]
        return redis.zrem(key, obj.id)
    })
  }

  function* checkUniqueIndices(id, obj) {
    // TODO checkUniqueIndices
  }

  for(var i=0;i<indices.length;i++) {
    ensureIndex(indices[i])
  }

  var Model = {
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    rangeIds: rangeIds,
    range: range,
    // ensureIndex
    ensureIndex: ensureIndex,
    parse: scheme.parse
  }
  return Model

}
