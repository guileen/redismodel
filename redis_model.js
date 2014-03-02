// base redis model
//
// MaxID:
// _meta:foo id                id sequence
//
// Hash object:
// foo:id  hash                object
//
// Index field(sort by int field):
// ### model.index(fieldname)
// foo+indexfield              e.g. zadd foo+create_at foo.create_at foo.id
// model.list_by_field 
//
// Typed field:
// ### model.type(fieldname, type)
// ### model.retrival()  // retrival field value of type
//
// One to one:
// ### model.unique(fieldname, type)
// foo#email:email
// user.unique('email')
// user.get_by_email(email)
//
// Many to one:
// ### model.many_to_one(fieldname)
// foo.many_to_one(author, user)
// foo.list_by_author
// foo|author:name             e.g. zadd `foo#author: + foo.author`  Date.now() foo.id
//
// Many to many:
// e.g. comment with {id: id, foo:fid, bar:bid}
// ### model.m2m(fieldname1, fieldname2)
// comment/bar|foo:fid
// comment/foo|bar:bid
//
// Blob:
// store in others DB
// ### model.blob(fieldname, {
//      get: function(id, callback) {
//      }
//    , set: function(id, blob, callback) {
//      }
//    , del: function(id, callback) {
//      }
// })
//
// foo.blob('text', leveldb_blob('foo'))
var _ = require('dash5');
var all_models = {};

var redisStorage = {
    get: function(model_name, id, callback) {

    }
  , set: function(model_name, id, data, callback) {

    }
  , del: function(model_name, id, callback) {

    }
}

var redisIdFactory = function(model_name, callback) {
    redis.incr('_meta:' + model_name, callback);
}

function toScore(value) {
    if(value instanceof Date) {
        return value.getTime();
    }
    return Number(value) || 0;
}

function listIdByScore(key, rev, offset, limit, min, max, callback) {
    if(!callback) {
        if(typeof max == 'function') {
            callback = max;
            max = null;
        } else if(typeof min == 'function') {
            callback = min;
            min = null;
        }
    }
    if(min || max) {
        if(!max) max = '+inf';
        if(!min) min = '-inf';
        redis[rev ? 'zrevrangebyscore' : 'zrangebyscore'](key, min, max, 'LIMIT', offset, limit, callback);
    } else {
        redis[rev ? 'zrevrange' : 'zrange'](key, offset, offset + limit, callback);
    }
}

