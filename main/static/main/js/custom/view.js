app
    /*.filter('newlines', function () {
        return function(text) {
            return text.replace(/\n/g, '<br>');
        }
    })*/

    .controller('BusinessCtrl', function($scope, $timeout, $controller, $injector, APIService) {
        var menuF = function () {
            if ($scope.menu === undefined) {
                var menuService = $injector.get('menuService');
                $scope.menu = menuService.init();
                menuService.load($scope.id).then(function () { $scope.loaded = true });
            }
        };
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: [{name: 'events', func: function(){ $scope.objloaded = true }}, {name: 'menu', func: menuF}, {name: 'reviews'}]}));

        //$scope.name = angular.element('.lead.text-center.br2').text();
        var favouriteService = APIService.init(1), loading;

        $scope.doFavouriteAction = function () {
            if (loading) return;
            loading = true;
            if ($scope.fav_state == 0) {
                favouriteService.save({business: $scope.$parent.id},
                    function () {
                        $scope.fav_state = 1;
                        $scope.favoured_count++;
                        $timeout(function() { loading = false });
                    });
            } else {
                favouriteService.delete({id: $scope.$parent.id},
                    function (){
                        $scope.fav_state = 0;
                        $scope.favoured_count--;
                        $timeout(function() { loading = false });
                    });
            }
        };
        /*$scope.$parent.$watch('rel_state', function (value) {
            $scope.rel_state_msg = 'Are you sure that you want to ';
            if (value == 0) $scope.rel_state_msg += 'set a favourite'; else $scope.rel_state_msg += 'remove from favourites';
            $scope.rel_state_msg += ' <strong>'+$scope.name+'</strong>?'
        })*/

        //...
    });