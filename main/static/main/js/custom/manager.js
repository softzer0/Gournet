app
    .controller('EventCtrl', function($rootScope, $scope, eventService, APIService, dialogService) {
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

        var s = APIService.init(13);
        $scope.$parent.$parent.$parent.doChangeName = function (){
            function disable() { $scope.edit[0].disabled = true }
            if ($scope.edit[0].form[0] != $scope.edit[0].value[0] || $scope.edit[0].form[1] != $scope.edit[0].value[1] || $scope.edit[0].form[2] !== undefined && $scope.edit[0].form[2] != $scope.edit[0].value[2]) {
                var k;
                if ($scope.edit[0].form[2] !== undefined && $scope.edit[0].form[2] != $scope.edit[0].value[2]) for (k = 0; k < $scope.forbidden.length; k++) if ($scope.edit[0].form[2] == $scope.forbidden[k]) {
                    dialogService.show("Specified shortname is not permitted.", false);
                    return;
                }
                $scope.edit[0].disabled = null;
                s.partial_update($scope.gend('type', 'name', 'shortname'), function (){
                    $scope.edit[0].value[0] = $scope.edit[0].form[0];
                    $scope.edit[0].value[1] = $scope.edit[0].form[1];
                    if ($scope.edit[0].form[2] !== undefined && $scope.edit[0].form[2] != $scope.edit[0].value[2]) $scope.edit[0].value[2] = $scope.edit[0].form[2]; else $scope.edit[0].form[2] = $scope.edit[0].value[2];
                    disable();
                }, function (result){
                    if ($scope.edit[0].form[2] !== undefined && $scope.edit[0].form[2] != $scope.edit[0].value[2]) for (k in result.data) if (k == 'shortname') {
                        $scope.edit[0].disabled = false;
                        dialogService.show("Specified shortname is already taken.", false);
                        return;
                    }
                    disable();
                });
            } else disable();
        };
    })

    .controller('ItemCtrl', function($scope, $timeout, menuService) {
        $scope.submitItem = function () {
            var el = angular.element('[name="forms.item"] [name="name"]');
            $scope.forms.item.alert = el.val().length < 2 ? true : undefined;
            if ($scope.forms.item.alert) {
                el.focus();
                return;
            }
            menuService.new(el.val(), angular.element('[name="forms.item"] [name="price"]').val(), angular.element('[name="forms.item"] [name="cat"]').val()).then(
                function () {
                    el.val('');
                    if (angular.element('#unpub').length == 1) angular.element('#unpub').remove();
                },
                function (result) {
                    if (result.data !== undefined && result.data.non_field_errors !== undefined) {
                        $scope.forms.item.alert = false;
                        el.focus();
                    }
                }
            );
        };
    });
