app.requires.push('ui.bootstrap.datetimepicker', 'datetime');
app
    .controller('EventCtrl', function($scope, $timeout, eventService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        var dt = new Date();
        $scope.picker = {
            date: dt,
            options: {minDate: dt}
        };
        $scope.dismissAlert = function () {
            $scope.eventform_showalert = false;
            $scope.eventform.$setValidity('text', true);
        };
        $scope.submitEvent = function () {
            var el = angular.element('#eventform [name="text"]'), cond = el.val().length >= $scope.minchar;
            $scope.eventform.$setValidity('text', cond);
            if (!cond) {
                $scope.eventform_showalert = true;
                el.focus();
                return;
            } else $scope.eventform_showalert = false;
            eventService.new(el.val(), $scope.picker.date).then(function () { el.val('') });
        };
    });
