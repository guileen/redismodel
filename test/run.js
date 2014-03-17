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
// require('blanket')({
//         pattern: '*'
//       , 'data-cover-never': ['node_modules', 'test']
// });
var should = require('should');
var User = require('./models/User');
var redis = require('redis').createClient();
var async = require('async');
var util = require('../lib/util');

function shouldExists(keys, callback) {
    util.existKeys(redis, keys, function(err, existKeys) {
            existKeys.length.should.eql(keys.length);
            callback(err);
    })
}

before(function(done) {
        redis.flushdb(done);
})

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
                        should.not.exists(err);
                        should.exists(data.id);
                        shouldExists(['user+create_at', ['user<-username', 'gl'], ['user<-email', 'gl@gl.com']], done);
                });
        })

        it('should not save duplicate value', function(done) {
                User.save({
                        username: 'gl'
                      , password: '123456'
                      , email: 'gl@gl.com'
                    }, function(err, data) {
                        should.exists(err);
                        done();
                });
        })

        it('should get user', function(done) {
                User.by.username('gl', function(err, info) {
                        should.not.exists(err);
                        should.exists(info);
                        should.exists(info.id);
                        info.username.should.eql('gl');
                        info.email.should.eql('gl@gl.com');
                        done();
                })
        })

        it('should fetch list of user', function(done) {
                User.fetch.zrange('user+create_at', 0, -1, function(err, users) {
                        console.log(users);
                        done();
                })
        })
});
