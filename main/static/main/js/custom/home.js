//app.requires.push('ct.ui.router.extras');
app
    .config(function ($stateProvider) {
        $stateProvider.state('main', {
            url: '/',
            sticky: true,
            abstract: true,
            views: {main: {template: '<div ui-view></div>'}}
        })
        .state('main.search', {
            url: 'search={keywords}&type={type:(?:user|business|item|event)}',
            templateUrl: 'search',
            controller: function ($scope, $stateParams) {
                $scope.keywords = $stateParams.keywords; //.replace(/\++/g, ' ');
                $scope.t = $stateParams.type;
                if ($scope.$parent.search.keywords != $scope.keywords) $scope.$parent.search.keywords = $scope.keywords;
                $scope.$parent.search.show = false;
                //...
            }
        })
        .state('main.main', {
            url: '*path',
            template: '<div ng-init="t = \'event\'" ng-include="\'/static/main/events.html\'"></div>'
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

    .controller('businesssOnlyCtrl', function($scope, $controller, businessService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [businessService]})) })

    .controller('usersOnlyCtrl', function($scope, $controller, userService, makeFriendService) {
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [userService]}));

        $scope.doFriendRequestAction = function (index) { makeFriendService.run($scope.objs[index]) };
    })

    .controller('sOnlyCtrl', function($scope, $controller, mixedService) {
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [mixedService]}), $controller('EventsCtrl', {$scope: $scope}), $controller('ReviewsCtrl', {$scope: $scope}));

        // ...
    });