function (redis) {
    function bindCommand(cmd, method) {
            return function() {
                var args = [].slice.call(arguments);
                var callback = args[args.length - 1];
                args[args.length - 1] = function(err, results) {
                    async.map(listId, method, callback);
                }
                redis[cmd].apply(redis, args);
            }
    }
    [commands].forEach(function(cmd) {
            model[cmd] = bindCommand(cmd, model.get);
            model[cmd + '_full'] = bindCommand(cmd, model.get_full);
    })
}
