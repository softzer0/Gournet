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
                                    if (initialValue[i] === undefined) initialValue[i] = i ? 0 : $attrs.ngInitial.substring(0, 6) === 'opened' ? 8 : 0;
                                }
                                initialValue = new Date(0, 0, 0, initialValue[0], initialValue[1]);
                            } else initialValue = new Date(0, 0, 0, $attrs.ngInitial.substring(0, 6) === 'opened' ? 8 : 0, 0);
                            $scope.date[$attrs.ngInitial] = initialValue;
                        } else $parse($attrs.ngModel).assign($scope, initialValue);
                    }
                }
            }
        }
    });
}
app
    .config(function(uiGmapGoogleMapApiProvider, LANG, GMAPS_API_KEY) { uiGmapGoogleMapApiProvider.configure({libraries: 'visualization,places', language: LANG, key: GMAPS_API_KEY}) })

    .controller('CreateCtrl', function ($scope, $controller, $injector, USER) {
        $scope.work = new Array(7);
        $scope.isOpen = new Array(16);
        for (var i = 0; i < 8; i++) {
            if (i < 7) $scope.work.push(false);
            $scope.isOpen.push(false, false);
        }
        $scope.$parent.date = {};
        var obj;
        if (window.location.pathname == '/my-business/' /* important */) {
            var speakingurl = $injector.get('$speakingurl');
            $scope.genshort = function () { $scope.shortname = speakingurl.getSlug($scope.name) };
            obj = $scope;
        } else { obj = $scope.data.form }

        angular.extend(this, $controller('BaseMapCtrl', {$scope: $scope, funcs: [
            function (init){
                if (obj.location !== undefined && obj.location != '') { // && /^-?[\d]+(\.[\d]+)?(,|,? )-?[\d]+(\.?[\d]+)?$/.test(obj.location)
                    //obj.location = obj.location.replace(' ','');
                    init({latitude: obj.location.split(',')[1], longitude: obj.location.split(',')[0]});
                } else init(USER.home);
            },
            function (){ obj.location = $scope.map.center.longitude+','+$scope.map.center.latitude }
        ]}));

        $scope.refresh = function () { $scope.setCoords($scope.map.control.getGMap().getCenter()) };
    });