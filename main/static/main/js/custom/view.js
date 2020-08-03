app
    .filter('revc', function() { return function(input) { return input.split(',')[1]+','+input.split(',')[0] } })

    .factory('menuService', function ($q, $injector, APIService){
        var itemService = APIService.init(8), menu, defer = $q.defer(), props = {loaded: false, total_price: 0, ordered_items: [], note: ''}, localStorageService = OWNER_MANAGER === null && $injector.get('localStorageService'); //, category

        function chngmenu() { if (!menu[0].hascontent) menu[1].name = gettext("Drinks"); else menu[1].name = gettext("Other drinks") } //menu[0].name == "Other drinks" / if (menu.length)
        function add(item, n) {
            var c = false, f;
            for (var i = 0; i < menu.length; i++) {
                if (c === false) for (var j = 0; j < menu[i].content.length; j++) {
                    if (menu[i].content[j].category == item.category) {
                        if (!n && localStorageService) {
                            if (!item.unavailable) {
                                item.quantity = localStorageService.get(item.id);
                                if (item.quantity) {
                                    props.total_price += item.price * item.quantity;
                                    menu[i].content[j].has_q = menu[i].content[j].has_q ? menu[i].content[j].has_q + 1 : 1;
                                    props.ordered_items.push(item);
                                }
                            }
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
                        {category: 'energy_drink', name: gettext("Energy drinks"), content: []},
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
            },
            order: function () {
                var items = [];
                for (var i = 0; i < props.ordered_items.length; i++) items.push({item: props.ordered_items[i].id, quantity: props.ordered_items[i].quantity})
                return APIService.init(13).save({note: props.note, ordered_items: items}, this.reset_order).$promise;
            },
            remove_ordered_item: function (id){
                // localStorageService.remove(id);
                for (var i = 0; i < props.ordered_items.length; i++) if (id == props.ordered_items[i].id) {
                    props.total_price -= props.ordered_items[i].price * props.ordered_items[i].quantity;
                    props.ordered_items.splice(i, 1)[0].quantity = 0
                    break;
                }
            },
            reset_order: function(){
                while (props.ordered_items.length > 0) props.ordered_items.pop().quantity = 0;
                props.total_price = 0;
                localStorageService.clearAll();
            }
        }
    })

    .controller('BusinessCtrl', function($rootScope, $scope, $controller, $state, $timeout, USER, APIService, menuService, itemService, dialogService) {
        $scope.forms = {review_stars: 0};
        $scope.objloaded = [false, false, false];
        angular.extend(this, $controller('BaseViewCtrl', {$scope: $scope,
            tabs: [{name: 'events', func: function(){ $scope.objloaded[0] = true }},
                {name: 'menu', func: function () {
                    if ($scope.menu === undefined) {
                        $scope.menu = menuService.init();
                        $scope.menu_props = menuService.props;
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

                        if (OWNER_MANAGER !== null) return;
                        $scope.submitOrder = function () {
                            $scope.o_disabled = null;
                            dialogService.show(gettext("Are you sure that you want to place an order? This action cannot be undone.")).then(function () {
                                $scope.opened = false;
                                $scope.o_disabled = true;
                                menuService.order().then(function () {
                                    dialogService.show(gettext("Your order has been placed. Enjoy!"), false);
                                    $scope.resetTime();
                                }, function (res) {
                                    delete $scope.o_disabled;
                                    if (res.data && res.data.ordered_items && res.data.ordered_items.length) {
                                        var removed;
                                        for (var i = 0; i < res.data.ordered_items.length; i++) if (res.data.ordered_items[i].non_field_errors && res.data.ordered_items[i].non_field_errors[0].indexOf('unavailable') > -1) {
                                            menuService.remove_ordered_item(res.data.ordered_items[i].non_field_errors[0].substring(5, res.data.ordered_items[i].non_field_errors[0].indexOf(' ', 5)));
                                            removed = true;
                                        }
                                        if (removed) {
                                            dialogService.show(gettext("Some of items have become unavailable in the meantime. They have been removed from orders, so please recheck before submitting again."), false);
                                            return;
                                        }
                                    }
                                    dialogService.show(res.data && res.data.non_field_errors ? gettext("Can't place an order due to the following:") + ' ' + gettext(res.data.non_field_errors[0]) : gettext("There was some error while placing your order."), false);
                                });
                            }, function (){ if (!$scope.o_disabled) delete $scope.o_disabled });
                        };
                        $scope.resetOrder = menuService.reset_order;
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
                var now = moment().tz($scope.data.tz), day = now.isoWeekday(), d;
                if (day == 6 && workh.length >= 4) d = workh[2]; else if (day == 7 && workh.length == 6) d = workh[4]; else if (day < 6) d = workh[0];
                if (d === undefined) {
                    $scope.is_opened = false;
                    return;
                }
                d = [moment.tz(d, 'HH:mm', $scope.data.tz), moment.tz(day == 6 && workh.length >= 4 ? workh[3] : day == 7 && workh.length == 6 ? workh[5] : workh[1], 'HH:mm', $scope.data.tz)];
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
        if (!OWNER_MANAGER) $scope.data = {value: [], tz: undefined};
        if (!OWNER_MANAGER && !USER.anonymous) {
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
        }

        if (OWNER_MANAGER === null) {
            var time;
            $scope.showRedirectToHomeMsg = function () {
                dialogService.show(gettext("You must be logged in to do this action. Click Yes to go to the home page.")).then(function () { location.href = '/' });
            };
            $scope.resetTime = function (){ time = (new Date()).getTime() };
            $scope.startTime = function (t){
                time = t;
                var i;
                (function f(){
                    var curr = (new Date()).getTime();
                    if (time > curr) {
                        var rem = new Date(time - curr), mins = '' + rem.getMinutes(), secs = '' + rem.getSeconds();
                        $scope.remaining = '00'.substring(0, 2 - mins.length) + mins + ':' + '00'.substring(0, 2 - secs.length) + secs;
                    }
                    if (time <= curr || mins == 0 && secs == 0) {
                        if (secs != 0) $scope.remaining = '00:00';
                        if ($scope.o_disabled === null) {
                            dialogService.close();
                        }
                        if (!$scope.o_disabled && time > 0) dialogService.show(gettext("Order time has expired. You must issue a new link."), false);
                        $scope.o_disabled = true;
                        if (i) $injector.get('$interval').cancel(i);
                    } else if (!i) i = $injector.get('$interval')(f, 1000);
                })();
            };
        }

        // Manager
        if (OWNER_MANAGER) angular.extend(this, $controller('ManagerCtrl', {$scope: $scope}));
    });
