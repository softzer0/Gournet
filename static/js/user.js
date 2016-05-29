app
    .factory('friendsService', function($resource) {
        return {
            sendRequest: function(id) {
                return $resource('/api/friends/?format=json').save({person1: id}).$promise;
            },
            removeRequest: function(id) {
                return $resource('/api/friends/:id/?format=json').delete({id: id}).$promise;
            }
        }
    })

    .controller('UserCtrl', function($scope, friendsService) {
        $scope.name = angular.element('.lead.text-center.br2').text();
        $scope.doFriendRequestAction = function () {
            switch($scope.rel_state) {
                case 0:
                case 2:
                    friendsService.sendRequest($scope.user_id).then(function (){
                        $scope.rel_state++;
                        if ($scope.rel_state == 3) $scope.friends_count++;
                    });
                    break;
                default:
                    friendsService.removeRequest($scope.user_id).then(function (){
                        if ($scope.rel_state == 3) $scope.friends_count--;
                        $scope.rel_state = 0;
                    });
            }
        };
        $scope.$watch('rel_state', function () {
            $scope.rel_state_msg = 'Are you sure that you want to ';
            switch($scope.rel_state) {
                case 0:
                    $scope.rel_state_msg += 'send a friend request to';
                    break;
                case 1:
                    $scope.rel_state_msg += 'cancel the friend request to';
                    break;
                case 2:
                    $scope.rel_state_msg += 'accept the friend request from';
                    break;
                case 3:
                    $scope.rel_state_msg += 'remove from friends';
            }
            $scope.rel_state_msg += ' <strong>'+$scope.name+'</strong>?'
        })
    });