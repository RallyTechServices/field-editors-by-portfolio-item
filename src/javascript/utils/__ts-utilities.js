Ext.define('TSUtilities', {

    singleton: true,

    loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    console.error("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    console.error("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

// will execute an array of functions, with
// maxParallelCalls of them run at in parallelFns
// collects the results and returns them as an
// array of arrays.  (Length of outer array = fns.length)
//
    throttle: function (fns, maxParallelCalls, scope) {

        if (maxParallelCalls <= 0 || fns.length < maxParallelCalls){
            return Deft.promise.Chain.parallel(fns, scope);
        }


        var parallelFns = [],
            fnChunks = [],
            idx = -1;

        for (var i = 0; i < fns.length; i++) {
            if (i % maxParallelCalls === 0) {
                idx++;
                fnChunks[idx] = [];
            }
            fnChunks[idx].push(fns[i]);
        }

        _.each(fnChunks, function (chunk) {
            parallelFns.push(function () {
                return Deft.promise.Chain.parallel(chunk, scope);
            });
        });

        return Deft.Promise.reduce(parallelFns, function(groupResults, fnGroup) {
            return Deft.Promise.when(fnGroup.call(scope)).then(function(results) {
                groupResults = groupResults.concat(results || []);
                return groupResults;
            });
        }, []);
    }
});
