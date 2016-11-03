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

    .factory('businessService', function (uniService) { return uniService.getInstance('business') })
    .factory('userService', function (uniService) { return uniService.getInstance('user') })
    .factory('mixedService', function (uniService) { return uniService.getInstance() })

    .controller('UsersCtrl', function ($scope, makeFriendService) { $scope.doFriendRequestAction = function (index) { makeFriendService.run($scope.objs[index]) } })

    .controller('usersOnlyCtrl', function($scope, $controller, userService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [userService]}), $controller('UsersCtrl', {$scope: $scope})) })

    .controller('businesssOnlyCtrl', function($scope, $controller, businessService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [businessService]})) })

    .controller('sOnlyCtrl', function($scope, $controller, mixedService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [mixedService]}), $controller('EventsCtrl', {$scope: $scope}), $controller('ReviewsCtrl', {$scope: $scope}), $controller('UsersCtrl', {$scope: $scope})) });