function RedisModel(model_name, _redis, idFactory, entityStore) {
    var redis = _redis;
    var model_fields = [];
    var field_types = {};
    var index_fields = []; // sort by int fields
    var unique_fields = []; // one to one fields

    idFactory = idFactory || redisIdFactory;
    entityStore = entityStore || redisStorage;

    function convert(data) {
        _.each(field_types, function(field, type) {
                switch(type) {
                  case Date:
                    data[field] = data[field].toISOString()
                    break;
                  case Number:
                    break;
                  default:
                    // model fields to field_id
                    if(data[field]) {
                        delete data[field];
                    }
                }
        });
        return data;
    }

    function revert(data) {
        _.each(field_types, function(field, type) {
                switch(type) {
                  case Number:
                    data[field] = Number(data[field]);
                    break;
                  case Date:
                    data[field] = new Date(data[field]);
                    break;
                  default:
                    // model fields
                }
        })
        return data;
    }
    function listByScore(key, rev, offset, limit, min, max, callback) {
        if(!callback) {
            if(typeof max == 'function') {
                callback = max;
                max = null;
            } else if(typeof min == 'function') {
                callback = min;
                min = null;
            }
        }
        listIdByScore(key, rev, offset, limit, min, max, function(err, listId) {
                async.map(listId, model.get, callback);
        })
    }
    function listFullByScore(key, rev, offset, limit, min, max, callback) {
        if(!callback) {
            if(typeof max == 'function') {
                callback = max;
                max = null;
            } else if(typeof min == 'function') {
                callback = min;
                min = null;
            }
        }
        listIdByScore(key, rev, offset, limit, min, max, function(err, listId) {
                async.map(listId, model.get_full, callback);
        })
    }
    var model = all_models[model_name] = {
        // define
        type: function(field, type) {
            if(typeof type == 'string') {
                model_fields.push([field, type]);
            }
            field_types[field] = type;
        }
      , index: function(field) {
            index_fields.push(field);
            var list_key = model_name + '+' + field;
            model['list_id_by_' + field] = listIdByScore.bind(list_key, false);
            model['list_id_rev_by_' + field] = listIdByScore.bind(list_key, true);
            model['list_by_' + field] = listByScore.bind(list_key, false);
            model['list_rev_by_' + field] = listByScore.bind(list_key, true);
            model['list_full_by_' + field] = listFullByScore.bind(list_key, false);
            model['list_full_rev_by_' + field] = listFullByScore.bind(list_key, true);
        }
      , unique: function(field) {
            unique_fields.push(field);
            model['get_by_' + field] = function(value, callback) {
                redis.get(model_name + '#' + field + ':' + value, function(err, id) {
                        if(err) return callback(err);
                        model.get(id, callback);
                })
            }
        }
      , many_to_one: function(field, type) {
            type && model.type(field, type);
            type = field_types[field];
            if(!type) throw new Error('many_to_one ' + field + ' require type');
            var list_prefix = model_name + '|' + field + ':';
            model['list_id_by_' + field] = listIdByScore.bind(list_prefix, false);
        }
        // creaet, update, save
      , _save: function(data, callback) {
            var multi = redis.multi();
            _.each(index_fields, function(field) {
                    multi.zadd(model_name + '+' + field, toScore(data[field]), data.id);
            });
            _.each(unique_fields, function(field) {
                    multi.set(model_name + '#' + field + ':' + data[field], data.id);
            })
            multi.exec(function(err) {
                    if(err) throw err;
            });
            entityStore.set(model_name, data.id, convert(data), callback);
        }
      , insert: function(data, callback) {
            if(data.id) throw new Error('model id already exists')
            idFactory(function(err, id) {
                    if(err) return callback(err);
                    var key = model.key(id);
                    redis.exists(key, function(err, exists) {
                            if(err) return callback(err);
                            // insert again if exists
                            if(exists) return model.insert(data, callback);
                            data.id = id;
                            data.create_at = new Date();
                            model._save(data, callback);
                    });
            })
        }
      , update: function(data, callback) {
            data.update_at = new Date();
            model._save(data, callback);
        }
      , save: function(data, callback) {
            if(data.id) {
                model.update(data, callback);
            } else {
                model.insert(data, callback);
            }
        }
      , remove: function(id, callback) {
            redis.del(model.key(id), callback);
        }
        // find
      , get: function (id, callback) {
            entityStore.get(model_name, id, _.fapply(callback, revert));
        }
      , get_full: function (id, callback) {
            this.get(id, function(err, results) {
                    // TODO remove async, use dash5
                    async.map(model_fields, function(fieldAndType, emit) {
                            // model
                            var field_id = results[fieldAndType[0] + '_id'];
                            var field_model = all_models[fieldAndType[1]];
                            field_id && field_model ? field_model.get(field_id, emit) : emit();
                        }, function(err, results) {
                            callback(err, results && _.zipObject(model_fields, results));
                    });
            });
        }
        // list
    };
    // default fields
    model
      .type('create_at', Date)
      .type('update_at', Date)
      ;
    return model;
}

RedisModel.getModel = function(model_name) {
    return all_models[model_name];
}

var groupModel = RedisModel('group')
  .type('owner', 'user')
  .many_to_one('owner')
  .many_to_many()
  .index('create_at')
  ;

// also retrival typed field
groupModel.get(id);
list_index
list_many_to_one
list_many_to_many
remove
remove_by_create_at
remove_by_owner
// auto bind methods
groupModel.list_by_create_at(create_at, min, max)
groupModel.list_by_owner(owner_id);
groupModel.list_by_owner(owner_id);
