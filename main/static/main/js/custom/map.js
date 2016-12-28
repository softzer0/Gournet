app.controller('BaseMapCtrl', function ($scope, $q, uiGmapGoogleMapApi, funcs) {
        $scope.geocodeAddress = function(address, callback) {
            $scope.geocoder[0].geocode({address: address, componentRestrictions: {country: 'RS'}}, function (results, status) {
                if (status == $scope.geocoder[1]) {
                    callback(results[0].geometry.location);
                } else {
                    console.log("Geocode was not successful for the following reason: " + status);
                }
            });
        };
        $scope.setCoords = function(coords, nom) {
            var is_f = coords.latitude === undefined;
            function setC(obj) {
                obj.latitude = is_f ? coords.lat() : coords.latitude;
                obj.longitude = is_f ? coords.lng() : coords.longitude;
            }
            if (!nom) setC($scope.map.marker.coords);
            setC($scope.map.center);
            funcs[1](jQuery.makeArray(arguments).splice(1)); //if (funcs.length > 1)
        };
        uiGmapGoogleMapApi.then(function(maps) {
            $scope.geocoder = [new maps.Geocoder(), maps.GeocoderStatus.OK];
            funcs[0](
                function (coords){
                    var is_f = coords.latitude === undefined;
                    $scope.map = {
                        zoom: 15,
                        //options: {scrollwheel: false},
                        center: is_f ? {latitude: coords.lat(), longitude: coords.lng()} : coords,
                        marker: {
                            id: 0,
                            coords: {latitude: is_f ? coords.lat() : coords.latitude, longitude: is_f ? coords.lng() : coords.longitude}, //{latitude: 42.5567616, longitude: 21.8621273}
                            options: {draggable: true},
                            events: {dragend: function (marker) { $scope.setCoords(marker.getPosition(), true) }}
                        },
                        /*events: {
                            resize: function() {
                                $scope.map.center.latitude = $scope.map.marker.coords.longitude;
                                $scope.map.center.latitude = $scope.map.marker.coords.latitude;
                            }
                        },*/
                        //search: {places_changed: function (){ $scope.geocode(true) }},
                        control: {}
                    };
                    maps.event.addDomListener(window, 'resize', function() {
                        if ($scope.map.control.length == 0) return;
                        var map = $scope.map.control.getGMap(), center = map.getCenter();
                        maps.event.trigger(map, 'resize');
                        map.setCenter(center);
                    });
                    return $q.when();
                });
        });
});