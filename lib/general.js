exports.idFactory = function(options) {
    var redis = options.redis;
    return function makeId(modelName, callback) {
        redis.incr('_meta:' + modelName, callback);
    }
}

exports.entityStore = function(options) {
    var redis = options.redis;
    var serializer = exports.serializer(options);
    return {
        set: function(modelName, id, data, callback) {
            redis.hmset(modelName + ':' + id, serializer.toPlainObject(data), callback);
        }
      , get: function(modelName, id, callback) {
            redis.hgetall(modelName + ':' + id, function(err, results) {
                    callback(err, results && serializer.fromPlainObject(results));
            });
        }
      , del: function(modelName, id, callback) {
            redis.del(modelName + ':' + id, callback);
        }
    }
}

exports.serializer = function(options) {
    var fields = options.fields;
    return {
        toString: function(data) {
            return JSON.stringify(this.toPlainObject(data));
        }
      , toPlainObject: function(data) {
            var f;
            // clone object
            data = _.clone(data);
            for(var name in data) {
                f = fields[name];
                if(!f) continue;
                if(f.type == Date && data[name] instanceof Date) {
                    data[name] = data[name].toISOString();
                }
                if(f.type == 'model' || f.model) {
                    data[name + '_id'] = data[name] && data[name].id;
                    delete data[name];
                }
            }
            return data;
        }
      , fromPlainObject: function(data) {
            for(var name in data) {
                f = fields[name];
                if(!f) continue;
                if(f.type == Date) {
                    data[name] = data[name] && new Date(data[name]);
                }
                if(f.type == Number) {
                    data[name] = Number(data[name]);
                }
            }
            return data;
        }
      , toObject: function(str) {
            return fromPlainObject(JSON.parse(str));
        }
    }
}
