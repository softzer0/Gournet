app
    .controller('EventCtrl', function($rootScope, $scope, $timeout, eventService, menuService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        $scope.picker = {
            date: $scope.$parent.currTime,
            options: {minDate: $rootScope.currTime}
        };
        $scope.submitEvent = function () {
            var el = angular.element('[name="forms.event"] [name="text"]');
            $scope.forms.event.alert = el.val().length < $scope.minchar;
            if ($scope.forms.event.alert) {
                el.focus();
                return;
            }
            $rootScope.currTime = new Date();
            $rootScope.currTime.setMinutes($rootScope.currTime.getMinutes()+1);
            if ($scope.picker.date === undefined || $scope.picker.date < $rootScope.currTime) $scope.picker.date = $rootScope.currTime;
            $scope.picker.options.minDate = $rootScope.currTime;
            eventService.new(el.val(), $scope.picker.date).then(function () { el.val('') });
        };
        $scope.submitItem = function () {
            var el = angular.element('[name="forms.item"] [name="name"]'), cond;
            cond = el.val().length < 2 ? 1 : 0;
            if ($scope.forms.item.price === undefined) cond += 2;
            if (cond > 0) {
                $scope.forms.item.alert = cond;
                if (cond == 1 || cond == 3) el.focus();
                if (cond == 2 || cond == 3) angular.element('[name="forms.item"] [name="price"]').focus();
                return;
            } else $scope.forms.item.alert = 0;
            menuService.new(el.val(), $scope.forms.item.price, angular.element('[name="forms.item"] [name="cat"]').val()).then(function () { el.val('') });
        };
    })
    .controller('ItemCtrl', function($rootScope, $scope, $timeout, eventService, menuService) {
        $scope.submitItem = function () {
            var el = angular.element('[name="forms.item"] [name="name"]');
            $scope.forms.item.alert = el.val().length < 2 ? true : undefined;
            if ($scope.forms.item.alert) {
                el.focus();
                return;
            }
            menuService.new(el.val(), angular.element('[name="forms.item"] [name="price"]').val(), angular.element('[name="forms.item"] [name="cat"]').val()).then(
                function () { el.val('') },
                function (result) {
                    if (result.data !== undefined && result.data.non_field_errors !== undefined) {
                        $scope.forms.item.alert = false;
                        el.focus();
                    }
                }
            );
        };
    });
