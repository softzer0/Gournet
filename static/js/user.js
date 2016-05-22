app
    .factory('friendsService', function($resource) {
        return {
            sendRequest: function(id) {
                return $resource('/api/friends/?format=json').save({person1: id}).$promise;
            },
            removeRequest: function(id) {
                return $resource('/api/friends/:id?format=json').delete({id: id}).$promise;
            }
        }
    })

    .controller('UserCtrl', function($scope, friendsService) {
        $scope.doFriendRequestAction = function () {
            switch($scope.rel_state) {
                case 0:
                case 2:
                    friendsService.sendRequest($scope.user_id).then(function (){
                        $scope.rel_state++;
                        if ($scope.rel_state == 3) $scope.friends_count++;
                    });
                    break;
                default: friendsService.removeRequest($scope.user_id).then(function (){
                    if ($scope.rel_state == 3) $scope.friends_count--;
                    $scope.rel_state = 0;
                });
            }
        }
    });