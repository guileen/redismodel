var factory = require('./factory');

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
    var model = {
        save: function(data, callback) {
            if(data.id) {
                model.update(data, callback);
            } else {
                model.insert(data, callback);
            }
        }
      , insert: function(data, callback) {

        }
      , update: function(data, callback) {

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
