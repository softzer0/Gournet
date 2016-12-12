//app.requires.push('ct.ui.router.extras');
app
    .config(function ($stateProvider) {
        function gentemp(g, t) { return (g ? '<p><a href="#/"><i class="fa fa-chevron-left"></i> Go to main page.</a></p>' : '')+'<div ng-init="t = \''+(t !== undefined ? t : '\'')+'" ng-include="\'/static/main/events.html\'"></div>' }

        $stateProvider.state('main', {
            url: '/',
            sticky: true,
            abstract: true,
            views: {main: {template: '<div ui-view></div>'}}
        })
        .state('main.search', {
            url: 'filter={keywords}&type={type:(?:user|business|item|event)}',
            templateUrl: 'search',
            controller: function ($scope, $stateParams) {
                $scope.keywords = $stateParams.keywords; //.replace(/\++/g, ' ');
                $scope.t = $stateParams.type;
                if ($scope.$parent.search.keywords != $scope.keywords) $scope.$parent.search.keywords = $scope.keywords;
                $scope.$parent.search.show = false;
            }
        })
        .state('main.friends', {
            url: 'filter=friends',
            template: gentemp(true)
        })
        .state('main.favourites', {
            url: 'filter=favourites',
            template: gentemp(true, 'event\'; is_fav = true')
        })
        .state('main.main', {
            url: '*path',
            template: gentemp(false, 'event\'')
        });
    })

    .run(function ($rootScope, $state, $timeout) {
        $rootScope.$on('$stateChangeStart', function (evt, toState, toParams, fromState) {
            if (fromState.name === '' && toState.name == 'showObjs') {
                evt.preventDefault();
                $state.go('main.main', null, {location: false}).then(function () { $state.go(toState, toParams) });
            }
        });
        if (window.ga !== undefined) $rootScope.$on('$stateChangeSuccess', function() { $timeout(function() { window.ga('send', 'pageview', window.location.pathname+window.location.hash) }) });
    })

    .factory('markerService', function () {
        var markers = [];

        return {
            markers: markers,
            load: function (objs, del, each) {
                if (!each) var nested = objs[0].location === undefined, obj;
                var j, c = del === null && markers.length > 0;
                for (var i = 0; i < objs.length; i++) {
                    if (!each || objs[i].location !== undefined || objs[i].business !== undefined) {
                        obj = (each ? objs[i].location === undefined : nested) ? objs[i].business : objs[i];
                        if (objs[i].location === undefined || c) for (j = 0; j < markers.length; j++) if (markers[j].shortname == obj.shortname) {
                            j = true;
                            break;
                        }
                        if (!j) {
                            markers.push({
                                id: markers.length,
                                longitude: obj.location.lng,
                                latitude: obj.location.lat,
                                options: {
                                    labelClass: 'marker_label',
                                    labelAnchor: '0 54',
                                    labelContent: '<span>' + obj.type_display + ' "' + obj.name + '"</span>'
                                },
                                shortname: obj.shortname
                            });
                            if (del) delete obj.location;
                        } else j = false;
                    }
                }
            },
            click: function (i, n, o) { window.location.href = '/'+o.shortname }
        }
    })

    .factory('businessService', function (uniService) { return uniService.getInstance('business') })
    .factory('userService', function (uniService) { return uniService.getInstance('user') })
    .factory('mixedService', function (uniService) { return uniService.getInstance() })

    .controller('MapCtrl', function ($scope, $controller, markerService) {
        $scope.$parent.loading = true;
        $scope.markers = markerService.markers;
        $scope.click = markerService.click;
        var unregister = $scope.$watch(function (){ return angular.element('[class*=\'objsfalse\']').length }, function (val) {
            if (val == 0) return;
            unregister();
            angular.extend(this, $controller('BaseMapCtrl', {$scope: $scope, funcs: [
                function (init) {
                    //...
                    init({latitude: 42.5450345, longitude: 21.90027120000002} /*Vranje, Serbia*/).then(function () {
                        $scope.$parent.coords = $scope.map.marker.coords;
                        $scope.map.options = {clickableIcons: false, styles: [{featureType: 'poi', stylers: [{visibility: 'simplified'}]}, {featureType: 'poi.business', stylers: [{visibility: 'off'}]}]};
                        var ctrl = angular.element('[class*=\'objsfalse\']');
                        if (ctrl[0].className.indexOf('user') == -1) ctrl.scope().load(true);
                    });
                },
                function () {
                    var ctrl = angular.element('[class*=\'objsfalse\']'), state = ctrl.injector().get('$state');
                    if (ctrl[0].className.indexOf('user') == -1 && (state.current.name == 'main.main' || ctrl.scope().objs.length > 0)) ctrl.scope().load(); else state.go('main.main');
                }
            ]}));
        });
    })

    .controller('UsersCtrl', function ($scope, makeFriendService) { $scope.doFriendRequestAction = function (index) { makeFriendService.run($scope.objs[index]) } })

    .controller('usersOnlyCtrl', function($scope, $controller, userService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [userService]}), $controller('UsersCtrl', {$scope: $scope})) })

    .controller('businesssOnlyCtrl', function($scope, $controller, businessService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [businessService]})) })

    .controller('sOnlyCtrl', function($scope, $controller, mixedService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [mixedService]}), $controller('EventsCtrl', {$scope: $scope}), $controller('ReviewsCtrl', {$scope: $scope}), $controller('UsersCtrl', {$scope: $scope})) });