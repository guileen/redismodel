var co = require('co')
var coredis = require('co-redis')
var formconv = require('formconv')

var DEFAULT_MAX_INDEXKEY_LENGTH = 50
function defaultHash(str) {
  return require('crypto').createHash('md5').update(str).digest("hex")//.substring(0, 16)
}

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
  var _indices = opts.indices || []
  var uniques = opts.uniques || []
  var makehash = opts.hash || defaultHash
  var MAX_INDEXKEY_LENGTH = opts.maxIndexLen || DEFAULT_MAX_INDEXKEY_LENGTH
  var redis
  setRedisClient(opts.client)
  uniques.push('id')
  _indices.push('createTime')

  var indices = []

  var KEY_SEQ = collectionName + '/seq'
  var KEY_ROW_PREFIX = collectionName + ':'
  var KEY_INDEX_PREFIX = collectionName + '+'
  var KEY_HASH_PREFIX = collectionName + '%'
  var KEY_INDICES = collectionName + '/indices'
  var SEP_INDEX = '+'
  var SEP_SUBSET = '@'

  function getIndexKey(obj, indexOpts) {
    var indexField = indexOpts[0]
    var subsetFields = indexOpts[1]
    if(!subsetFields) return KEY_INDEX_PREFIX + indexField
    // assume it sorted
    // subsetFields.sort()
    var key = ''
    for(var i=0;i<subsetFields.length;i++) {
      var subField = subsetFields[i]
      key = key + SEP_SUBSET + subField + '(' + obj[subField] + ')'
    }
    key = key + SEP_INDEX + indexField
    if(key.length > MAX_INDEXKEY_LENGTH) {
      return KEY_HASH_PREFIX + makehash(key)
    }
    return collectionName + key
  }

  function getIndexKeyForRange(sort, subsetFilter) {
    var indexField = sort[0]
    var subsetFields = subsetFilter && Object.keys(subsetFilter)
    var indexIndex = getIndexIndex(indexField, subsetFields)
    var indexOpts = [indexField, subsetFields]
    return getIndexKey(subsetFilter, indexOpts)
  }

  function getIndexIndex(indexField, subsetFields) {
    var subsetIndexStr = subsetFields && subsetFields.length > 0 && ('@' + subsetFields.join('@')) || ''
    return subsetIndexStr + '+' + indexField
  }

  function setRedisClient(client) {
    redis = client && coredis(client)
  }

  function* insert(obj) {
    yield checkUniqueIndices(obj)

    if(Model.onBeforeInsert) yield Model.onBeforeInsert(obj)
    if(Model.onBeforeSave) yield Model.onBeforeSave(obj)

    // Do insert
    var id = yield redis.incr(KEY_SEQ)
    obj.id = id
    obj.createTime = Date.now()
    yield redis.hmset(KEY_ROW_PREFIX + id, obj)
    yield updateObjectIndices(id, obj)

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
    yield updateObjectIndices(id, obj)

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
    yield removeObjectIndices(id, obj)
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
   * [subsetFilter], count, [offset], [sort, [minmax]]
   *
   * rangeIds(count, offset, sort, minmax)
   * rangeIds(count, sort, minmax)
   * rangeIds(sort, minmax)
   *
   * @param {Object|Array} sort 'age' {age:-1} {age:-1} ['age', 1], ['age', -1]
   *
   */
  function* rangeIds(subsetFilter, count, offset, sort, minmax) {
    // handle arguments
    if(typeof subsetFilter == 'number') {
      minmax = sort
      sort = offset
      offset = count
      count = subsetFilter
      subsetFilter = null
    }
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

    var key = getIndexKeyForRange(sort, subsetFilter)
    if(sort[1] == -1) {
      return yield redis.zrevrangebyscore(key, minmax[0], minmax[1], 'LIMIT', offset, count)
    }
    return yield redis.zrangebyscore(key, minmax[0], minmax[1], 'LIMIT', offset, count)
  }

  function* range(subsetFilter, count, offset, sort, minmax) {
    var ids = yield rangeIds(subsetFilter, count, offset, sort, minmax)
    return yield ids.map(get)
  }

  function* _ensureIndex(indexOpts) {
    if(typeof indexOpts == 'string') {
      indexOpts = [indexOpts]
    }
    var indexField = indexOpts[0]
    var subsetFields = indexOpts[1]
    var indexIndex = getIndexIndex(indexField, subsetFields)
    var isIndexAdded = yield redis.sismember(KEY_INDICES, indexIndex)
    if(isIndexAdded) return
    indices.push(indexOpts)
    var count = 100
    var offset = 0
    while(true) {
      var objs = yield range(count, offset)
      yield objs.map(function(obj) {
          return updateObjectIndex(indexOpts, obj.id, obj)
      })
      if(objs.length < count) break
      offset += objs.length
    }
    yield redis.sadd(KEY_INDICES, indexIndex)
  }

  function ensureIndex(indexOpts, callback) {
    co(function*() {
        yield _ensureIndex(indexOpts)
    })(callback)
  }

  function* updateObjectIndex(indexOpts, id, obj) {
    var indexField = indexOpts[0]
    var value = obj[indexField]
    if(value === undefined) {
      // not provide
      return
    }
    var key = getIndexKey(obj, indexOpts)
    yield redis.zadd(key, value, obj.id)
  }

  function* updateObjectIndices(id, obj) {
    yield indices.map(function(indexOpts) {
        return updateObjectIndex(indexOpts, id, obj)
    })
  }

  function* removeObjIndex(indexOpts, id, obj) {
    var key = getIndexKey(obj, indexOpts)
    return redis.zrem(key, id)
  }

  function* removeObjectIndices(id, obj) {
    yield indices.map(function(indexOpts) {
        return removeObjIndex(indexOpts, id, obj)
    })
  }

  function* checkUniqueIndices(id, obj) {
    // TODO checkUniqueIndices
  }

  for(var i=0;i<_indices.length;i++) {
    ensureIndex(_indices[i])
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
    _ensureIndex: _ensureIndex,
    parse: scheme.parse
  }
  return Model

}
