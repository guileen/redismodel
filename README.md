redis-model
===========

A model framework for redis.

```
var redismodel = require('redismodel')
var client = require('redis').createClient()
var model = redismodel('user', {
    scheme: {
        name: String,
        age: 'int'
    },
    client: client
})

model.ensureIndex('age')

var user = yield model.insert({name: 'jason', age: 10})
yield model.update(user.id, {name:'tom'})
model.remove(user.id)
// 50 user, age between 30 to 20
model.range(50, 0, {age: -1}, [30, 20])
```
