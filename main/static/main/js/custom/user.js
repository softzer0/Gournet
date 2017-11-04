app
    .filter('ageFilter', function (){ return function(input) { return Math.abs(new Date(Date.now() - new Date(input).getTime()).getUTCFullYear() - 1970) }})

    .controller('UserCtrl', function($scope, $timeout, $controller, $document, makeFriendService, APIService, dialogService) {
        $scope.objloaded = [];
        $scope.tabs = [{display: gettext("Events"), name: 'events', func: function(){ $scope.objloaded[0] = true }}, {display: gettext("Items"), name: 'items', func: function(){ $scope.objloaded[1] = true }}, {display: gettext("Reviews"), name: 'reviews', func: function(){ $scope.objloaded[2] = true }}];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: $scope.tabs}));

        // Not owner
        if (!OWNER_MANAGER) {
            //makeFriendService.config($scope.$parent.u);
            $scope.doFriendRequestAction = function () { makeFriendService.run($scope.$parent.u, $scope.$parent.id) };
            return;
        }

        // Owner
        $scope.edit = {};
        $scope.setED = function (name, val){ $scope.edit[name] = {value: new Date(val), disabled: true, form: {value: new Date(val), options: {minDate: new Date('1927'), maxDate: new Date('2003')}, opened: false}} };
        $scope.s = APIService.init();
        function zeroPad(num) { //, places
            var zero = 3 - num.toString().length; //places - (...) + 1
            return new Array(+(zero > 0 && zero)).join('0') + num;
        }
        var f = ['value', 'form'];
        $scope.doAction = function (i){
            switch (i) {
                case 1:
                    $scope.execA('gender', 'gender', [pgettext('after changing', "gender"), 'gender']);
                    break;
                case 2:
                    if ($scope.edit.birth.form.value && $scope.edit.birth.form.value.getTime() != $scope.edit.birth.value.getTime() && $scope.edit.birth.form.value < $scope.edit.birth.form.options.maxDate && $scope.edit.birth.form.value > $scope.edit.birth.form.options.minDate) $scope.execA('birth', {birthdate: $scope.edit.birth.form.value.getFullYear()+'-'+zeroPad($scope.edit.birth.form.value.getMonth()+1)+'-'+zeroPad($scope.edit.birth.form.value.getDate())}, [pgettext('after changing', "birthdate"), 'birth'], function (){ $scope.edit.birth.value = $scope.edit.birth.form.value }); else $scope.disableE(2);
                    break;
                case 3:
                    $scope.execA('addr', 'address', undefined, function (result){ for (var j in f) $scope.edit.addr[f[j]] = result.address }, function (){ dialogService.show(gettext("Invalid address."), false) });
                    break;
                default: $scope.execA('name', ['first_name', 'last_name'], [pgettext('after changing', "name"), 'name'], function (result){ for (var j in f) for (var i = 0; i < 2; i++) $scope.edit.name[f[j]][i] = i == 0 ? result.first_name : result.last_name });
            }
        };
    });