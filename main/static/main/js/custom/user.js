function dynamicSort(property) {
    var sortOrder;
    if(property[0] == '-') {
        sortOrder = -1;
        property = property.slice(1);
    } else sortOrder = 1;
    return function (a,b) {
        var aprop, bprop;
        function getval(o, p) { return p.indexOf('.') >= 0 ? getval(o[p.slice(0, p.indexOf('.'))], p.slice(p.indexOf('.')+1)) : o[p] }
        if (property.indexOf('/') >= 0) {
            var props = property.split('/');
            for (var i = 0; i < props.length && (aprop === undefined || bprop === undefined); i++) {
                if (aprop === undefined) aprop = getval(a, props[i]);
                if (bprop === undefined) bprop = getval(b, props[i]);
            }
        } else {
            aprop = getval(a, property);
            bprop = getval(b, property);
        }
        if (aprop === undefined || bprop === undefined) return 0;
        return ((aprop < bprop) ? -1 : (aprop > bprop) ? 1 : 0) * sortOrder;
    }
}

function dynamicSortMultiple() {
    /*
     * save the arguments object as it will be overwritten
     * note that arguments object is an array-like object
     * consisting of the names of the properties to sort by
     */
    var props = arguments;
    return function (obj1, obj2) {
        var result = 0, numberOfProperties = props.length;
        /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
        for(var i = 0; result == 0 && i < numberOfProperties; i++) result = dynamicSort(props[i])(obj1, obj2);
        return result;
    }
}

app
    .controller('UserCtrl', function($scope, $timeout, $controller, makeFriendService) {
        $scope.objloaded = [];
        $scope.tabs = [{display: "Events", name: 'events', func: function(){ $scope.objloaded[0] = true }}, {display: "Items", name: 'items', func: function(){ $scope.objloaded[1] = true }}, {display: "Reviews", name: 'reviews', func: function(){ $scope.objloaded[2] = true }}];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: $scope.tabs}));

        //makeFriendService.config($scope.$parent.u);
        $scope.doFriendRequestAction = function () { makeFriendService.run($scope.$parent.u, $scope.$parent.id) };
    });