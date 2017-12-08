app.requires.push('uiGmapgoogle-maps'); //, 'ct.ui.router.extras'
app
    .config(function ($stateProvider, uiGmapGoogleMapApiProvider, LANG, GMAPS_API_KEY) {
        function gentemp(g, t) { return (g ? '<p><a href="#/"><i class="fa fa-chevron-left"></i> '+gettext("Go to main page.")+'</a></p>' : '')+'<div ng-init="t = \''+(t !== undefined ? t : '\'')+'" ng-include="\'/static/main/events.html\'"></div>' }
        function chngtitle(t, c) { return (t[0] == '(' ? t.slice(0, t.indexOf(' '))+' ' : '')+c+' - Gournet' }

        $stateProvider.state('main', {
            url: '/',
            sticky: true,
            abstract: true,
            views: {main: {template: '<div ui-view></div>'}}
        })
        .state('main.search', {
            url: 'filter={keywords}&type={type:(?:user|business|item|event)}',
            templateUrl: 'search',
            controller: function ($scope, $stateParams, $rootScope) {
                $rootScope.title = chngtitle($rootScope.title, pgettext('page', "Search"));
                $scope.keywords = $stateParams.keywords; //.replace(/\++/g, ' ');
                $scope.t = $stateParams.type;
                if ($scope.$parent.search.keywords != $scope.keywords) $scope.$parent.search.keywords = $scope.keywords;
                $scope.$parent.search.show = false;
            }
        })
        .state('main.friends', {
            url: 'filter=friends',
            template: gentemp(true),
            controller: function ($rootScope){ $rootScope.title = chngtitle($rootScope.title, gettext("Friends")) }
        })
        .state('main.favourites', {
            url: 'filter=favourites',
            template: gentemp(true, 'event\'; is_fav = true'),
            controller: function ($rootScope){ $rootScope.title = chngtitle($rootScope.title, gettext("Favourites")) }
        })
        .state('main.main', {
            url: '*path',
            template: gentemp(false, 'event\''),
            controller: function ($rootScope){ $rootScope.title = chngtitle($rootScope.title, pgettext('page', "Main")) }
        });

        uiGmapGoogleMapApiProvider.configure({libraries: 'visualization,places', language: LANG, key: GMAPS_API_KEY});
    })

    /*.run(function ($rootScope, $state, $timeout) {
        $rootScope.$on('$stateChangeStart', function (evt, toState, toParams, fromState) {
            if (fromState.name === '' && toState.name == 'showObjs') {
                evt.preventDefault();
                $state.go('main.main', null, {location: false}).then(function () { $state.go(toState, toParams) });
            }
        });
        if (window.ga !== undefined) $rootScope.$on('$stateChangeSuccess', function() { $timeout(function() { window.ga('send', 'pageview', window.location.pathname+window.location.hash) }) });
    })*/

    .factory('markerService', function () {
        var markers = [];

        return {
            markers: markers,
            load: function (objs, del) {
                function objloop(func_id){
                    var obj, id;
                    for (var i = objs.length - 1; i >= 0; i--) if (objs[i].location !== undefined || objs[i].business !== undefined && objs[i].business.location !== undefined || /*del_each &&*/ objs[i].content_object !== undefined && objs[i].content_object.location !== undefined) {
                        obj = objs[i].location === undefined ? (objs[i].business || objs[i].content_object) : objs[i];
                        id = obj.business !== undefined ? obj.business.id : obj.content_object !== undefined ? obj.content_object.id : obj.id;
                        if (typeof func_id != 'number') func_id(id, obj); else if (id == func_id) return obj;
                    }
                }
                var j;
                if (del) {
                    for (j = markers.length - 1; j >= 0; j--) {
                        var obj = objloop(markers[j].obj_id);
                        if (obj) delete obj.location; else markers.splice(j, 1);
                    }
                }
                objloop(
                    function (id, obj){
                        for (j = markers.length - 1; j >= 0; j--) if (markers[j].obj_id == id) {
                            id = undefined;
                            break;
                        }
                        if (id !== undefined) markers.push({
                            id: markers.length,
                            latitude: obj.location.lat,
                            longitude: obj.location.lng,
                            options: {
                                labelClass: 'marker_label',
                                labelAnchor: '0 54',
                                labelContent: '<span>' + obj.type_display + ' "' + obj.name + '"</span>'
                            },
                            shortname: obj.shortname,
                            obj_id: id
                        });
                    });
            },
            click: function (i, n, o) { window.location.href = '/'+o.shortname+'/' }
        }
    })

    .factory('businessService', function (uniService) { return uniService.getInstance('business') })
    .factory('userService', function (uniService) { return uniService.getInstance('user') })
    .factory('mixedService', function (uniService) { return uniService.getInstance() })

    .controller('MapCtrl', function ($scope, $controller, $interval, markerService, USER) {
        $scope.$parent.loading = true;
        $scope.markers = markerService.markers;
        $scope.click = markerService.click;
        $scope.isCoord = function (){ return $scope.warn !== null && typeof($scope.warn) == 'object' };
        function getObjs() { return angular.element('[class*=\'objsfalse\']') }
        function disableWatch() {
            if ($scope.wid === undefined) return;
            $interval.cancel($scope.wid);
            $scope.$parent.wid = undefined;
        }
        function setWarnPos(position) {
            disableWatch();
            if ($scope.warn === null) $scope.warn = {is_init: null}; else if ($scope.map === undefined) $scope.warn = {is_init: true}; else if (typeof($scope.warn) != 'object') $scope.warn = {};
            $scope.warn.latitude = position.coords.latitude;
            $scope.warn.longitude = position.coords.longitude;
        }
        function initPos(init, position) {
            var obj;
            if (position === undefined || position.coords.accuracy >= 100) {
                if (position !== undefined) setWarnPos(position);
                obj = USER.home;
            } else obj = position.coords;
            init({latitude: obj.latitude, longitude: obj.longitude}).then(function () {
                $scope.map.options = {clickableIcons: false, styles: [{featureType: 'poi', stylers: [{visibility: 'simplified'}]}, {featureType: 'poi.business', stylers: [{visibility: 'off'}]}]};
                var ctrl = getObjs();
                if (ctrl[0].className.indexOf('user') == -1) ctrl.scope().load(true);
            });
        }
        function enableWatch(init) {
            var working, getpos = function (){
                navigator.geolocation.getCurrentPosition(
                    function (position){
                        if ($scope.map === undefined) initPos(init, position);
                        else if (position.coords.accuracy < 100) {
                            if ($scope.warn !== undefined) $scope.warn = undefined;
                            if (Math.abs(position.coords.latitude - $scope.map.marker.coords.latitude) * Math.pow(10, 7) < 500 && Math.abs(position.coords.longitude - $scope.map.marker.coords.longitude) * Math.pow(10, 7) < 500) return;
                            $scope.setCoords(position.coords);
                        } else setWarnPos(position);
                        working = false;
                    },
                    function (error) {
                        console.log(error.message);
                        var l = 0;
                        if ($scope.map === undefined) {
                            if (error.code == error.PERMISSION_DENIED) $scope.warn = 0;
                            initPos(init);
                            l++;
                        }
                        if ($scope.warn === undefined) $scope.warn = 1 + l;
                        working = false;
                    },
                    {enableHighAccuracy: true, maximumAge: 600000, timeout: 27000});
            };
            getpos();
            $scope.$parent.wid = $interval(function (){
                if (working) return;
                working = true;
                getpos();
            }, 5000);
        }
        var unregister = $scope.$watch(function (){ return getObjs().length }, function (val) {
            if (val == 0) return;
            unregister();
            angular.extend(this, $controller('BaseMapCtrl', {$scope: $scope, funcs: [
                function (init) { enableWatch(init) },
                function (args) {
                    var ctrl = getObjs(), state = ctrl.injector().get('$state');
                    if (ctrl[0].className.indexOf('user') == -1 && (state.current.name == 'main.main' || ctrl.scope().objs.length > 0)) ctrl.scope().load(); else if (ctrl[0].className.indexOf('user') == -1 || args.length) state.go('main.main');
                    if (args.length) {
                        disableWatch();
                        $scope.warn = null;
                    }
                }
            ]}));
        });
        $scope.doUseEnable = function (){
            if ($scope.isCoord()) {
                $scope.setCoords($scope.warn);
                $scope.warn = 1;
            } else enableWatch();
        };
        $scope.setCenterHome = function (home){ $scope.setCoords(home ? USER.home : $scope.map.control.getGMap().getCenter(), false) };
    })

    .controller('UsersCtrl', function ($scope, makeFriendService) { $scope.doFriendRequestAction = function (index) { makeFriendService.run($scope.objs[index]) } })

    .controller('usersOnlyCtrl', function($scope, $controller, userService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [userService]}), $controller('UsersCtrl', {$scope: $scope})) })

    .controller('businesssOnlyCtrl', function($scope, $controller, businessService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [businessService]})) })

    .controller('sOnlyCtrl', function($scope, $controller, mixedService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [mixedService]}), $controller('EventsCtrl', {$scope: $scope}), $controller('ItemsCtrl', {$scope: $scope}), $controller('ReviewsCtrl', {$scope: $scope}), $controller('UsersCtrl', {$scope: $scope})) });