var async = require('async');

exports.existKeys = function(redis, keys, callback) {
    async.map(keys, function(key, callback) {
            Array.isArray(key)
            ? redis.hexists(key[0], key[1], callback)
            : redis.exists(key, callback)
            ;

        }, function(err, results) {
            var existKeys = [];
            results.forEach(function(exists, index) {
                    console.log('exists', exists);
                    if(exists) {
                        existKeys.push(keys[index]);
                    }
            });
            callback(err, existKeys);
    });
}
