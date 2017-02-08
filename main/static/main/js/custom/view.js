app
    .factory('menuService', function ($q, APIService){
        var itemService = APIService.init(8), menu, defer = $q.defer(); //, category

        function chngmenu() { if (!menu[0].hascontent) menu[1].name = "Drinks"; else menu[1].name = "Other drinks" } //menu[0].name == "Other drinks" / if (menu.length)

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
            var c = false, f;
            for (var i = 0; i < menu.length; i++) {
                if (c === false) for (var j = 0; j < menu[i].content.length; j++) {
                    if (menu[i].content[j].category == item.category) {
                        menu[i].content[j].content.push(item);
                        c = true;
                        break;
                    }
                }
                if (menu[i].first) if (f) {
                    menu[i].first = false;
                    break;
                } else f = true;
                if (c === true) {
                    if (!menu[i].hascontent) menu[i].hascontent = true;
                    if (!f) {
                        menu[i].first = true;
                        f = true;
                    } else break;
                    c = undefined;
                }
            }
        }

        function end(p){
            chngmenu();
            defer.notify(p);
        }

        return {
            init: function (){
                menu = [ // important
                    {first: false, hascontent: false, name: "Alcoholic beverages", content: [
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
                    {first: false, hascontent: false, name: "Other drinks", content: [
                        {category: 'coffee', name: "Coffee", content: []},
                        {category: 'soft_drink', name: "Soft drinks", content: []},
                        {category: 'juice', name: "Juices", content: []},
                        {category: 'tea', name: "Teas", content: []},
                        {category: 'hot_chocolate', name: "Hot chocolate", content: []},
                        {category: 'water', name: "Water", content: []},
                        {category: 'drinks_other', name: "Other", content: []}
                    ]},
                    {first: false, hascontent: false, name: "Food", content: [
                        {category: 'fast_food', name: "Fast food", content: []},
                        {category: 'pizza', name: "Pizza", content: []},
                        {category: 'pasta', name: "Pasta", content: []},
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
                        //var i;
                        for (var i = 0; i < result.length; i++) add(result[i]);
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
                        end(result);
                    }
                ).$promise;
            },
            del: function (cat, id){
                if (menu === undefined) return;
                var d = 0;
                for (var i = 0; i < menu.length; i++) {
                    if (d !== null) {
                        for (var j = 0; j < menu[i].content.length; j++) {
                            if ((!d || d == 2) && menu[i].content[j].category == cat) for (var k = 0; k < menu[i].content[j].content.length; k++) if (menu[i].content[j].content[k].id == id) {
                                menu[i].content[j].content.splice(k, 1);
                                d++;
                                break;
                            }
                            if (d < 2 && menu[i].content[j].content.length > 0) d += 2;
                            if (d == 3) break; /*&& !menu[i].content[j].content.length) {
                             menu[i].content.splice(j, 1);
                             break;
                             }*/
                        }
                        if (d == 1 || d == 3) {
                            menu[i].hascontent = d == 3;
                            if (d == 3) break; else if (menu[i].first) {
                                menu[i].first = false;
                                d = null;
                            } else break;
                        } else d = 0; /*&& !menu[i].content.length) {
                         menu.splice(i, 1);
                         break;
                         }*/
                    } else if (menu[i].hascontent) {
                        menu[i].first = true;
                        break;
                    }
                }
                end(id);
            },
            observe: defer.promise,
            new: function (name, price, cat) {
                return itemService.save({name: name, price: price, category: cat, m: '&menu=1'},
                    function (result) {
                        add(result);
                        end(result);
                    }
                ).$promise;
            }
        }
    })

    .controller('BusinessCtrl', function($rootScope, $scope, $timeout, $controller, $injector, $state, APIService, menuService, CONTENT_TYPES, reviewService, itemService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        itemService.menu = $scope.fav_state !== undefined;
                        //if (itemService.menu) itemService.bu = $scope.fav_state == -1;
                        if ($scope.img !== undefined) menuService.observe.then(null, null, function (result){
                            if (typeof(result) == 'number') {
                                $scope.img[result].w();
                                delete $scope.img[result];
                                delete $scope.edit_i[result];
                            } else if (result.constructor == Array) for (var i = 0; i < result.length; i++) $scope.setW(result[i].id); else $scope.setW(result.id);
                        });
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

        $scope.submitReview = function () {
            var el = angular.element('[name="forms.review"] [name="text"]'), cond;
            cond = el.val().length < $scope.minchar ? 1 : 0;
            if ($scope.forms.review_stars == 0) cond += 2;
            if (cond > 0) {
                $scope.forms.review.alert = cond;
                if (cond == 1 || cond == 3) el.focus();
                return;
            } else $scope.forms.review.alert = 0;
            reviewService.new(el.val(), $scope.forms.review_stars, $scope.$parent.id).then(function () {
                $scope.showrevf = false;
                $scope.rating.user = reviewService.getobjs(false, false)[0].stars;
            });
        };

        $scope.showItem = function (id){ $state.go('main.showObjs', {ids: id, type: 'item', ts: $scope.img !== undefined ? $scope.img[id].ts || 0 : 0}) };

        var workh;
        $scope.set_data = function (h){
            delete $scope.set_data;
            if ($scope.data.form !== undefined) {
                for (var i = 0; i < h.length; i++) $scope.data.form[0][i] = moment(h[i], 'HH:mm').toDate();
                for (; i < 7; i++) $scope.data.form[0][i] = new Date(0, 0, 0, i % 2 ? 0 : 8, 0);
                $scope.$watch('data.tz', function (val, oldval){ if (val != oldval) $scope.ref_is_opened() });
                workh = ['value', 'form'];
                for (i = 0; i < 2; i++) {
                    $scope.data[workh[i]][1] = arguments[1];
                    $scope.data[workh[i]][3] = arguments[2];
                }
                $scope.data.form[4] = arguments[3];
                $scope.data.form[2] = arguments[4];
                workh = $scope.data.value[0];
            } else workh = $scope.data.value;
            workh.push.apply(workh, h);
            $rootScope.$watch('currTime', $scope.ref_is_opened);
        };
        $scope.ref_is_opened = function (){
            var now = moment().tz($scope.data.tz), day = now.weekday(), opened = moment.tz(day == 6 && workh.length >= 4 ? workh[2] : day == 7 && workh.length == 6 ? workh[4] : workh[0], 'HH:mm', $scope.data.tz).toDate(), closed = moment.tz(day == 6 && workh.length >= 4 ? workh[3] : day == 7 && workh.length == 6 ? workh[5] : workh[1], 'HH:mm', $scope.data.tz).toDate();
            now = now.toDate();
            if (opened >= closed) if (opened > now) $scope.is_opened = now < closed; else $scope.is_opened = true; else $scope.is_opened = opened <= now && now < closed;
        };

        // Manager
        if (angular.element('.img_p').length == 0) {
            $scope.data = {value: [], tz: undefined};
            return;
        }
        $scope.data = $injector.get('editData');
        var services = [$injector.get('dialogService'), $injector.get('$uibModal'), $injector.get('BASE_MODAL')];

        //$rootScope.$watch('currTime', function (val){ if (val !== undefined) });
        $scope.s = APIService.init(13);
        $scope.doAction = function (){
            $scope.execA(null, ['type', 'name', 'shortname'], undefined, undefined, function (result){
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k in result.data) if (k == 'shortname') {
                    services[0].show("Specified shortname is already taken.", false);
                    return true;
                }
            }, function () {
                /*if (!/^[\w.-]+$/.test($scope.edit.form[2])) {
                    services[0].show("Specified shortname is invalid.", false);
                    return true;
                }*/
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k = 0; k < $scope.forbidden.length; k++) if ($scope.edit.form[2] == $scope.forbidden[k]) {
                    services[0].show("Specified shortname is not permitted.", false);
                    return true;
                }
            });
        };
        $scope.openEdit = function (){
            services[1].open({size: 'md', windowClass: 'ai', templateUrl: services[2], controller: function ($scope, $controller, $uibModalInstance, editData){
                $scope.data = editData;
                $scope.title = "Edit business info";
                $scope.file = '../../../edit';
                angular.extend(this, $controller('ModalCtrl', {$scope: $scope, $uibModalInstance: $uibModalInstance}), $controller('CreateCtrl', {$scope: $scope}));

                $scope.doSave = function (){
                    //...
                };
            }});
        };
    });