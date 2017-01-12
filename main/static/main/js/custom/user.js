app
    .controller('UserCtrl', function($scope, $timeout, $controller, $document, makeFriendService, dialogService, APIService) {
        $scope.objloaded = [];
        $scope.tabs = [{display: "Events", name: 'events', func: function(){ $scope.objloaded[0] = true }}, {display: "Items", name: 'items', func: function(){ $scope.objloaded[1] = true }}, {display: "Reviews", name: 'reviews', func: function(){ $scope.objloaded[2] = true }}];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: $scope.tabs}));

        //makeFriendService.config($scope.$parent.u);
        $scope.doFriendRequestAction = function () { makeFriendService.run($scope.$parent.u, $scope.$parent.id) };

        var s = APIService.init(12);
        $scope.doChangeName = function (){
            function disable() { $scope.edit[0].disabled = true }
            if ($scope.edit[0].form[0] != $scope.edit[0].value[0] || $scope.edit[0].form[1] != $scope.edit[0].value[1]) {
                dialogService.show("After changing the name for the first time, you won't be able to do that again." + '<br>' + "Are you sure that you want to continue?").then(function () {
                    $scope.edit[0].disabled = null;
                    s.partial_update($scope.gend('first_name', 'last_name'), function (){
                        $scope.edit[0].value[0] = $scope.edit[0].form[0];
                        $scope.edit[0].value[1] = $scope.edit[0].form[1];
                        $document.off('click', $scope.documentClick);
                        delete $scope.documentClick;
                        delete $scope.edit[0].disabled;
                        delete $scope.edit[0].form;
                    }, disable);
                });
            } else disable();
        };
    });