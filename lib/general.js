exports.idFactory = function(options) {
    var redis = options.redis;
    return function makeId(modelName, callback) {

    }
}

exports.entityStore = function(options) {
    var redis = options.redis;
    return {
        set: function(modelName, id, value, callback) {

        }
      , get: function(modelName, id, callback) {

        }
      , del: function(modelName, id, callback) {

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
            }
            return data;
        }
      , toObject: function(str) {

        }
    }
}
