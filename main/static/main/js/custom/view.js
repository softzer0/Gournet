app
    .factory('menuService', function ($q, APIService){
        var itemService = APIService.init(8), menu, defer = $q.defer(); //, category

        function chngmenu() { if (!menu[0].hascontent) menu[1].name = gettext("Drinks"); else menu[1].name = gettext("Other drinks") } //menu[0].name == "Other drinks" / if (menu.length)

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
                    {first: false, hascontent: false, name: gettext("Alcoholic beverages"), content: [
                        {category: 'cider', name: gettext("Ciders"), content: []},
                        {category: 'whiskey', name: gettext("Whiskeys"), content: []},
                        {category: 'wine', name: gettext("Wines"), content: []},
                        {category: 'beer', name: gettext("Beers"), content: []},
                        {category: 'vodka', name: gettext("Vodkas"), content: []},
                        {category: 'brandy', name: pgettext('plural', "Brandy"), content: []},
                        {category: 'liqueur', name: gettext("Liqueurs"), content: []},
                        {category: 'cocktail', name: gettext("Cocktails"), content: []},
                        {category: 'tequila', name: gettext("Tequilas"), content: []},
                        {category: 'gin', name: gettext("Gins"), content: []},
                        {category: 'rum', name: gettext("Rums"), content: []}
                    ]},
                    {first: false, hascontent: false, name: gettext("Other drinks"), content: [
                        {category: 'coffee', name: gettext("Coffees"), content: []},
                        {category: 'soft_drink', name: gettext("Soft drinks"), content: []},
                        {category: 'juice', name: gettext("Juices"), content: []},
                        {category: 'tea', name: gettext("Teas"), content: []},
                        {category: 'hot_chocolate', name: gettext("Hot chocolates"), content: []},
                        {category: 'water', name: pgettext('plural', "Water"), content: []},
                        {category: 'drinks_other', name: gettext("Other"), content: []}
                    ]},
                    {first: false, hascontent: false, name: gettext("Food"), content: [
                        {category: 'fast_food', name: pgettext('plural', "Fast food"), content: []},
                        {category: 'pizza', name: gettext("Pizzas"), content: []},
                        {category: 'pasta', name: gettext("Pastas"), content: []},
                        {category: 'appetizer', name: gettext("Appetizers"), content: []},
                        {category: 'soup', name: gettext("Soups"), content: []},
                        {category: 'meal', name: gettext("Meals"), content: []},
                        {category: 'barbecue', name: pgettext('plural', "Barbecue"), content: []},
                        {category: 'seafood', name: pgettext('plural', "Seafood"), content: []},
                        {category: 'salad', name: gettext("Salads"), content: []},
                        {category: 'dessert', name: gettext("Desserts"), content: []},
                        {category: 'food_other', name: gettext("Other"), content: []}
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
            },
            find: function (f, v, c, a) {
                var e = false;
                for (var j = 0; j < menu.length; j++) {
                    for (var k = 0; k < menu[j].content.length; k++) {
                        if (c === undefined || menu[j].content[k].category == c) for (var l = 0; l < menu[j].content[k].content.length; l++) if (menu[j].content[k].content[l][f] == v) {
                            if (a) a(menu[j].content[k].content[l]);
                            e = true;
                            break;
                        }
                        if (e) break;
                    }
                    if (e) break;
                }
                return e;
            }
        }
    })

    .controller('BusinessCtrl', function($rootScope, $scope, $controller, $injector, $state, APIService, menuService, itemService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        itemService.menu = $scope.fav_state !== undefined || OWNER_MANAGER;
                        //if (itemService.menu) itemService.bu = $scope.fav_state == -1;
                        if ($scope.img !== undefined) menuService.observe.then(undefined, undefined, function (result){
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

        $scope.showItem = function (id){ $state.go('main.showObjs', {ids: id, type: 'item', ts: $scope.img !== undefined ? $scope.img[id].ts || 0 : 0}) };

        var workh;
        $scope.set_data = function (h){
            delete $scope.set_data;
            if ($scope.data.form !== undefined) {
                for (var i = 0; i < h.length; i++) $scope.data.form[0][i] = moment(h[i], 'HH:mm').toDate();
                for (; i < 7; i++) $scope.data.form[0][i] = new Date(0, 0, 0, i % 2 ? 0 : 8, 0);
                workh = ['value', 'form'];
                for (i = 0; i < 2; i++) for (var j = 1; j < 5; j++) $scope.data[workh[i]][j] = arguments[j];
                workh = $scope.data.value[0];
            } else workh = $scope.data.value;
            workh.push.apply(workh, h);
            $rootScope.$watch('currTime', $scope.ref_is_opened);
        };
        $scope.ref_is_opened = function (){
            var now = moment().tz($scope.data.tz), day = now.weekday(), d = [moment.tz(day == 6 && workh.length >= 4 ? workh[2] : day == 7 && workh.length == 6 ? workh[4] : workh[0], 'HH:mm', $scope.data.tz), moment.tz(day == 6 && workh.length >= 4 ? workh[3] : day == 7 && workh.length == 6 ? workh[5] : workh[1], 'HH:mm', $scope.data.tz)];
            day = now.date();
            for (var i = 0; i < 2; i++) if (day > d[i].date()) d[i].add(day - d[i].date(), 'days'); else if (d[i].date() > day) d[i].subtract(d[i].date() - day, 'days');
            if (d[1].isBefore(d[0]) || d[1].isSame(d[0])) if (now.isBefore(d[0])) $scope.is_opened = now.isBefore(d[1]); else $scope.is_opened = true; else $scope.is_opened = now.isBefore(d[1]) && (d[0].isBefore(now) || d[0].isSame(now));
        };

        $scope.dismissI = function() {
            angular.element('#editinf').remove();
            delete $scope.dismissI;
        };

        var services;
        // Not manager
        if (!OWNER_MANAGER) {
            $scope.data = {value: [], tz: undefined};
            //$scope.name = angular.element('.lead.text-center.br2').text();
            var likeService = APIService.init(3), loading;
            services = [$injector.get('$timeout'), $injector.get('CONTENT_TYPES')['business'], $injector.get('reviewService')];
            $scope.doFavouriteAction = function () {
                if (loading) return;
                loading = true;
                if ($scope.fav_state == 0) {
                    likeService.save({content_type: services[1], object_id: $scope.$parent.id},
                        function () {
                            $scope.fav_state = 1;
                            $scope.fav_count++;
                            services[0](function() { loading = false });
                        });
                } else {
                    likeService.delete({content_type: services[1], id: $scope.$parent.id},
                        function (){
                            $scope.fav_state = 0;
                            $scope.fav_count--;
                            services[0](function() { loading = false });
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
                services[2].new(el.val(), $scope.forms.review_stars, $scope.$parent.id).then(function () {
                    $scope.showrevf = false;
                    $scope.rating.user = services[2].getobjs(false, false)[0].stars;
                });
            };
            return;
        }

        // Manager
        $scope.data = $injector.get('EDIT_DATA');
        services = [$injector.get('dialogService'), $injector.get('$uibModal'), $injector.get('BASE_MODAL')];

        //$rootScope.$watch('currTime', function (val){ if (val !== undefined) });
        var s = APIService.init(13);
        $scope.s = s;
        function showerr(msg){
            services[0].show(msg, false);
            $scope.form[2] = '';
            return true;
        }
        $scope.doAction = function (){
            $scope.execA(null, ['type', 'name', 'shortname'], undefined, undefined, function (result){
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k in result.data) if (k == 'shortname') return showerr(gettext("Specified shortname is already taken."));
            }, function () {
                //if (!/^[\w.-]+$/.test($scope.edit.form[2])) showerr("Specified shortname is invalid.");
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k = 0; k < $scope.forbidden.length; k++) if ($scope.edit.form[2] == $scope.forbidden[k]) return showerr(gettext("Specified shortname is not permitted."));
            });
        };

        $scope.openEdit = function (){
            services[1].open({size: 'md', windowClass: 'ai', templateUrl: services[2], controller: function ($rootScope, $scope, $controller, $uibModalInstance, EDIT_DATA, checkField, dialogService){
                $scope.data = EDIT_DATA;
                $scope.title = gettext("Edit business info");
                $scope.file = '../../../edit';
                angular.extend(this, $controller('ModalCtrl', {$scope: $scope, $uibModalInstance: $uibModalInstance}), $controller('CreateCtrl', {$scope: $scope}));

                function disablef(d) {
                    $scope.data.disabled = d;
                    $scope.map.marker.options.draggable = !d;
                }
                $scope.doSave = function (){
                    var d = {};
                    if (checkField($scope.data, 1)) d['phone'] = $scope.data.form[1];
                    for (var i = 0; i < $scope.data.form[2].length; i++) if ($scope.data.form[2][i] == $scope.data.curr) {
                        $scope.data.form[2].splice(i, 1);
                        break;
                    }
                    if (checkField($scope.data, 2)) d['supported_curr'] = $scope.data.form[2];
                    if (checkField($scope.data, 3) || checkField($scope.data, 4)) {
                        d['address'] = $scope.data.form[3];
                        d['location'] = $scope.data.form[4];
                    }
                    var a = [0], p = ['phone', 'supported_curr', 'address', 'location', 'opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun'], r;
                    function f(v){ return moment(v).format('HH:mm') }
                    for (i = 0; i < 6; i++) if (i < 2 || $scope.work[i < 4 ? 0 : 1]) {
                        a[1] = i;
                        r = checkField($scope.data, a, false, f);
                        if (r) d[p[i+4]] = r;
                    }
                    if (Object.keys(d).length == 0) {
                        $scope.close();
                        return;
                    }
                    disablef(true);
                    s.partial_update(d, function () {
                        $scope.data.error = false;
                        a = Object.keys(d);
                        for (i = 0; i < a.length; i++) {
                            r = p.indexOf(a[i]);
                            if (r < 4) $scope.data.value[r+1] = $scope.data.form[r+1]; else $scope.data.value[0][r-4] = d[a[i]];
                        }
                        if (d.address !== undefined || d.location !== undefined || r >= 4) {
                            $scope.data.tz = result['tz'];
                            $rootScope.currTime = new Date();
                        }
                        $scope.close();
                    }, function (result) {
                        if (result.data.phone !== undefined) {
                            $scope.data.form[1] = '';
                            dialogService.show(gettext("The phone number entered is not valid."), false);
                        }
                        disablef(false);
                    });
                };
            }}).result.finally(function (){ $scope.data.disabled = false });
        };
    });