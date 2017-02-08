app.requires.push('uiGmapgoogle-maps');
if (window.location.pathname == '/my-business/') { //important
    app.requires.push('angular-speakingurl');
    app.directive('ngInitial', function($parse) {
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
    });
}
app
    .config(function(uiGmapGoogleMapApiProvider) { uiGmapGoogleMapApiProvider.configure({libraries: 'visualization'}) }) //, api: 'APIKEY'

    .controller('CreateCtrl', function ($scope, $controller, $timeout, $injector, USER) {
        $scope.work = [];
        $scope.isOpen = [false, false, false, false, false, false];
        $scope.date = [];
        var obj, fi;
        if (window.location.pathname == '/my-business/' /* important */) {
            var speakingurl = $injector.get('$speakingurl');
            $scope.genshort = function () { $scope.shortname = speakingurl.getSlug($scope.name) };
            obj = $scope; fi = ['address', 'location'];
        } else { obj = $scope.data.form; fi = [3, 4] }

        angular.extend(this, $controller('BaseMapCtrl', {$scope: $scope, funcs: [
            function (init){
                if (obj[fi[1]] !== undefined && obj[fi[1]] != '') { // && /^-?[\d]+(\.[\d]+)?(,|,? )-?[\d]+(\.?[\d]+)?$/.test(obj[fi[1]])
                    obj[fi[1]] = obj[fi[1]].replace(' ','');
                    init({latitude: obj[fi[1]].split(',')[1], longitude: obj[fi[1]].split(',')[0]});
                } else if (obj[fi[0]] !== undefined && obj[fi[0]] != '') $scope.geocodeAddress(obj[fi[0]], init); else init(USER.home);
            },
            function (){ obj[fi[1]] = $scope.map.center.longitude+','+$scope.map.center.latitude }
        ]}));

        var l = true;
        $scope.geocode = function (f) {
            if ($scope.map === undefined) {
                $timeout(function() { $scope.geocode(true) }, 1000);
                return;
            }
            if (obj[fi[0]] !== undefined && obj[fi[0]] != '' && (!f || l)) {
                $scope.geocodeAddress(obj[fi[0]], $scope.setCoords);
                l = false;
            } else if (f) l = obj[fi[0]] == '';
        };
        $scope.refresh = function () { $scope.setCoords($scope.map.control.getGMap().getCenter()) };
    });