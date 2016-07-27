app
    .controller('EventCtrl', function($rootScope, $scope, $timeout, eventService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        $scope.picker = {
            date: $scope.$parent.currTime,
            options: {minDate: $rootScope.currTime}
        };
        $scope.dismissAlert = function () {
            $scope.eventform_showalert = false;
            $scope.eventform.$setValidity('text', true);
        };
        $scope.submitEvent = function () {
            var el = angular.element('[name="eventform"] [name="text"]'), cond = el.val().length >= $scope.minchar;
            $scope.eventform.$setValidity('text', cond);
            if (!cond) {
                $scope.eventform_showalert = true;
                el.focus();
                return;
            } else $scope.eventform_showalert = false;
            $rootScope.currTime = new Date();
            $rootScope.currTime.setMinutes($rootScope.currTime.getMinutes()+1);
            if ($scope.picker.date === undefined || $scope.picker.date < $rootScope.currTime) $scope.picker.date = $rootScope.currTime;
            $scope.picker.options.minDate = $rootScope.currTime;
            eventService.new(el.val(), $scope.picker.date).then(function () { el.val('') });
        };
    });
