var async = require('async');
exports.existAllKeys = function(redis, keys, callback) {
    async.map(keys, redis.exist.bind(redis), function(err, results) {
            callback(err, results && !results.contains(null));
    });
}

exports.existOne = function(redis, keys, callback) {
    async.map(keys, redis.exist.bind(redis), function(err, results) {
            callback(err, results && results.contains('1'));
    });
}
