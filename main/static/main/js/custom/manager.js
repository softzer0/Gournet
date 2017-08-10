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

    .constant('EDIT_DATA', {value: [[]], form: [[]], tz: undefined})

    .controller('EventCtrl', function($rootScope, $scope, $timeout, eventService) {
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
            $scope.loading = true;
            function l(){ $timeout(function(){ delete $scope.loading }) }
            eventService.new(el.val(), $scope.picker.date).then(function () {
                el.val('');
                l();
            }, l);
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
            var cat = angular.element('[name=\'forms.item\'] [name=\'cat\']').val();
            if (menuService.find('name', el.val(), cat)) {
                $scope.forms.item.alert = false;
                el.focus();
                return;
            }
            var ch = $scope.unpub !== undefined;
            $scope.loading = true;
            function l(){ $timeout(function(){ delete $scope.loading }) }
            menuService.new(el.val(), angular.element('[name=\'forms.item\'] [name=\'price\']').val(), cat).then(
                function () {
                    el.val('');
                    if (!ch) return;
                    $scope.$parent.unpub = gettext("This message will disappear once your business is approved. When published, it will become visible/accessible to others.");
                    ch = false;
                    l();
                }, l
                /*function (result) {
                    if (result.data !== undefined && result.data.non_field_errors !== undefined) {
                        $scope.forms.item.alert = false;
                        el.focus();
                        l();
                    }
                }*/
            );
        };

        var s = APIService.init(8);
        $scope.changedCurr = function (){
            dialogService.show(gettext("If you change the business currency now, then item prices in the menu will be converted to that new currency.")+'<br>'+gettext("Are you sure that you want to continue?")).then(function (){
                $scope.$parent.refreshing = true;
                s.partial_update_a({currency: $scope.curr[0]}, function (result) {
                    for (var i = 0; i < result.length; i++) menuService.find('id', result[i].id, result[i].category, function (obj){
                        obj.price = result[i].price;
                        $scope.$parent.$parent.$parent.edit_i[obj.id].form = result[i].price;
                        obj.converted = result[i].converted;
                    });
                    if ($scope.curr[0] == USER.currency || result.length > 0 && result[0].converted != null) $scope.$parent.curr[1] = USER.currency; else $scope.$parent.curr[1] = $scope.curr[0];
                    $scope.$parent.data.curr = $scope.curr[0];
                    delete $scope.$parent.refreshing;
                }, function (){
                    $scope.$parent.curr[0] = $scope.data.curr;
                    delete $scope.$parent.refreshing;
                });
            }, function (){ $scope.$parent.curr[0] = $scope.data.curr });
        };

        $scope.$parent.doIAction = function (e){
            if ($scope.edit_i[e.id].form != '' && $scope.edit_i[e.id].form != e.price) {
                $scope.$parent.$parent.$parent.edit_i[e.id].disabled = null;
                s.partial_update({object_id: e.id, price: $scope.edit_i[e.id].form}, function (result) {
                    e.price = result.price;
                    e.converted = result.converted;
                    $scope.$parent.$parent.$parent.edit_i[e.id].disabled = true;
                }, function () { $scope.$parent.$parent.$parent.edit_i[e.id].disabled = true });
            } else $scope.$parent.$parent.$parent.edit_i[e.id].disabled = true;
        };
    });
