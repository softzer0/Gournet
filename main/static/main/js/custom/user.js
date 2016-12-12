app
    .controller('UserCtrl', function($scope, $timeout, $controller, makeFriendService) {
        $scope.objloaded = [];
        $scope.tabs = [{display: "Events", name: 'events', func: function(){ $scope.objloaded[0] = true }}, {display: "Items", name: 'items', func: function(){ $scope.objloaded[1] = true }}, {display: "Reviews", name: 'reviews', func: function(){ $scope.objloaded[2] = true }}];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: $scope.tabs}));

        //makeFriendService.config($scope.$parent.u);
        $scope.doFriendRequestAction = function () { makeFriendService.run($scope.$parent.u, $scope.$parent.id) };
    });