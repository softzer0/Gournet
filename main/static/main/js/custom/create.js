app.requires.push('angular-speakingurl');
app
    .directive('ngInitial', function($parse) {
        return {
            restrict: 'A',
            compile: function($element, $attrs) {
                var initialValue = $attrs.value || $element.val();
                return {
                    pre: function($scope, $element, $attrs) {
                        if ($attrs.ngInitial !== '') {
                            if (initialValue !== '' && initialValue !== 'aN:aN') {
                                initialValue = initialValue.split(':');
                                for (var i = 0; i <= 1; i++) {
                                    initialValue[i] = parseInt(initialValue[i]);
                                    if (initialValue[i] === undefined) initialValue[i] = i ? 0 : $attrs.ngInitial % 2 ? 0 : 8;
                                }
                                initialValue = new Date(0, 0, 0, initialValue[0], initialValue[1]);
                            } else initialValue = new Date(0, 0, 0, $attrs.ngInitial % 2 ? 0 : 8, 0);
                            $scope.date[$attrs.ngInitial] = initialValue;
                        } else $parse($attrs.ngModel).assign($scope, initialValue);
                    }
                }
            }
        }
    })

    .controller('CreateCtrl', function ($scope, $controller, $timeout, $speakingurl) {
        $scope.work = [];
        $scope.isOpen = [false, false, false, false, false, false];
        $scope.date = [];
        $scope.genshort = function () { $scope.shortname = $speakingurl.getSlug($scope.name) };

        angular.extend(this, $controller('BaseMapCtrl', {$scope: $scope, funcs: [
            function (init){
                if ($scope.location != '') { // && /^-?[\d]+(\.[\d]+)?(,|,? )-?[\d]+(\.?[\d]+)?$/.test($scope.location)
                    $scope.location = $scope.location.replace(' ','');
                    init({latitude: $scope.location.split(',')[1], longitude: $scope.location.split(',')[0]});
                } else if ($scope.address != '') $scope.geocodeAddress($scope.address, init); else init({latitude: 42.5450345, longitude: 21.90027120000002}); //Vranje, Serbia
            },
            function (){ $scope.location = $scope.map.center.latitude+','+$scope.map.center.longitude }
        ]}));

        var l = true;
        $scope.geocode = function (f) {
            if ($scope.map === undefined) {
                $timeout(function() { $scope.geocode(true) }, 1000);
                return;
            }
            if ($scope.address != '' && (!f || l)) {
                $scope.geocodeAddress($scope.address, setCoords);
                l = false;
            } else if (f) l = $scope.address == '';
        };
        $scope.refresh = function () { $scope.setCoords($scope.map.control.getGMap().getCenter()) };
    });