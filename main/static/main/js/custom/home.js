var app = angular.module('mainApp', ['ui.bootstrap', 'nya.bootstrap.select', 'ngResource', 'ngAside', 'yaru22.angular-timeago', 'ngFitText', 'ngAnimate', 'ui.router', 'ui.router.modal', 'ui.bootstrap.datetimepicker', 'datetime']) /*, 'mgcrea.bootstrap.affix', 'angularCSS', 'oc.lazyLoad'*/
    .config(function($httpProvider, $animateProvider, $stateProvider, timeAgoSettings, BASE_MODAL, CONTENT_TYPES) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $animateProvider.classNameFilter(/(angular-animate|tab-pane)/);
        timeAgoSettings.allowFuture = true;

        var t = '';
        for (var k in CONTENT_TYPES) t += '|'+k;
        $stateProvider
            .state('main', { url: '/' })
            .state('main.showObjs', {
                url: 'show=:ids&type={type:(?:'+t.substr(1)+')}{nobusiness:(?:&nobusiness)?}',
                modal: true,
                templateUrl: BASE_MODAL,
                size: 'lg',
                controller: function ($scope, $uibModalInstance, $state, $stateParams, $timeout, $injector, CONTENT_TYPES) {
                    if ($stateParams.type !== undefined) if (CONTENT_TYPES[$stateParams.type] !== undefined) $scope.t = $stateParams.type; else $scope.t = 'event'; //,item,review
                    $scope.loading = true;
                    $scope.nobusiness = $stateParams.nobusiness == '&nobusiness';
                    var objService = $injector.get($scope.t+'Service');
                    switch ($scope.t) {
                        case 'item':
                            $scope.title = "Item(s)";
                            break;/*
                        case 'review':
                            $scope.title = "Review(s)";
                            break;*/
                        default: $scope.title = "Event(s)";
                    }
                    $scope.file = 'events';

                    $scope.close = function() { $uibModalInstance.dismiss('cancel') };
                    $scope.set_modal_loaded = function (){
                        var unregister = $scope.$watch(function() { return angular.element('.loaded').length }, function(value) {
                            if (value > 0) {
                                unregister();
                                $scope.modal_loaded = true;
                            }
                        });
                    };
                    $scope.set_loaded = function (){ $scope.loaded = true };

                    $scope.objs = objService.getobjs(true);
                    objService.load($stateParams.ids.split(',')).then(function () { $timeout(function () {
                        $scope.loading = false;
                        if ($scope.objs.length == 0) $scope.set_loaded();
                    }) }); //$scope.enableAnimation(); }
                }
            });
    })

    .filter('unsafe', function($sce) { return $sce.trustAsHtml })

    .run(function($rootScope, $http) {
        $rootScope.sendreq = function(url, data) {
            return $http({
                method: data !== undefined ? 'POST' : 'GET',
                url: '/'+url,
                data: data,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            })/*.then(function(response) { return response.data })*/;
        };
    })

    .factory('dialogService', function($uibModal) {
        return {
            show: function (message, OkCancel) {
                return $uibModal.open({
                    windowTopClass: 'modal-confirm',
                    template: '<div class="modal-body">' + message + '</div><div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">'+(OkCancel === undefined ? 'Yes' : 'OK')+'</button>'+((OkCancel || OkCancel === undefined) ? '<button class="btn btn-warning" ng-click="cancel()">'+(OkCancel === undefined ? 'No' : 'Cancel')+'</button></div>':''),
                    controller: function($scope, $uibModalInstance) {
                        $scope.ok = function() { $uibModalInstance.close() };
                        $scope.cancel = function() { $uibModalInstance.dismiss('cancel') };
                    }
                }).result;
            }
        }
    })

    .directive('ngDialogClick', function(dialogService) {
        return {
            restrict: 'A',
            scope: {
                ngDialogMessage: '@',
                ngDialogOkcancel: '=',
                ngDialogOkonly: '=',
                ngDialogClick: '&'
            },
            link: function(scope, element, attrs) {
                element.bind('click', function() {
                    dialogService.show(attrs.ngDialogMessage || "Are you sure?", (attrs.ngDialogOkcancel && attrs.ngDialogOkonly) ? false : attrs.ngDialogOkcancel || (attrs.ngDialogOkonly ? false : undefined)).then(function() { scope.ngDialogClick() }/*, function() {}*/);
                });
            }
        }
    })

    .directive('dynamicController', function($controller) {
        return {
            restrict: 'A',
            scope: true,
            link: function (scope, element, attrs) {
                element.data('$Controller', $controller(scope.$eval(attrs.dynamicController), {$scope: scope}));
            }
        };
    })

    .directive('suchHref', function ($location) {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                element.attr('class', 'clickable');
                element.on('click', function() {
                    $location.url(attr.suchHref);
                    scope.$apply();
                });
            }
        }
    })

    .directive('starRating', function() {
        return {
            restrict: 'A',
            template:
                '<span class="star-rating" ng-if="readonly">' +
                '    <i ng-repeat="a in range() track by $index" class="fa" ng-class="(ratingValue >= $index + 1) ? \'fa-star\' : floor(ratingValue) == $index && ratingValue % 1 >= 0.5 ? \'fa-star-half-o\' : \'fa-star-o\'"></i' +
                '></span>' +
                '<span class="star-rating" ng-if="!readonly">' +
                '    <a href="javascript:" ng-repeat="a in range() track by $index" ng-click="toggle($index)" ng-mouseover="hoverIn($index)" ng-mouseleave="hoverOut()"><i class="fa" ng-class="(hover > 0 && hover >= $index + 1 ? \'fa-star\' : hover == 0 ? ratingValue >= $index + 1 ? \'fa-star\' : ratingValue == $index + 0.5 ? \'fa-star-half-o\' : \'fa-star-o\' : \'fa-star-o\')+(userRating >= $index + 1 ? \' text-warning\' : \'\')"></i></a' +
                '></span><span ng-if="userNumber > 0 && (onClickStats !== undefined || showStats)">|<a href="javascript:" ng-if="onClickStats !== undefined" ng-click="show()" class="ml3">{{ ratingValue | number:1 }} ({{ userNumber }})</a><span ng-if="showStats && onClickStats === undefined" class="ml3">{{ ratingValue | number:1 }} ({{ userNumber }})</span></span>',
            scope: {
                ratingValue: '=',
                userNumber: '=',
                userRating: '=',
                max: '=?', //optional: default is 5
                onChange: '@?', //must return a promise
                showStats: '=?',
                onClickStats: '@?',
                funcParams: '=?'
            },
            link: function(scope, elem, attrs) {
                scope.floor = Math.floor;
                scope.range = function() {
                    if (attrs.max === undefined) attrs.max = 5;
                    return new Array(attrs.max);
                };
                scope.readonly = scope.userRating === undefined || scope.userRating == -1;
                if (!scope.readonly) {
                    scope.hover = 0;
                    scope.hoverIn = function (i) { scope.hover = i + 1 };
                    scope.hoverOut = function () { scope.hover = 0 };
                }
                if (scope.funcParams !== undefined) {
                    var p = '';
                    for (var k in scope.funcParams) p += ',' + k;
                    p = p.substr(1);
                } else scope.funcParams = {};
                var loading;
                scope.toggle = function (i) {
                    if (loading) return;
                    loading = true;
                    if (scope.userRating == i + 1) i = 0; else i++;
                    scope.$parent.$eval(scope.onChange+'('+p+', value)', angular.extend({}, scope.funcParams, {value: i})).then(function (){ loading = false });
                };
                scope.show = function () { scope.$parent.$eval(scope.onClickStats+'('+p+')', scope.funcParams) };
			}
		};
	})

    .factory('usersModalService', function($uibModal, BASE_MODAL) {
        var params = {};

        return {
            params: params,
            setAndOpen: function(id, type, event) {
                params.id = id;
                params.type = type;
                var n;
                if (typeof(type) == 'string') n = 'likes'; else n = 'friends';
                $uibModal.open({
                    size: 'lg',
                    templateUrl: BASE_MODAL,
                    controller: 'UsersModalCtrl',
                    resolve: {
                        file: function () { return n },
                        event: function () { return event }
                    }
                });
            }
        }
    })

    .controller('UsersModalCtrl', function ($rootScope, $scope, $timeout, $resource, $window, $uibModalInstance, orderByFilter, file, event, usersModalService, APIService, CONTENT_TYPES, HAS_STARS) {
        $scope.close = function() { $uibModalInstance.dismiss('cancel') };
        $scope.set_modal_loaded = function (){
            var unregister = $scope.$watch(function() { return angular.element('.loaded').length }, function(value) {
                if (value > 0) {
                    unregister();
                    $scope.modal_loaded = true;
                }
            });
        };
        $scope.file = file;
        $scope.event = event;
        if ($scope.event !== undefined) $scope.sel_cnt = 0;

        var d = {id: usersModalService.params.id}, t = usersModalService.params.type, o, st = typeof(t) == 'string', i;
        if (st) var stars = HAS_STARS[t] !== undefined;
        switch (t){
            case 0:
                $scope.title = d.id == null ? ($scope.event !== undefined ? "Select friend(s)" : "Your friends") : "Friends";
                o = APIService.init();
                break;
            case 1:
            case 2:
                if (d.id == null || t == 2) {
                    if (d.id != null) {
                        $scope.title = "Favourites";
                        d.user = 1;
                    } else $scope.title = "Your favourites";
                    $scope.favs = true;
                } else $scope.title = "Favoured by";
                o = APIService.init(1);
                break;
            default:
                o = APIService.init(3);
                d.content_type = CONTENT_TYPES[t];
                if (stars) {
                    $scope.title = "Ratings";
                    var star = ' <i class="fa fa-star"></i>';
                } else $scope.title = "Reactions";
                $scope.tabs = [];
                var c = 0, l = 0;
        }
        $scope.elems = [];
        $scope.next_page = [];
        $scope.load_page = function (i) {
            var t = angular.extend({}, d);
            if (i === undefined) i = 0;
            if ($scope.loaded !== null) {
                if (st) if (stars) t.stars = $scope.tabs[i].value; else t.is_dislike = $scope.tabs[i].value == 0;
                $scope.loaded = false;
                t.page = $scope.next_page[i];
            } else if (st) if (stars) t.stars = i + 1; else t.is_dislike = i == 0; else $scope.loaded = undefined;
            o.get(t,
                function (result){
                    if (st && $scope.loaded === null) l++;
                    if (result.results.length > 0) {
                        if (st) {
                            if ($scope.loaded === null) {
                                var old = i;
                                i = c;
                                c++;
                                if (stars) {
                                    $scope.tabs[i] = {value: old + 1, heading: ''};
                                    for (var j = 0; j <= old; j++) $scope.tabs[i].heading += star;
                                    $scope.tabs[i].heading = $scope.tabs[i].heading.substr(1);
                                } else $scope.tabs[i] = {value: i, heading: old == 1 ? "Liked by" : "Disliked by"};
                            }
                        }
                        if ($scope.elems[i] === undefined) $scope.elems[i] = [];
                        $scope.elems[i].push.apply($scope.elems[i], result.results);
                    }
                    var pg;
                    if ($scope.next_page[i] === undefined) pg = 1; else pg = $scope.next_page[i]+1;
                    if (result.page_count == pg) { if ($scope.next_page[i] !== undefined) delete $scope.next_page[i]; } else $scope.next_page[i] = pg;
                    if ($scope.loaded === undefined || l == (stars ? 5 : 2)) $timeout(function() {
                        if (st) $scope.tabs = orderByFilter($scope.tabs, '-value');
                        $scope.loaded = true;
                    });
                })
        };
        $scope.loaded = null;
        if (st) {
            if (!stars) {
                $scope.load_page(0);
                $scope.load_page(1);
            } else for (i = 0; i < 5; i++) $scope.load_page(i);
        } else $scope.load_page();

        $scope.makeSel = function (i) {
            //if ($scope.event !== undefined) {
            if ($scope.event === undefined || $scope.working) return;
            $scope.elems[0][i].selected = $scope.elems[0][i].selected !== undefined ? !$scope.elems[0][i].selected : true;
            if ($scope.elems[0][i].selected) $scope.sel_cnt++; else $scope.sel_cnt--;
            //} else $window.location.href = '/'+($scope.favs ? $scope.elems[0][i].shortname : 'user/'+$scope.elems[0][i].username)+'/'
        };

        $scope.sendNotify = function (){
            $scope.working = true;
            var to = '';
            for (i = 0; i < $scope.elems[0].length; i++) if ($scope.elems[0][i].selected) to += ',' + $scope.elems[0][i].id;
            $rootScope.sendreq('api/events/'+$scope.event+'/notify/?notxt=1&to='+to.substr(1)).then(function (){ $scope.close() }, function () { $scope.working = false });
        }
    })

    .factory('APIService', function($resource) {
        return {
            init: function (t){
                var n;
                switch (t){
                    case 1:
                        n = 'favourites';
                        break;
                    case 2:
                        n = 'events';
                        break;
                    case 3:
                        n = 'likes';
                        break;
                    case 4:
                        n = 'notifications';
                        break;
                    case 5:
                        n = 'email';
                        break;
                    case 6:
                        n = 'reminders';
                        break;
                    case 7:
                        n = 'comments';
                        break;
                    case 8:
                        n = 'items';
                        break;
                    default: n = 'friends'
                }
                return $resource('/api/'+n+'/:id/?format=json', {id: '@object_id'},
                {
                    'get': {method: 'GET'},
                    'query': {method: 'GET', isArray: true},
                    'save': {method: 'POST'},
                    'update': {method: 'PUT'},
                    'delete': {method: 'DELETE'}
                });
            }
        }
    })

    .factory('menuService', function ($q, APIService){
        var itemService = APIService.init(8), menu;

        function chngmenu() { if (menu[0].category == "Other drinks") menu[0].category = "Drinks"; /*if (menu.length)*/ }

        return {
            init: function (){
                menu = [
                    {category: "Alcoholic beverages", content: [
                        {category: "Ciders", content: []},
                        {category: "Whiskeys", content: []},
                        {category: "Wines", content: []},
                        {category: "Beers", content: []},
                        {category: "Vodkas", content: []},
                        {category: "Brandy", content: []},
                        {category: "Liqueurs", content: []},
                        {category: "Cocktails", content: []},
                        {category: "Tequilas", content: []},
                        {category: "Gin", content: []},
                        {category: "Rum", content: []}
                    ]},
                    {category: "Other drinks", content: [
                        {category: "Coffee", content: []},
                        {category: "Soft drinks", content: []},
                        {category: "Juices", content: []},
                        {category: "Teas", content: []},
                        {category: "Hot chocolate", content: []},
                        {category: "Water", content: []}
                    ]},
                    {category: "Food", content: [
                        {category: "Fast food", content: []},
                        {category: "Appetizers", content: []},
                        {category: "Soups", content: []},
                        {category: "Meals", content: []},
                        {category: "Barbecue", content: []},
                        {category: "Seafood", content: []},
                        {category: "Salads", content: []},
                        {category: "Desserts", content: []}
                    ]}
                ];
                return menu;
            },
            load: function (id){
                var category = {
                    'cider': menu[0].content[0].content,
                    'whiskey': menu[0].content[1].content,
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
                };
                return itemService.query({id: id, menu: 1},
                    function (result){
                        var i, c = result[0].category;
                        for (i = 0; i < result.length; i++){
                            if (c != result[i].category) c = result[i].category;
                            delete result[i].category;
                            category[c].push(result[i]);
                        }
                        for (i = 0; i < menu.length; i++) {
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
                        }
                        chngmenu();
                    }
                ).$promise;
            },
            del: function (id){
                if (menu === undefined) return;
                var d = false;
                for (var i = 0; i < menu.length; i++) {
                    for (var j = 0; j < menu[i].content.length; j++) {
                        for (var k = 0; k < menu[i].content[j].content.length; k++) {
                            if (menu[i].content[j].content[k].id == id) {
                                menu[i].content[j].content.splice(k, 1);
                                d = true;
                                break;
                            }
                        }
                        if (d && !menu[i].content[j].content.length) {
                            menu[i].content.splice(j, 1);
                            break;
                        }
                    }
                    if (d && !menu[i].content.length) {
                        menu.splice(i, 1);
                        break;
                    }
                }
                chngmenu();
            }
        }
    })

    .factory('uniService', function ($q, orderByFilter, APIService, COMMENT_PAGE_SIZE, CONTENT_TYPES, menuService, dialogService){
        var u = false, id = null, likeService = APIService.init(3), commentService = APIService.init(7);

        function UniObj(t){
            this.objs = [[],[], t];
            switch (t){
                case 'event':
                    this.s = APIService.init(2);
                    break;
                case 'item':
                    this.s = APIService.init(8);/*
                    break;
                case 'review':
                    this.s = APIService.init(9);*/
            }
            this.page_num = 1;
            this.remids = [];
        }

        UniObj.prototype.remove = function (e, index, r) {
            if (r) for (var i = 0; i < this.objs[0].length; i++) if (this.objs[0][i].id == e[index].id) {
                this.objs[0].splice(i, 1);
                break;
            }
            if (!r || !u) e.splice(index, 1); else this.remids.push(e[index].id);
        };

        UniObj.prototype.getobjs = function (t, n) {
            if (t === undefined) return this.objs[2];
            var e;
            e = t ? this.objs[1] : this.objs[0];
            if (n === undefined) e.length = 0;
            return e;
        };

        UniObj.prototype.load = function (b, rel_state) {
            var ids = null, d;
            if (b !== undefined) if (angular.isArray(b)) {
                var p;
                ids = '';
                for (var i = 0; i < b.length && b[i] !== undefined; i++) {
                    p = false;
                    for (var j = i + 1; j < b.length; j++) if (b[j] == b[i]) {
                        delete b[i];
                        p = true;
                    }
                    if (!p && /^\d+$/.test(b[i])) {
                        for (d in this.objs[0]) if (this.objs[0][d].id == b[i]) {
                            var ev = angular.copy(this.objs[0][d]);
                            delete ev.comments;
                            delete ev.user_comments;
                            this.objs[1].push(ev);
                            p = true;
                            break;
                        }
                        if (!p) ids += ',' + b[i];
                    }
                }
                ids = ids.substr(1);
            } else id = b;
            if (ids == '') return $q.when(); else if (ids == null) {
                d = {page: this.page_num, id: id};
                if (rel_state !== undefined) {
                    u = rel_state == -1;
                    d.user = 1;
                }
                var self = this;
                return this.s.get(d,
                    function (result) {
                        self.objs[0].push.apply(self.objs[0], result.results);
                        self.objs[0].has_next_page = result.page_count > self.page_num;
                        self.page_num++;
                    }).$promise
            } else {
                d = this.objs[1];
                return this.s.query({ids: ids},
                    function (result) {
                        d.push.apply(d, result);
                    }).$promise
            }
        };

        UniObj.prototype.new = function(txt, when) {
            var objs = this.objs[0];
            return this.s.save({text: txt, when: when}, function (result){ objs.unshift(result) }).$promise
        };

        UniObj.prototype.del = function (index, r, par_ind, p) {
            var e;
            e = r ? this.objs[1] : this.objs[0];
            if (par_ind !== undefined) {
                p = p ? e[par_ind].comments : e[par_ind].user_comments;
                return commentService.delete({id: p[index].id}, function () {
                    p.splice(index, 1);
                    e[par_ind].comment_count--;
                }).$promise;
            } else {
                var self = this;
                return this.s.delete({id: e[index].id}, function (){
                    self.remove(e, index, r);
                    if (self.objs[2] == 'item') menuService.del(e[index].id);
                }, function (result){
                    if (self.objs[2] == 'item' && result.non_field_errors !== undefined) dialogService.show("You can't delete the last remaining item!", false)
                }).$promise;
            }
        };

        UniObj.prototype.setLikeStatus = function (index, r, dislike_stars) {
            var e;
            e = r ? this.objs[1] : this.objs[0];
            var old_status = e[index].curruser_status, status, s;
            var isl = typeof(dislike_stars) == 'boolean', cond = isl ? old_status == 1 && !dislike_stars || old_status == 2 && dislike_stars : dislike_stars == 0;
            if (cond) {
                s = likeService.delete({content_type: CONTENT_TYPES[this.objs[2]], id: e[index].id});
                if (u) this.remove(e, index, r);
                status = 0;
            } else {
                var d = {content_type: CONTENT_TYPES[this.objs[2]], object_id: e[index].id};
                if (isl) d.is_dislike = dislike_stars; else d.stars = dislike_stars;
                if (old_status > 0) s = likeService.update(d); else s = likeService.save(d);
                status = isl ? dislike_stars ? 2 : 1 : dislike_stars;
            }
            var self = this;
            return s.$promise.then(
                function () {
                    if (status != 0) {
                        if (isl) {
                            if (status == 1) {
                                e[index].likestars_count++;
                                if (old_status == 2) e[index].dislike_count--;
                            } else {
                                e[index].dislike_count++;
                                if (old_status == 1) e[index].likestars_count--;
                            }
                        } else if (old_status == 0) e[index].likestars_count++;
                        if (!r && u) e[index].person_status = status;
                    } else if (isl) { if (r || !u) { if (old_status == 1) e[index].likestars_count--; else if (old_status == 2) e[index].dislike_count--; }
                    } else if (old_status != 0) e[index].likestars_count--;
                    e[index].curruser_status = status;
                    var i;
                    if (!isl) {
                        e[index].stars_avg = e[index].stars_avg != 0 && e[index].likestars_count != 0 ? (((status != 0 && old_status == 0) ? (e[index].likestars_count - 1) : (status == 0 && old_status != 0) ? (e[index].likestars_count + 1) : e[index].likestars_count) * e[index].stars_avg - old_status + status) / e[index].likestars_count : status;
                        cond = [e[index].comments, e[index].user_comments];
                        for (isl in cond) if (cond[isl] !== undefined) for (i = 0; i < cond[isl].length; i++) if (cond[isl][i].is_curruser) cond[isl][i].manager_stars = status;
                    }
                    if (r && u && old_status == 0) for (i = 0; i < self.remids.length; i++) if (self.remids[i] == e[index].id) {
                        self.remids.splice(i, 1);
                        self.objs[0].push(e[index]);
                        self.objs[0] = orderByFilter(self.objs[0], self.objs[0].when !== undefined ? ['-when', '-id'] : '-id');
                    }
                });
        };

        UniObj.prototype.loadComments = function (index, pg, r){
            var e;
            e = (r ? this.objs[1] : this.objs[0])[index];
            return commentService.get({content_type: CONTENT_TYPES[this.objs[2]], id: e.id, page: pg},
                function (result){
                    if (!e.comments !== undefined) e.comments = [];
                    result.results.splice(0, e.comments.length % COMMENT_PAGE_SIZE);
                    e.comments.push.apply(e.comments, result.results);
                    if (e.user_comments !== undefined) for (var i = 0; i < result.results.length; i++) for (var j = 0; j < e.user_comments.length; j++) if (result.results[i].id == e.user_comments[j].id) e.user_comments.splice(j, 1);
                    e.comment_count = result.comment_count;
                }).$promise;
        };

        UniObj.prototype.submitComment = function (index, txt, r){
            var e;
            e = (r ? this.objs[1] : this.objs[0])[index];
            return commentService.save({content_type: CONTENT_TYPES[this.objs[2]], object_id: e.id, text: txt},
                function (result){
                    if (!e.user_comments !== undefined) e.user_comments = [];
                    e.user_comments.push(result);
                    e.comment_count++;
                }).$promise;
        };

        return { getInstance: function (t) { return new UniObj(t) } }
    })
    .factory('eventService', function (uniService) { return uniService.getInstance('event') })
    .factory('itemService', function (uniService) { return uniService.getInstance('item') })

    .controller('BaseCtrl', function ($rootScope, $scope, $timeout, objService, usersModalService, COMMENT_PAGE_SIZE) {
        $scope.r = $scope.$parent.objs !== undefined;
        $scope.objs = $scope.r ? $scope.$parent.objs : objService.getobjs(false);
        if (!$scope.r) {
            $scope.loading = true;
            var l = function() { $scope.loading = false };
            objService.load($scope.id, $scope.rel_state).then(l /*function () { $timeout(function () { if ($scope.objs.length == 0) $scope.enableAnimation() }) }*/);
            $scope.load_page = function (){
                $scope.loading = true;
                objService.load().then(l, l);
            };
        }

        $scope.delete = function (index, par_ind, p){ objService.del(index, $scope.r, par_ind, p) };

        $scope.showDisLikes = function (index) { usersModalService.setAndOpen(objService.getobjs($scope.r, true)[index].id, objService.getobjs()) };

        $scope.toggleHr = function (f, l) { if (f) if (l) if (!angular.element('.objs'+$scope.r+'_'+$scope.$parent.t+' .ng-leave').length) return angular.element('.objs'+$scope.r+'_'+$scope.$parent.t+' .ng-leave-prepare').length; else return true; else return true; else return false };

        var loading;
        $scope.giveDisLike = function(index, dislike) {
            if (loading) return;
            loading = true;
            function l(){ $timeout(function () { loading = false }) }
            return objService.setLikeStatus(index, $scope.r, dislike).then(l, l);
        };

        function load_comments(index){
            function l() { $timeout(function (){ $scope.showcomm[index][0] = true }) }
            objService.loadComments(index, $scope.objs[index].comments !== undefined ? Math.floor($scope.objs[index].comments.length / COMMENT_PAGE_SIZE) + 1 : 1, $scope.r).then(l, l);
        }

        $scope.showcomm = [];
        $scope.showComments = function(index) {
            if ($scope.showcomm[index] === undefined) {
                $scope.showcomm[index] = [false, true];
                load_comments(index);
            } else $scope.showcomm[index][1] = !$scope.showcomm[index][1];
        };

        $scope.show_next = function (index){
            if (!$scope.objs[index].comments !== undefined) return false;
            if ($scope.showcomm[index][0]) {
                if ($scope.objs[index].user_comments !== undefined && $scope.objs[index].comment_count == $scope.objs[index].comments.length + $scope.objs[index].user_comments.length) return false;
                return $scope.objs[index].comment_count > $scope.objs[index].comments.length;
            } else return false;
        };

        $scope.load_next = function (index){
            $scope.showcomm[index][0] = false;
            load_comments(index);
        };

        $scope.submitComment = function (index) {
            var el = angular.element('#'+$scope.$parent.t+index);
            if (el.val() != '') objService.submitComment(index, el.val(), $scope.r).then(function () { el.val('') })
        }
    })

    .controller('eventsCtrl', function($scope, $rootScope, $controller, $timeout, usersModalService, eventService, APIService) {
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: eventService}));

        $scope.notifySelect = function (index){ usersModalService.setAndOpen(null, 0, eventService.getobjs($scope.r, true)[index].id) };

        $scope.isFuture = function (index) { return (new Date(eventService.getobjs($scope.r, true)[index].when)).valueOf() > $rootScope.currTime };

        function subTime(d,h,m,v){
            var r = new Date(d);
            r.setHours(d.getHours()-h);
            r.setMinutes(d.getMinutes()-m);
            r.setSeconds(0, 0);
            return v ? r.valueOf() : r;
        }
        var when, index;
        $scope.cmb = {choices: ["(Custom)"]};
        $scope.picker = {options: {minDate: subTime($rootScope.currTime, 0, -1)}};
        $scope.initRmn = function (ind){
            if (index !== undefined && $scope.objs[ind].id == $scope.objs[index].id) return;
            index = ind;
            when = new Date($scope.objs[index].when);
            $scope.picker.options.maxDate = when;
            $scope.cmb.choices.length = 1;
            var md = $scope.picker.options.minDate.valueOf();
            if (subTime(when, 0, 15, true) > md) $scope.cmb.choices.push("15 minutes");
            if (subTime(when, 0, 30, true) > md) $scope.cmb.choices.push("Half an hour");
            for (var i = 2; i >= 0; i--) if ($scope.cmb.choices.length >= i+1) {
                if ($scope.cmb.selected != $scope.cmb.choices[i]) $scope.cmb.selected = $scope.cmb.choices[i]; else checkSel();
                break;
            }
            if (subTime(when, 0, 45, true) > md) $scope.cmb.choices.push("45 minutes");
            if (subTime(when, 1, 0, true) > md) $scope.cmb.choices.push("An hour");
            if (subTime(when, 2, 0, true) > md) $scope.cmb.choices.push("2 hours");
            if (subTime(when, 3, 0, true) > md) $scope.cmb.choices.push("3 hours");
            if (subTime(when, 4, 0, true) > md) $scope.cmb.choices.push("4 hours");
            if (subTime(when, 5, 0, true) > md) $scope.cmb.choices.push("5 hours");
            if (subTime(when, 6, 0, true) > md) $scope.cmb.choices.push("Half a day");
            if (subTime(when, 24, 0, true) > md) $scope.cmb.choices.push("A day");
            if (subTime(when, 48, 0, true) > md) $scope.cmb.choices.push("2 days");
            if (subTime(when, 72, 0, true) > md) $scope.cmb.choices.push("3 days");
            if (subTime(when, 96, 0, true) > md) $scope.cmb.choices.push("4 days");
            if (subTime(when, 120, 0, true) > md) $scope.cmb.choices.push("5 days");
            if (subTime(when, 144, 0, true) > md) $scope.cmb.choices.push("6 days");
            if (subTime(when, 168, 0, true) > md) $scope.cmb.choices.push("A week");
        };

        $scope.$watch('cmb.selected', function(value) { if (value !== undefined) checkSel() });

        var sel;
        function checkSel() {
            sel = true;
            switch($scope.cmb.selected) {
                case $scope.cmb.choices[0]:
                    if ($scope.picker.date === undefined) $scope.picker.date = $scope.picker.options.minDate; else sel = false;
                    break;
                case $scope.cmb.choices[1]:
                    $scope.picker.date = subTime(when, 0, 15);
                    break;
                case $scope.cmb.choices[2]:
                    $scope.picker.date = subTime(when, 0, 30);
                    break;
                case $scope.cmb.choices[3]:
                    $scope.picker.date = subTime(when, 0, 45);
                    break;
                case $scope.cmb.choices[4]:
                    $scope.picker.date = subTime(when, 1, 0);
                    break;
                case $scope.cmb.choices[5]:
                    $scope.picker.date = subTime(when, 2, 0);
                    break;
                case $scope.cmb.choices[6]:
                    $scope.picker.date = subTime(when, 3, 0);
                    break;
                case $scope.cmb.choices[7]:
                    $scope.picker.date = subTime(when, 4, 0);
                    break;
                case $scope.cmb.choices[8]:
                    $scope.picker.date = subTime(when, 5, 0);
                    break;
                case $scope.cmb.choices[9]:
                    $scope.picker.date = subTime(when, 6, 0);
                    break;
                case $scope.cmb.choices[10]:
                    $scope.picker.date = subTime(when, 24, 0);
                    break;
                case $scope.cmb.choices[11]:
                    $scope.picker.date = subTime(when, 48, 0);
                    break;
                case $scope.cmb.choices[12]:
                    $scope.picker.date = subTime(when, 72, 0);
                    break;
                case $scope.cmb.choices[13]:
                    $scope.picker.date = subTime(when, 96, 0);
                    break;
                case $scope.cmb.choices[14]:
                    $scope.picker.date = subTime(when, 120, 0);
                    break;
                case $scope.cmb.choices[15]:
                    $scope.picker.date = subTime(when, 144, 0);
                    break;
                case $scope.cmb.choices[16]:
                    $scope.picker.date = subTime(when, 168, 0);
            }
        }

        $scope.$watch('picker.date', function(value) {
            if (value === undefined) return;
            if (sel) {
                sel = false;
                return;
            }
            $scope.picker.date.setSeconds(0, 0);
            var i = 0, j, d = $scope.picker.date.valueOf();
            function chk(h, m) {
                if ($scope.cmb.choices.length >= i++) if (d == subTime(when, h, m, true)) j = i; else if ($scope.cmb.choices.length != i) return; else j = 0; else j = 0;
                $scope.cmb.selected = $scope.cmb.choices[j];
                return true;
            }
            if (chk(0, 15)) return;
            if (chk(0, 30)) return;
            if (chk(0, 45)) return;
            if (chk(1, 0)) return;
            if (chk(2, 0)) return;
            if (chk(3, 0)) return;
            if (chk(4, 0)) return;
            if (chk(5, 0)) return;
            if (chk(6, 0)) return;
            if (chk(24, 0)) return;
            if (chk(48, 0)) return;
            if (chk(72, 0)) return;
            if (chk(96, 0)) return;
            if (chk(120, 0)) return;
            if (chk(144, 0)) return;
            chk(168, 0);
        });

        var reminderService = APIService.init(6);
        $scope.setReminder = function ($event){
            $event.stopPropagation();
            $scope.working = true;
            $rootScope.currTime = new Date();
            var curr = subTime($rootScope.currTime, 0, -1);
            if ($scope.picker.date === undefined || $scope.picker.date < curr) $scope.picker.date = curr;
            $scope.picker.options.minDate = curr;
            reminderService.save({event: $scope.objs[index].id, when: $scope.picker.date},
                function (){
                    $scope.cmb.opened[index] = false;
                    $timeout(function () { $scope.working = false });
                },
                function () { $scope.working = false });
        };
    })

    .controller('itemsCtrl', function($scope, $controller, itemService) {
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: itemService}));
    })

    .controller('MainCtrl', function($rootScope, $window, $scope, $uibModal, $aside, $timeout, usersModalService) { //, $interval
        $rootScope.title = $window.document.title;
        $rootScope.currTime = new Date();
        var ochtml = angular.element("#offcanvas").html();
        $timeout(function() { angular.element("#offcanvas").remove() });
        $scope.showOffcanvas = function (){
            $aside.open({
                size: 'sm',
                template: ochtml,
                scope: $scope,
                windowClass: 'oc',
                placement: 'right',
                controller: function ($scope, $uibModal, $uibModalInstance, BASE_MODAL) { /*, $css*/
                    /*$css.add('/static/main/css/sett.css');*/
                    $scope.showSettModal = function (index) {
                        if (index === undefined) index = 0;
                        $uibModal.open({
                            size: 'lg',
                            templateUrl: BASE_MODAL,
                            windowTopClass: 'sett',
                            controller: 'SettModalCtrl',
                            resolve: { index: function (){ return index } }
                        });
                    };
                    $scope.close = function() { $uibModalInstance.dismiss('cancel') };
                }
            });
        };
        $scope.showFriendsModal = function (me){
            var id;
            if (!me && $scope.rel_state != -1) id = $scope.id; else id = null;
            usersModalService.setAndOpen(id, 0);
        };
        $scope.showFavouritesModal = function (t, me){
            var id;
            if (me) id = null; else id = $scope.id;
            usersModalService.setAndOpen(id, t);
        };
    })

    .factory('emailService', function($rootScope, $resource, APIService) {
        var emails = [];
        var selected = 0;

        function _sendreq(action, email){
            return $rootScope.sendreq('email/', 'action_' + action + '=&email=' + email)
        }

        return {
            emails: emails,
            selected: selected,
            setCurrent: function(curr){ selected = curr },
            load: function(){
                emails.length = 0;
                return APIService.init(5).query({},
                    function (result) {
                        emails.push.apply(emails, result);
                    }).$promise;
            },
            add: function(email) {
                return _sendreq('add', email).then(function (){ emails.push({email: email, primary: false, verified: false}) });
            },
            remove: function() {
                return _sendreq('remove', emails[selected].email).then(function (){ return emails.splice(selected, 1)[0].email; });
            },
            resend: function() {
                return _sendreq('send', emails[selected].email);
            },
            primary: function() {
                return _sendreq('primary', emails[selected].email).then(function (){
                    var t = emails[0];
                    t.primary = false;
                    emails[selected].primary = true;
                    emails[0] = emails[selected];
                    emails[selected] = t;
                });
            }
        }

    })

    .controller('SettModalCtrl', function($rootScope, $scope, $timeout, $uibModalInstance, index, emailService) { //, $animate
        $scope.close = function() { $uibModalInstance.dismiss('cancel') };
        $scope.set_modal_loaded = function (){ $timeout(function() { $scope.modal_loaded = true }) };
        $scope.title = "Settings";
        $scope.file = 'settings';
        $scope.obj = {active: index, pass: null, email: null, selected: 0};
        //$scope.enableAnimation = function (){ console.log(angular.element('.nji')[0]); $animate.enabled(angular.element('.nji')[0], true) };

        // Email

        //var load;
        $scope.sent = [];
        $scope.$watch('obj.active', function (value) {
            if (value == 1 || $scope.emails !== undefined) return;
            //$scope.obj.selected = 0;
            $scope.emails = emailService.emails;
            //if ($scope.emails.length == 0) {
                //load = true;
            emailService.load().then(function (){ $timeout(function() { $scope.loaded = true; /*load = false*/ }) });
            $scope.addEmail = function () {
                if ($scope.obj.email === undefined) return;
                for (var e in $scope.emails) if ($scope.emails[e].email == $scope.obj.email) return;
                emailService.add($scope.obj.email).then(function (){
                    $scope.sent.push($scope.obj.email);
                    $scope.obj.email = '';
                });
            };
            $scope.removeEmail = function () {
                emailService.remove().then(function (e) {
                    for (var i = 0; i < $scope.sent.length; i++) {
                        if ($scope.sent[i]==e) {
                            $scope.sent.splice(i, 1);
                            break
                        }
                    }
                })
            };
            $scope.resendConfirmationEmail = function () {
                var t = $scope.emails[$scope.obj.selected].email;
                emailService.resend().then(function (){
                    for (var i = 0; i < $scope.sent.length; i++) if ($scope.sent[i]==t) t = null;
                    if (t != null) $scope.sent.push(t);
                });
            };
            var loading;
            $scope.makePrimaryEmail = function () {
                if (loading) return;
                loading = true;
                emailService.primary().then(function (){
                    /*$scope.obj.selected = 0;
                    $scope.EmailSelected();*/
                    $timeout(function() { loading = false });
                });
            };
            $scope.EmailSelected = function () {
                emailService.setCurrent($scope.obj.selected);
            };

            $scope.$watch('emails.length', function () {
                if ($scope.emails === undefined) return; //load
                $scope.obj.selected = $scope.emails.length-1;
                $scope.EmailSelected();
            });

            // Password

            $scope.dismissError = function (){
                delete $scope.pass_err;
                delete $scope.pass_err_txt;
            };
            $scope.changePassword = function () {
                var i = 0;
                for (; i < 3; i++) if ($scope.obj.pass[i] === undefined) return; //!$scope.changepw.$valid
                var pw_fields = angular.element('input[type="password"]');
                if ($scope.obj.pass[1] != $scope.obj.pass[2]) {
                    //if ($scope.pass_err != 4) {
                    $scope.pass_err_txt = "New password fields don't match.";
                    $scope.pass_err = 4;
                    pw_fields[2].focus();
                    //}
                    return;
                }
                if ($scope.obj.pass[0] == $scope.obj.pass[1]) {
                    /*var t = "Your new password matches the current password, enter a different one.";
                    if ($scope.pass_err_txt != t) {*/
                    $scope.pass_err_txt = "Your new password matches the current password, enter a different one."; //t
                    $scope.pass_err = 2;
                    pw_fields[1].focus();
                    //}
                    return;
                }
                $scope.dismissError();
                $rootScope.sendreq('password/', 'oldpassword='+$scope.obj.pass[0]+'&password1='+$scope.obj.pass[1]+'&password2='+$scope.obj.pass[2]).then(function (){
                    $scope.pass_err = 0;
                    for (i = 0; i < 3; i++) $scope.obj.pass[i] = '';
                }, function (response){
                    if (response.data.form_errors !== undefined) {
                        var err = 0;
                        $scope.pass_err_txt = '';
                        for (var e in response.data.form_errors) {
                            //if ($scope.pass_err_txt != '') $scope.pass_err_txt += '\r\n';
                            if (e == 'oldpassword') err += 1; else err += 2;
                            for (i = 0; i < response.data.form_errors[e].length; i++) {
                                if ($scope.pass_err_txt != ''/*i>0*/) $scope.pass_err_txt += ' ';
                                $scope.pass_err_txt += response.data.form_errors[e][i];
                            }
                        }
                        $scope.pass_err = err;
                        if (err == 1 || err == 3) pw_fields[0].focus(); else pw_fields[1].focus();
                    }
                });
            };
            //} else { $scope.loaded = true }
        });
    })

    .controller('NotificationCtrl', function ($rootScope, $scope, $timeout, APIService, NOTIF_PAGE_SIZE) {
        var notifService = APIService.init(4);

        $scope.loading = false;
        $scope.notifs = [];
        var ids = '', frse, u = 0;
        ($scope.getNotifs = function (notick) {
            if (notick) {
                $scope.loading = true;
                var page_num = Math.floor(($scope.notifs.length - u) / NOTIF_PAGE_SIZE) + 1;
            }
            var ret;
            if (page_num === undefined) {
                var d = {};
                if ($scope.unread) d.last = $scope.notifs[0].id;
                ret = notifService.query(d);
            } else ret = notifService.get({page: page_num});
            ret.$promise.then(function (result) {
                var res;
                if (page_num !== undefined) {
                    res = result.results;
                    $scope.has_next_page = result.page_count > page_num;
                } else res = result;
                if (res.length) {
                    if (page_num !== undefined) if (frse && $scope.notifs.length - u > NOTIF_PAGE_SIZE) res.splice(0, ($scope.notifs.length - u) % NOTIF_PAGE_SIZE); else if (frse == false) {
                        res.splice(0, u);
                        frse = true;
                    }
                    if (page_num === undefined) {
                        $scope.notifs.unshift.apply($scope.notifs, res);
                        for (var i = 0; i < res.length; i++) ids += ','+res[i].id;
                        if (!$scope.opened) {
                            u += i;
                            if ($scope.unread) i = $rootScope.title.indexOf(' ')+1; else {
                                $scope.unread = true;
                                i = 0;
                            }
                            $rootScope.title = '('+u+') '+$rootScope.title.substr(i);
                        } else markAllAsRead();
                    } else $scope.notifs.push.apply($scope.notifs, res);
                    $scope.enableScroll();
                    if ($scope.loading) $timeout(function() { $scope.loading = false });
                }
                if (frse === undefined) {
                    frse = false;
                    $scope.getNotifs(true);
                }
            });
            if (!notick) $timeout($scope.getNotifs, 10000);
        })();
        $scope.$watch('opened', function(value) {
            if (value === undefined) return;
            if (value && $scope.unread) {
                markAllAsRead();
                u = 0;
                $rootScope.title = $rootScope.title.substr($rootScope.title.indexOf(' ')+1);
            }
            if (!value) {
                if ($scope.notifs.length > NOTIF_PAGE_SIZE) {
                    $scope.notifs.splice(NOTIF_PAGE_SIZE, $scope.notifs.length - NOTIF_PAGE_SIZE);
                    $scope.has_next_page = true;
                }
                for (var i = 0; i < $scope.notifs.length; i++) if ($scope.notifs[i].unread) $scope.notifs[i].unread = false; else break;
            }
            $scope.unread = false;
        });
        $scope.enableScroll = function (){
            if (!$scope.opened) return;
            if ($scope.popc === undefined) $scope.popc = angular.element('#notif').next().find('.popover-content');
            $timeout(function() { if ($scope.popc.height() < 18+$scope.popc.children('.dt').height()) $scope.popc.css('overflow-y', 'scroll'); else $scope.popc.css('overflow-y', 'hidden') });
        };
        function markAllAsRead(){
            $rootScope.sendreq('api/notifications/read/?notxt=1&ids='+ids.substr(1));
            ids = '';
        }
    });