app
    .factory('menuService', function ($q, APIService){
        var itemService = APIService.init(8), menu; //, category

        function chngmenu() { if (!menu[0].hascontent) menu[1].name = "Drinks"; else menu[1].name = "Other drinks"; /*menu[0].name == "Other drinks" / if (menu.length)*/ }

        /*name = {
            'cider': menu[0].content[0].content,
            'whiscategory': menu[0].content[1].content,
            'wine': menu[0].content[2].content,
            'beer': menu[0].content[3].content,
            'vodka': menu[0].content[4].content,
            'brandy': menu[0].content[5].content,
            'liqueur': menu[0].content[6].content,
            'cocktail': menu[0].content[7].content,
            'tequila': menu[0].content[8].content,
            'gin': menu[0].content[9].content,
            'rum': menu[0].content[10].content,

            'coffee': menu[1].content[0].content,
            'soft_drink': menu[1].content[1].content,
            'juice': menu[1].content[2].content,
            'tea': menu[1].content[3].content,
            'hot_chocolate': menu[1].content[4].content,
            'water': menu[1].content[5].content,

            'fast_food': menu[2].content[0].content,
            'appetizer': menu[2].content[1].content,
            'soup': menu[2].content[2].content,
            'meal': menu[2].content[3].content,
            'barbecue': menu[2].content[4].content,
            'seafood': menu[2].content[5].content,
            'salad': menu[2].content[6].content,
            'dessert': menu[2].content[7].content
        };*/

        function add(item) {
            var c;
            for (var i = 0; i < menu.length; i++) {
                for (var j = 0; j < menu[i].content.length; j++) {
                    if (menu[i].content[j].category == item.category) {
                        menu[i].content[j].content.push(item);
                        c = true;
                        break;
                    }
                }
                if (c) {
                    if (!menu[i].hascontent) menu[i].hascontent = true;
                    break;
                }
            }
        }

        return {
            init: function (){
                menu = [
                    {hascontent: false, name: "Alcoholic beverages", content: [
                        {category: 'cider', name: "Ciders", content: []},
                        {category: 'whiskey', name: "Whiskeys", content: []},
                        {category: 'wine', name: "Wines", content: []},
                        {category: 'beer', name: "Beers", content: []},
                        {category: 'vodka', name: "Vodkas", content: []},
                        {category: 'brandy', name: "Brandy", content: []},
                        {category: 'liqueur', name: "Liqueurs", content: []},
                        {category: 'cocktail', name: "Cocktails", content: []},
                        {category: 'tequila', name: "Tequilas", content: []},
                        {category: 'gin', name: "Gin", content: []},
                        {category: 'rum', name: "Rum", content: []}
                    ]},
                    {hascontent: false, name: "Other drinks", content: [
                        {category: 'coffee', name: "Coffee", content: []},
                        {category: 'soft_drink', name: "Soft drinks", content: []},
                        {category: 'juice', name: "Juices", content: []},
                        {category: 'tea', name: "Teas", content: []},
                        {category: 'hot_chocolate', name: "Hot chocolate", content: []},
                        {category: 'water', name: "Water", content: []},
                        {category: 'drinks_other', name: "Other", content: []}
                    ]},
                    {hascontent: false, name: "Food", content: [
                        {category: 'fast_food', name: "Fast food", content: []},
                        {category: 'appetizer', name: "Appetizers", content: []},
                        {category: 'soup', name: "Soups", content: []},
                        {category: 'meal', name: "Meals", content: []},
                        {category: 'barbecue', name: "Barbecue", content: []},
                        {category: 'seafood', name: "Seafood", content: []},
                        {category: 'salad', name: "Salads", content: []},
                        {category: 'dessert', name: "Desserts", content: []},
                        {category: 'food_other', name: "Other", content: []}
                    ]}
                ];
                return menu;
            },
            load: function (id){
                return itemService.query({id: id, menu: 1},
                    function (result){
                        var i;
                        for (i = 0; i < result.length; i++) add(result[i]);
                        /*for (i = 0; i < menu.length; i++) {
                            for (c = 0; c < menu[i].content.length; c++) {
                                if (!menu[i].content[c].content.length) {
                                    menu[i].content.splice(c, 1);
                                    c--;
                                }
                            }
                            if (!menu[i].content.length) {
                                menu.splice(i, 1);
                                i--;
                            }
                        }*/
                        chngmenu();
                    }
                ).$promise;
            },
            del: function (cat, id){
                if (menu === undefined) return;
                var d = false, h = false;
                for (var i = 0; i < menu.length; i++) {
                    for (var j = 0; j < menu[i].content.length; j++) {
                        if (!d && menu[i].content[j].category == cat) for (var k = 0; k < menu[i].content[j].content.length; k++) {
                            if (menu[i].content[j].content[k].id == id) {
                                menu[i].content[j].content.splice(k, 1);
                                d = true;
                                break;
                            }
                        }
                        if (!h && menu[i].content[j].content.length > 0) h = true;
                        if (h && d) break; /*&& !menu[i].content[j].content.length) {
                            menu[i].content.splice(j, 1);
                            break;
                        }*/
                    }
                    if (d) {
                        menu[i].hascontent = h;
                        break;
                    } else h = false; /*&& !menu[i].content.length) {
                        menu.splice(i, 1);
                        break;
                    }*/
                }
                chngmenu();
            },
            new: function (name, price, cat) {
                return itemService.save({name: name, price: price, category: cat, m: '&menu=1'},
                    function (result) {
                        add(result);
                        chngmenu();
                     }
                ).$promise;
            }
        }
    })

    .controller('BusinessCtrl', function($scope, $timeout, $controller, $injector, APIService, menuService, CONTENT_TYPES, reviewService, itemService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        menuService.load($scope.id).then(function () { $scope.objloaded[1] = true });
                        itemService.bu = $scope.fav_state == -1;
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

        $scope.submitReview = function () {
            var el = angular.element('[name="forms.review"] [name="text"]'), cond;
            cond = el.val().length < $scope.minchar ? 1 : 0;
            if ($scope.forms.review.stars == 0) cond += 2;
            if (cond > 0) {
                $scope.forms.review.alert = cond;
                if (cond == 1 || cond == 3) el.focus();
                return;
            } else $scope.forms.review.alert = 0;
            reviewService.new(el.val(), $scope.forms.review.stars, $scope.$parent.id).then(function () { $scope.showrevf = false });
        };
    });