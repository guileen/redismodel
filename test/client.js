var redis = require('redis')
// var client = redis.createClient(6379, '192.168.0.12')
var client = redis.createClient()
client.select(15)
module.exports = client
