var RedisModel = require('../redis_model');
var redisClient = require('redis').createClient();

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

// var groupModel = RedisModel('group')
//   .type('owner', 'user')
//   .many_to_one('owner')
//   .many_to_many()
//   .index('create_at')
//   ;

// // also retrival typed field
// groupModel.get(id);
// list_index
// list_many_to_one
// list_many_to_many
// remove
// remove_by_create_at
// remove_by_owner
// // auto bind methods
// groupModel.list_by_create_at(create_at, min, max)
// groupModel.list_by_owner(owner_id);
// groupModel.list_by_owner(owner_id);
