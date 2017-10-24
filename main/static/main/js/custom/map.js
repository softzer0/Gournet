app.controller('BaseMapCtrl', function ($scope, $q, uiGmapGoogleMapApi, funcs) {
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
                    //search: {places_changed: function (){ $scope.geocode(true) }},
                    control: {},
                    searchbox: {
                        options: {autocomplete: true, componentRestrictions: {country: 'RS'}},
                        events: {place_changed: function (autocomplete) {
                            if ($scope.data !== undefined) angular.element('#id_address').trigger('input');
                            var p = autocomplete.getPlace();
                            if (p.geometry !== undefined) $scope.setCoords(p.geometry.location, false);
                        }}
                    }
                };
                maps.event.addDomListener(window, 'resize', function() {
                    if ($scope.map.control.length == 0) return;
                    var map = $scope.map.control.getGMap(), center = map.getCenter();
                    maps.event.trigger(map, 'resize');
                    map.setCenter(center);
                });
                return $q.when();
            }
        );
    });
});