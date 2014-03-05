var config = require('../config');
var redisit = require('../../redis_model');
var Thing = redisit('thing', config.redis)
  .field('user', {
          many_to_one: 'user'
  });
