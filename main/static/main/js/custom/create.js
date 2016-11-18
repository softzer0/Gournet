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

    .controller('CreateCtrl', function ($scope, uiGmapGoogleMapApi, $speakingurl) {
        $scope.work = [];
        $scope.isOpen = [false, false, false, false, false, false];
        $scope.date = [];
        $scope.genshort = function () { $scope.shortname = $speakingurl.getSlug($scope.name) };

        function geocodeAddress(maps, address, callback) {
            new maps.Geocoder().geocode({address: address, componentRestrictions: {country: 'RS'}}, function (results, status) {
                if (status == maps.GeocoderStatus.OK) {
                    callback(results[0].geometry.location);
                } else {
                    console.log("Geocode was not successful for the following reason: " + status);
                }
            });
        }
        function setCoords(coords, nom) {
            if (!nom) {
                $scope.map.marker.coords.latitude = coords.lat();
                $scope.map.marker.coords.longitude = coords.lng();
            }
            $scope.map.center.latitude = coords.lat();
            $scope.map.center.longitude = coords.lng();
            $scope.location = $scope.map.center.latitude+','+$scope.map.center.longitude;
        }
        uiGmapGoogleMapApi.then(function(maps) {
            geocodeAddress(maps, $scope.address || "Vranje, Serbia", function (coords){
                $scope.map = {
                    zoom: 15,
                    //options: {scrollwheel: false},
                    center: {latitude: coords.lat(), longitude: coords.lng()},
                    marker: {
                        id: 0,
                        coords: {latitude: coords.lat(), longitude: coords.lng()}, //{latitude: 42.5567616, longitude: 21.8621273}
                        options: {draggable: true},
                        events: {dragend: function (marker) { setCoords(marker.getPosition(), true) }}
                    },
                    /*events: {
                        resize: function() {
                            $scope.map.center.latitude = $scope.map.marker.coords.latitude;
                            $scope.map.center.latitude = $scope.map.marker.coords.longitude;
                        }
                    },*/
                    //search: {places_changed: function (){ $scope.geocode(true) }},
                    control: {}
                };
            });
            maps.event.addDomListener(window, 'resize', function() {
                if ($scope.map.control.length == 0) return;
                var map = $scope.map.control.getGMap(), center = map.getCenter();
                google.maps.event.trigger(map, 'resize');
                map.setCenter(center);
            });
        });

        var l = true;
        $scope.geocode = function (f) {
            if ($scope.map === undefined) return;
            if ($scope.address != '' && (!f || l)) {
                geocodeAddress($scope.address, setCoords);
                l = false;
            } else if (f) l = $scope.address == '';
        };
        $scope.refresh = function () { setCoords($scope.map.control.getGMap().getCenter()) };
    });