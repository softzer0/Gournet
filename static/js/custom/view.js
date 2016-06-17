app
    .controller('FavouriteCtrl', function($scope, $timeout, frifavService) {
        $scope.name = angular.element('.lead.text-center.br2').text();
        var favouriteService = frifavService.init(1), loading;
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
        /*$scope.$parent.$watch('rel_state', function () {
            $scope.rel_state_msg = 'Are you sure that you want to ';
            if ($scope.rel_state == 0) $scope.rel_state_msg += 'set a favourite'; else $scope.rel_state_msg += 'remove from favourites';
            $scope.rel_state_msg += ' <strong>'+$scope.name+'</strong>?'
        })*/
    });