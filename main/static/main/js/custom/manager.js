app
    .directive('stringToNumber', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(value) { return '' + value });
                ngModel.$formatters.push(function(value) { return parseFloat(value) });
            }
        }
    })

    .factory('editData', function (){ return {value: [[]], form: [[]], tz: undefined} })

    .controller('EventCtrl', function($rootScope, $scope, eventService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        $scope.picker = {
            date: $scope.$parent.currTime,
            options: {minDate: $rootScope.currTime}
        };
        $scope.submitEvent = function () {
            var el = angular.element('[name=\'forms.event\'] [name=\'text\']');
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
    })

    .controller('ItemCtrl', function($scope, $timeout, menuService, dialogService, APIService, USER) {
        $scope.submitItem = function () {
            var el = angular.element('[name=\'forms.item\'] [name=\'name\']');
            $scope.forms.item.alert = el.val().length < 2 ? true : undefined;
            if ($scope.forms.item.alert) {
                el.focus();
                return;
            }
            menuService.new(el.val(), angular.element('[name=\'forms.item\'] [name=\'price\']').val(), angular.element('[name=\'forms.item\'] [name=\'cat\']').val()).then(
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

        var s = APIService.init(8);
        $scope.changedCurr = function (){
            dialogService.show("If you change the business currency now, then item prices in the menu will be converted to that new currency.<br>Are you sure that you want to continue?").then(function (){
                $scope.$parent.refreshing = true;
                s.partial_update_a({currency: $scope.curr[1]}, function (result) {
                    if ($scope.curr[1] == USER.currency) {
                        var e = false;
                        for (var i = 0; i < result.length; i++) {
                            for (var j = 0; j < $scope.menu.length; j++) {
                                for (var k = 0; k < $scope.menu[j].content.length; k++) {
                                    if ($scope.menu[j].content[k].category == result[i].category) for (var l = 0; l < $scope.menu[j].content[k].content.length; l++) if ($scope.menu[j].content[k].content[l].id == result[i].id) {
                                        $scope.menu[j].content[k].content[l].price = result[i].price;
                                        $scope.edit_i[$scope.menu[j].content[k].content[l].id].form = result[i].price;
                                        $scope.menu[j].content[k].content[l].converted = result[i].converted;
                                        e = true;
                                        break;
                                    }
                                    if (e) break;
                                }
                                if (e) break;
                            }
                            e = false;
                        }
                        $scope.$parent.curr[2] = $scope.curr[1];
                    }
                    $scope.$parent.curr[0] = $scope.curr[1];
                    delete $scope.$parent.refreshing;
                }, function (){
                    $scope.$parent.curr[1] = $scope.curr[0];
                    delete $scope.$parent.refreshing;
                });
            }, function (){ $scope.$parent.curr[1] = $scope.curr[0] });
        };

        $scope.$parent.doIAction = function (e){
            if ($scope.$parent.edit_i[e.id].form != '' && $scope.$parent.edit_i[e.id].form != e.price) {
                $scope.$parent.edit_i[e.id].disabled = null;
                s.partial_update({object_id: e.id, price: $scope.$parent.edit_i[e.id].form}, function (result) {
                    e.price = result.price;
                    e.converted = result.converted;
                    $scope.$parent.edit_i[e.id].disabled = true;
                }, function () { $scope.$parent.edit_i[e.id].disabled = true });
            } else $scope.$parent.edit_i[e.id].disabled = true;
        };
    });
