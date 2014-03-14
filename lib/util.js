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

// strip [member, score, member, score] to [member, member], [score, score]
exports.splitPairs = function splitPairs(results) {
    var members = new Array(results.length / 2);
    var scores = new Array(results.length / 2);
    for(var i = 0, j=0; i < results.length;j++) {
        members[j] = results[i++];
        scores[j] = results[i++];
    }
    return [members, scores];
}

exports.toScore = function toScore(value) {
    if(value instanceof Date) {
        return value.getTime();
    }
    return Number(value) || 0;
}

