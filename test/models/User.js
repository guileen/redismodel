var config = require('../config');
var redisit = require('../../redis_model');

var User = redisit('user', {
        entityStore: redisit.entityStore
      , redis: require('redis').createClient();
      , fields: {
            id: {
                'default': function() {

                }
            }
          , username: {
                required: true
              , len: [4, 15]
              , unique: true
            }
          , email: {
                type: 'email'
              , require: true
              , unique: true
            }
          , password: {
                required: true
              , verify: function(value) {

                }
            }
          , avatar: {
                'default': 'foo/empty.png'
            }
          , invitor: {
                type: 'model'
              , model: 'user'
              , many_to_one: 'user' // save sorted set
            }
        }
      , indices: [
            'create_at'
        ]
});

User.on('insert', function(user) {

})

User.on('update', function(user) {

})
