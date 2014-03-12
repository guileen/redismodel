var factory = require('./factory');

function toScore(value) {
    if(value instanceof Date) {
        return value.getTime();
    }
    return Number(value) || 0;
}

function makeModel(modelName, options) {
    var idFactory = (options.idFactory || factory.idFactory)(options);
    var entityStore = (options.entityStore || factory.entityStore)(options);
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
            if(err) return callback(err);
            idFactory(modelName, function(err, id) {
                    if(err) return callback(err);
                    entityStore.exists(modelName, id, function(err, exists) {
                            if(err) return callback(err);
                            // try again to get a new id.
                            if(exists) return model.insert(data, callback);
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
                    multi.zadd(model_name + '+' + field, toScore(data[field]), data.id);
            });
            _.each(unique_fields, function(field) {
                    // TODO fix 
                    multi.set(model_name + '#' + field + ':' + data[field], data.id);
            });
            isNew && _.each(reversed_fields, function(type, field) {
                    var fieldValue = data[field];
                    if(typeof fieldValue == 'object') {
                        fieldValue = fieldValue.id;
                    }
                    var key = model_name + '|' + field + ':' + fieldValue;
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
    };
    return model;
};
