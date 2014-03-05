var config = require('../config');
var redisit = require('../../redis_model');
var User = redisit('user', config.redis)
  .field('username', {
          required: true
        , len: [4, 15]
        , unique: true
  })
  .field('email', {
          type: 'email'
        , required: true
        , unique: true
  })
  .field('avatar', {
        default: 'foo/empty.png'
  })
  .field('sth', /^pattern$/)
  .index('create_at')
