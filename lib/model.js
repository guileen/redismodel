var async = require('async');
var _ = require('dash5');
var util = require('./util');
var general = require('./general');
var _slice = Array.prototype.slice;

function makeModel(modelName, options) {
    var idFactory = (options.idFactory || general.idFactory)(options);
    var entityStore = (options.entityStore || general.entityStore)(options);
    var redis = options.redis;
    var fields = options.fields;
    fields.create_at = fields.create_at || {
        type: Date
    };
    fields.update_at = fields.update_at || {
        type: Date
    };
    var unique_fields = []
      , reversed_fields = {}
      ;

    !function init() {
        for(var fieldName in fields) {
            f = fields[fieldName];
            if(f.unique) {
                unique_fields.push(fieldName);
            }
            if(f.reverse) {
                reversed_fields[fieldName] = f.reverse;
            }
        }
    }();

    var model = {
        save: function(data, callback) {
            if(data.id) {
                model.update(data, callback);
            } else {
                model.insert(data, callback);
            }
        }
      , insert: function(data, callback) {
            var err = this.verify(data);
            var keyfields = _.map(unique_fields, function(field) {
                    return [modelName + '<-' + field, data[field]];
            });
            util.existKeys(redis, keyfields, function(err, existKeys) {
                    if(err) return callback(err);
                    if(existKeys.length) return callback(new Error('Already exists:' + existKeys));
                    model._insert(data, callback);
            })
        }
      , _insert: function(data, callback) {
            idFactory(modelName, function(err, id) {
                    if(err) return callback(err);
                    entityStore.exists(modelName, id, function(err, exists) {
                            if(err) return callback(err);
                            // try again to get a new id.
                            if(exists) return model._insert(data, callback);
                            data.id = id;
                            data.create_at = new Date();
                            model._save(data, true, callback)
                    });
            });
        }
      , update: function(data, callback) {
            var err = this.verify(data);
            if(err) return callback(err);
            data.update_at = new Date();
            model._save(data, false, callback);
        }
      , _save: function(data, isNew, callback) {
            var multi = redis.multi();
            _.each(options.indices, function(field) {
                    multi.zadd(modelName + '+' + field, util.toScore(data[field]), data.id);
            });
            _.each(unique_fields, function(field) {
                    multi.hset(modelName + '<-' + field, data[field], data.id);
            });
            isNew && _.each(reversed_fields, function(type, field) {
                    var fieldValue = data[field];
                    if(typeof fieldValue == 'object') {
                        fieldValue = fieldValue.id;
                    }
                    var key = modelName + '|' + field + ':' + fieldValue;
                    if(type == 'set') {
                        multi.sadd(key, data.id);
                    } else if (type == 'zset') {
                        multi.zadd(key, Date.now(), data.id);
                    } else if (type == 'list') {
                        multi.rpush(key, data.id);
                    }
            });
            multi.exec(function(err) {
                    if(err) throw err;
            });
            entityStore.set(modelName, data.id, data, function(err, results) {
                    if(err) return callback(err);
                    callback(err, data);
            });
        }
      , remove: function(id, callback) {
            entityStore.remove(modelName, typeof id == 'object' ? id.id : id, callback);
        }
      , verify: function(data) {
            var f, v, def;
            for(var name in fields) {
                f = fields[name];
                v = data[name];
                if(v == null && f.default) {
                    def = f.default;
                    v = data[name] = typeof def === 'function' ? def(data) : def;
                }
                if(f.required && v == null) {
                    return new Error('field ' + name + ' is required');
                }
                // TODO more verify
            }
        }
      , get: function(id, callback) {
            entityStore.get(modelName, id, callback);
        }
      , getFull: function(id, callback) {
            this.get(id, function(err, data) {
                    // TODO remove async, use dash5
                    async.map(model_fields, function(fieldAndType, emit) {
                            // model
                            var field_id = data[fieldAndType[0] + '_id'];
                            var field_model = all_models[fieldAndType[1]];
                            field_id && field_model ? field_model.get(field_id, emit) : emit();
                        }, function(err, results) {
                            _.each(model_fields, function(fieldAndType, i) {
                                    data[fieldAndType[0]] = results[i];
                            })
                            callback(err, data);
                    });
            });
        }
      , by: {}
      , fullBy: {}
      , of: {}
      , fullOf: {}
      , fetch: {}
      , fullFetch: {}
    };

    // unique field map By
    unique_fields.forEach(function(field) {
            function mapGet(fn) {
                return function(value, callback) {
                    redis.hget(modelName + '<-' + field, value, function(err, id) {
                            if(err) return callback(err);
                            fn(id, callback);
                    })
                }
            }
            model.by[field] = mapGet(model.get);
            model.fullBy[field] = mapGet(model.getFull);
    })

    // reverse field map Of
    _.each(reversed_fields, function(reverseType, field) {
            var prefix = modelName + '|' + field + ':';
            var range = {
                set: function(key, offset, limit, callback) {
                    limit
                    ? redis.srandmember(key, limit, callback)
                    : redis.smembers(key, callback);
                }
              , zset: function(key, offset, limit, callback) {
                    redis.zrange(key, offset, limit ? offset + limit : -1, callback);
                }
              , list: function(key, offset, limit, callback) {
                    redis.lrange(key, offset, limit ? offset + limit : -1, callback);
                }
            }[reverseType];
            function mapList(iterator) {
                return function(value, offset, limit, callback) {
                    if(!callback) {
                        if(typeof limit == 'function') {
                            callback = limit;
                            limit = null;
                        } else if(typeof offset == 'function') {
                            callback = offset;
                            offset = null;
                        }
                    }
                    offset = offset || 0;
                    range(prefix + value, offset, limit, function(err, list) {
                            async.map(list, iterator, callback);
                    })
                }
            }
            model.of[field] = mapList(model.get);
            model.fullOf[field] = mapList(model.getFull);
    });

    // any commands returns array
    ;['sort', 'scan', 'hscan', 'sscan', 'zscan', 'mget', 'hkeys', 'hvals', 'lrange', 'sdiff', 'sinter', 'smembers', 'srandmember', 'sunion', 'zrange', 'zrangebyscore', 'zrevrange', 'zrevrangebyscore'].forEach(function(command) {
            function mapCommand(command, iterator) {
                return function(){
                    var args = _slice.call(arguments);
                    var callback = args.pop();
                    args[args.length - 1] = function(err, results) {
                        if(err) return callback(err);
                        if(command[0] == 'z' && args[args.length - 2].toLowerCase() == 'withscores') {
                            // zrange 0 -1 withscores
                            // results is [member1, score1, member2, score2 ...]
                            paris = util.splitPairs(results);
                            results = paris[0];
                            scores = paris[1];
                            var _callback = callback;
                            callback = function(err, modelList) {
                                if(err) _callback(err);
                                for (var i = 0, l = modelList.length; i < l; i ++) {
                                    var v = modelList[i];
                                    v._score = scores[i];
                                }
                            }
                        }
                        async.map(results, iterator, callback);
                    }
                    redis[command].apply(redis, args);
                }
            }
            model.fetch[command] = mapCommand(command, model.get);
            model.fullFetch[command] = mapCommand(command, model.getFull);
    });
    return model;
};

exports.makeModel = makeModel;
