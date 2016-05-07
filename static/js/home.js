angular.module('mainApp', ['ui.bootstrap']).controller('MainCtrl', MainCtrl); /*, 'angularCSS']*/

function MainCtrl($scope, $uibModal) { /*, $css*/
    /*$css.add('/static/css/sett.css');*/
    $scope.showSettModal = function (id) {
        $scope.id = id;
        $uibModal.open({
            size: 'lg',
            templateUrl: '/static/modals/settings.html',
            scope: $scope
        });
    };
}