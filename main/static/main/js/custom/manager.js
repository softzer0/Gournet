app
    .controller('EventCtrl', function($rootScope, $scope, $timeout, eventService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        $scope.picker = {
            date: $scope.$parent.currTime,
            options: {minDate: $rootScope.currTime}
        };
        $scope.dismissAlert = function () {
            $scope.event_showalert = false;
            $scope.forms.event.$setValidity('text', true);
        };
        $scope.submitEvent = function () {
            var el = angular.element('[name="forms.event"] [name="text"]'), cond = el.val().length >= $scope.minchar;
            $scope.forms.event.$setValidity('text', cond);
            if (!cond) {
                $scope.event_showalert = true;
                el.focus();
                return;
            } else $scope.event_showalert = false;
            $rootScope.currTime = new Date();
            $rootScope.currTime.setMinutes($rootScope.currTime.getMinutes()+1);
            if ($scope.picker.date === undefined || $scope.picker.date < $rootScope.currTime) $scope.picker.date = $rootScope.currTime;
            $scope.picker.options.minDate = $rootScope.currTime;
            eventService.new(el.val(), $scope.picker.date).then(function () { el.val('') });
        };
    });
