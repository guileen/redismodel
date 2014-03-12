/*
var userModel = RedisModel('user', redisClient)
  .unique('email')
  .unique('username')
  .index('create_at')
  ;

var groupModel = RedisModel('group', redisClient)
  .many_to_one('creator', 'user')
  ;

for(var i = 0; i < 5; i++) {
    userModel.save({username: 'gl' + i, email: 'gl' + i + '@gl.com'}, function(err, results) {
            if(err) {
                console.log('error', err.stack || err);
            }
            console.log(results);
    });
}
userModel.get_full_by_username('gl3', function(err, results) {
        if(err) console.log(err.stack || err);
        console.log('result ', results);
});

groupModel.save({creator_id: 5, name: 'xxx'}, function(err, info) {
        if(err) return console.log(err.stack || err);
        groupModel.get_full(info.id, function(err, results) {
                console.log('getfull group', results);
        })
})
*/

var should = require('should');
var User = require('./models/User');
var redis = require('redis').createClient();

function shouldExists(keys, callback) {
    async.map(keys, redis.exists, function(err, results) {
            if(err) callback(err);
            for (var i = 0, l = keys.length; i < l; i ++) {
                var k = keys[i];
                var ex = results[i];
                if(!ex) {
                    return callback(new Error('not exist ' + k));
                }
            }

    });
}

describe('Model', function() {

        describe('verify', function() {
                it('should verify require fields', function(done) {
                        User.save({
                                password: '123456'
                              , email: 'gl@gl.com'
                            }, function(err) {
                                should.exists(err);
                                done();
                        })
                })
        })

        it('should save and create keys', function(done) {
                User.save({
                        username: 'gl'
                      , password: '123456'
                      , email: 'gl@gl.com'
                    }, function(err, data) {
                        should.exists(data.id);
                        should.not.exists(err);
                        shouldExists(['user+username:gl'], done);
                });
        })
})
