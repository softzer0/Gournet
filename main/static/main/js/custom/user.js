app
    .filter('ageFilter', function (){ return function(input) { return Math.abs(new Date(Date.now() - new Date(input).getTime()).getUTCFullYear() - 1970) }})

    .controller('UserCtrl', function($scope, $timeout, $controller, $document, makeFriendService, APIService, dialogService) {
        $scope.objloaded = [];
        $scope.tabs = [{display: "Events", name: 'events', func: function(){ $scope.objloaded[0] = true }}, {display: "Items", name: 'items', func: function(){ $scope.objloaded[1] = true }}, {display: "Reviews", name: 'reviews', func: function(){ $scope.objloaded[2] = true }}];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope, tabs: $scope.tabs}));

        //makeFriendService.config($scope.$parent.u);
        $scope.doFriendRequestAction = function () { makeFriendService.run($scope.$parent.u, $scope.$parent.id) };

        // Owner
        if (angular.element('.img_p').length == 0) return;

        $scope.setED = function (val){ $scope.edit.push({value: new Date(val), disabled: true, form: {value: new Date(val), options: {minDate: new Date('1927'), maxDate: new Date('2016')}, opened: false}}) };
        $scope.s = APIService.init(12);
        function zeroPad(num) { //, places
            var zero = 3 - num.toString().length; //places - (...) + 1
            return new Array(+(zero > 0 && zero)).join('0') + num;
        }
        var f = ['value', 'form'];
        $scope.doAction = function (i){
            switch (i) {
                case 1:
                    $scope.execA(1, 'gender', ["gender", 'gender']);
                    break;
                case 2:
                    if ($scope.edit[2].form.value && $scope.edit[2].form.value.getTime() != $scope.edit[2].value.getTime() && $scope.edit[2].form.value < $scope.edit[2].form.options.maxDate && $scope.edit[2].form.value > $scope.edit[2].form.options.minDate) $scope.execA(2, {birthdate: $scope.edit[2].form.value.getFullYear()+'-'+zeroPad($scope.edit[2].form.value.getMonth()+1)+'-'+zeroPad($scope.edit[2].form.value.getDate())}, ["birthdate", 'birth'], function (){ $scope.edit[2].value = $scope.edit[2].form.value }); else $scope.disableE(2);
                    break;
                case 3:
                    $scope.execA(3, 'address', undefined, function (result){ for (var j in f) $scope.edit[3][f[j]] = result.address }, function (){ dialogService.show("Invalid address.", false) });
                    break;
                default: $scope.execA(0, ['first_name', 'last_name'], ["name", 'name'], function (result){ for (var j in f) for (var i = 0; i < 2; i++) $scope.edit[0][f[j]][i] = i == 0 ? result.first_name : result.last_name });
            }
        };
    });