app

    .controller('UserCtrl', function($scope, friendService) {
        $scope.name = angular.element('.lead.text-center.br2').text();
        $scope.doFriendRequestAction = function () {
            switch($scope.$parent.rel_state) {
                case 0:
                case 2:
                    friendService.save({to_person: $scope.$parent.user_id},
                        function success() {
                            $scope.$parent.rel_state++;
                            if ($scope.$parent.rel_state == 3) $scope.friends_count++;
                        });
                    break;
                default:
                    friendService.delete({id: $scope.$parent.user_id},
                        function success() {
                            if ($scope.$parent.rel_state == 3) $scope.friends_count--;
                            $scope.$parent.rel_state = 0;
                        });
            }
        };
        $scope.$parent.$watch('rel_state', function () {
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