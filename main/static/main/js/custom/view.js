app
    /*.filter('newlines', function () {
        return function(text) {
            return text.replace(/\n/g, '<br>');
        }
    })*/

    .controller('BusinessCtrl', function($scope, $timeout, $controller, $injector, APIService, menuService, CONTENT_TYPES, reviewService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        menuService.load($scope.id).then(function () { $scope.objloaded[1] = true });
                    }
                }},
                {name: 'reviews', func: function(){ $scope.objloaded[2] = true }}]}));

        //$scope.name = angular.element('.lead.text-center.br2').text();
        var likeService = APIService.init(3), loading;

        $scope.doFavouriteAction = function () {
            if (loading) return;
            loading = true;
            if ($scope.fav_state == 0) {
                likeService.save({content_type: CONTENT_TYPES['business'], object_id: $scope.$parent.id},
                    function () {
                        $scope.fav_state = 1;
                        $scope.fav_count++;
                        $timeout(function() { loading = false });
                    });
            } else {
                likeService.delete({content_type: CONTENT_TYPES['business'], id: $scope.$parent.id},
                    function (){
                        $scope.fav_state = 0;
                        $scope.fav_count--;
                        $timeout(function() { loading = false });
                    });
            }
        };
        /*$scope.$parent.$watch('rel_state', function (value) {
            $scope.rel_state_msg = "Are you sure that you want to ";
            if (value == 0) $scope.rel_state_msg += "set a favourite this business"; else $scope.rel_state_msg += "remove from favourites this business";
            //$scope.rel_state_msg += ' <strong>'+$scope.name+'</strong>?'
        })*/

        //...

        $scope.dismissAlert = function () {
            $scope.review_alert = 0;
            $scope.forms.review.$setValidity('text', true);
        };
        $scope.submitReview = function () {
            var el = angular.element('[name="forms.review"] [name="text"]'), cond;
            if (el.val().length < $scope.minchar) cond = 1; else cond = 0;
            if ($scope.forms.review_stars == 0) cond += 2;
            $scope.forms.review.$setValidity('text', cond != 1 && cond != 3);
            if (cond > 0) {
                $scope.review_alert = cond;
                if (cond == 1 || cond == 3) el.focus();
                return;
            } else $scope.review_alert = 0;
            reviewService.new(el.val(), $scope.forms.review_stars, $scope.$parent.id).then(function () { $scope.showrevf = false });
        };
    });