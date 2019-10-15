if (OWNER_MANAGER === null) app.requires.push('LocalStorageModule');
app
    .filter('revc', function() { return function(input) { return input.split(',')[1]+','+input.split(',')[0] } })

    .factory('menuService', function ($q, $injector, APIService, USER){
        var itemService = APIService.init(8), menu, defer = $q.defer(), props = {loaded: false}, localStorageService = (USER.anonymous || USER.ordering) && $injector.get('localStorageService'); //, category

        function chngmenu() { if (!menu[0].hascontent) menu[1].name = gettext("Drinks"); else menu[1].name = gettext("Other drinks") } //menu[0].name == "Other drinks" / if (menu.length)
        function add(item, n) {
            var c = false, f;
            for (var i = 0; i < menu.length; i++) {
                if (c === false) for (var j = 0; j < menu[i].content.length; j++) {
                    if (menu[i].content[j].category == item.category) {
                        if (!n && localStorageService) {
                            item.quantity = localStorageService.get(item.id);
                            if (item.quantity) menu[i].content[j].has_q = menu[i].content[j].has_q ? menu[i].content[j].has_q+1 : 1;
                        }
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
                        {category: 'sandwich', name: gettext("Sandwiches"), content: []},
                        {category: 'pizza', name: gettext("Pizzas"), content: []},
                        {category: 'pasta', name: gettext("Pastas"), content: []},
                        {category: 'pastry', name: gettext("Pastries"), content: []},
                        {category: 'breakfast', name: gettext("Breakfasts"), content: []},
                        {category: 'appetizer', name: gettext("Appetizers"), content: []},
                        {category: 'soup_stew', name: gettext("Soups, stews"), content: []},
                        {category: 'meal', name: gettext("Meals"), content: []},
                        {category: 'barbecue', name: pgettext('plural', "Barbecue"), content: []},
                        {category: 'seafood_fish', name: gettext("Seafood, fish dishes"), content: []},
                        {category: 'additive', name: gettext("Food additives"), content: []},
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
                        for (var i = 0; i < result.length; i++) add(result[i]);
                        end(result);
                        props.loaded = true;
                    }
                ).$promise;
            },
            props: props,
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
                        add(result, true);
                        end(result);
                    }
                ).$promise;
            },
            find: function (f, v, c, a) {
                var e = false;
                for (var j = 0; j < menu.length; j++) {
                    for (var k = 0; k < menu[j].content.length; k++) {
                        if (c === undefined || menu[j].content[k].category == c) for (var l = 0; l < menu[j].content[k].content.length; l++) if (menu[j].content[k].content[l][f] == v) {
                            if (a) a(menu[j].content[k].content[l], menu[j].content[k]);
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

    .controller('BusinessCtrl', function($rootScope, $scope, $controller, $injector, $state, $timeout, APIService, menuService, itemService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        itemService.menu = $scope.fav_state !== undefined || OWNER_MANAGER || OWNER_MANAGER === null;
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
                for (; i < 6; i++) $scope.data.form[0][i] = new Date(0, 0, 0, i % 2 ? 0 : 8, 0);
                workh = ['value', 'form'];
                for (i = 0; i < 2; i++) for (var j = 1; j < 5; j++) $scope.data[workh[i]][j] = arguments[j];
                workh = $scope.data.value[0];
            } else workh = $scope.data.value;
            workh.push.apply(workh, h);
            $rootScope.$watch('currTime', $scope.ref_is_opened);
        };
        $scope.ref_is_opened = function (){
            if (workh[0] != workh[1] || workh.length == 2 || workh[2] != workh[3] || workh.length == 4 || workh[4] != workh[5]) {
                var now = moment().tz($scope.data.tz), day = now.weekday(), d = [moment.tz(day == 6 && workh.length >= 4 ? workh[2] : day == 7 && workh.length == 6 ? workh[4] : workh[0], 'HH:mm', $scope.data.tz), moment.tz(day == 6 && workh.length >= 4 ? workh[3] : day == 7 && workh.length == 6 ? workh[5] : workh[1], 'HH:mm', $scope.data.tz)];
                day = now.date();
                for (var i = 0; i < 2; i++) if (day > d[i].date()) d[i].add(day - d[i].date(), 'days'); else if (d[i].date() > day) d[i].subtract(d[i].date() - day, 'days');
                if (d[1].isBefore(d[0]) || d[1].isSame(d[0])) if (now.isBefore(d[0])) $scope.is_opened = now.isBefore(d[1]); else $scope.is_opened = true; else $scope.is_opened = now.isBefore(d[1]) && (d[0].isBefore(now) || d[0].isSame(now));
            } else $scope.is_opened = null;
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
            services = [$injector.get('$timeout'), $injector.get('reviewService')];
            $scope.doFavouriteAction = function () {
                if (loading) return;
                loading = true;
                if ($scope.fav_state == 0) {
                    likeService.save({content_type: 'business', object_id: $scope.$parent.id},
                        function () {
                            $scope.fav_state = 1;
                            $scope.fav_count++;
                            services[0](function() { loading = false });
                        });
                } else {
                    likeService.delete({content_type: 'business', id: $scope.$parent.id},
                        function (){
                            $scope.fav_state = 0;
                            $scope.fav_count--;
                            services[0](function() { loading = false });
                        });
                }
            };
            $scope.show_favs_or_redirect = function () {
                if (OWNER_MANAGER === null) location.href = '/';
                $scope.showFavouritesModal();
            };

            $scope.submitReview = function () {
                var el = angular.element('[name="forms.review"] [name="text"]'), cond;
                cond = el.val().length < $scope.minchar ? 1 : 0;
                if ($scope.forms.review_stars == 0) cond += 2;
                if (cond > 0) {
                    $scope.forms.review.alert = cond;
                    if (cond == 1 || cond == 3) el.focus();
                    return;
                } else $scope.forms.review.alert = 0;
                $scope.loading = true;
                function l(){ $timeout(function(){ delete $scope.loading }) }
                services[1].new(el.val(), $scope.forms.review_stars, $scope.$parent.id).then(function () {
                    $scope.showrevf = false;
                    $scope.rating.user = services[1].getobjs(false, false)[0].stars;
                    l();
                }, l);
            };
            return;
        }

        // Manager
        $scope.edit = [];
        $scope.data = $injector.get('EDIT_DATA');
        services = [$injector.get('dialogService'), $injector.get('$uibModal'), $injector.get('BASE_MODAL')];

        //$rootScope.$watch('currTime', function (val){ if (val !== undefined) });
        var s = APIService.init(9);
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
                    if (checkField($scope.data, 1)) d.phone = $scope.data.form[1];
                    for (var i = 0; i < $scope.data.form[2].length; i++) if ($scope.data.form[2][i] == $scope.data.curr) {
                        $scope.data.form[2].splice(i, 1);
                        break;
                    }
                    if (checkField($scope.data, 2)) d.supported_curr = $scope.data.form[2];
                    if (checkField($scope.data, 3) || checkField($scope.data, 4)) {
                        d.address = $scope.data.form[3];
                        d.location = $scope.data.form[4];
                    }
                    function f(v){ return moment(v).format('HH:mm') }
                    for (i = 0; i < 3; i++) {
                        if (i > 0 && !$scope.work[i-1]) break;
                        if ($scope.data.form[0][2*i].getTime() == $scope.data.form[0][2*i+1].getTime() && f($scope.data.form[0][2*i]) != '00:00') {
                            $scope.data.form[0][2*i] = new Date(0, 0, 0, 0, 0);
                            $scope.data.form[0][2*i+1] = new Date(0, 0, 0, 0, 0);
                        }
                    }
                    var a = [0], p = ['phone', 'supported_curr', 'address', 'location', 'opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun'], r;
                    for (i = 0; i < 6; i++) if (i < 2 || $scope.work[i < 4 ? 0 : 1]) {
                        a[1] = i;
                        r = checkField($scope.data, a, false, f);
                        if (r) d[p[i+4]] = r;
                    } else if ($scope.data.value[0].length > i) d[p[i+4]] = null;
                    if (Object.keys(d).length == 0) {
                        $scope.close();
                        return;
                    }
                    disablef(true);
                    s.partial_update(d, function (result) {
                        $scope.data.error = false;
                        a = Object.keys(d);
                        for (i = 0; i < a.length; i++) {
                            r = p.indexOf(a[i]);
                            if (r >= 4) {
                                if (r >= 6 && !$scope.work[r < 8 ? 0 : 1]) {
                                    $scope.data.value[0].splice(r-4);
                                    break;
                                }
                                $scope.data.value[0][r-4] = d[a[i]];
                            } else $scope.data.value[r+1] = $scope.data.form[r+1];
                        }
                        if (d.address !== undefined || d.location !== undefined || r >= 4) {
                            $scope.data.tz = result.tz;
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
