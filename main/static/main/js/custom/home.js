function dynamicSort(property) {
    var sortOrder;
    if(property[0] === '-') {
        sortOrder = -1;
        property = property.slice(1);
    } else sortOrder = 1;
    return function (a,b) { return ((a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0) * sortOrder }
}

function dynamicSortMultiple() {
    /*
     * save the arguments object as it will be overwritten
     * note that arguments object is an array-like object
     * consisting of the names of the properties to sort by
     */
    var props = arguments;
    return function (obj1, obj2) {
        var result = 0, numberOfProperties = props.length;
        /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
        for(var i = 0; result == 0 && i < numberOfProperties; i++) result = dynamicSort(props[i])(obj1, obj2);
        return result;
    }
}

var app = angular.module('mainApp', ['ui.bootstrap', 'nya.bootstrap.select', 'ngResource', 'ngAside', 'yaru22.angular-timeago', 'ngFitText', 'ngAnimate', 'ui.router', 'ui.router.modal', 'ui.bootstrap.datetimepicker', 'datetime']) /*, 'mgcrea.bootstrap.affix', 'angularCSS', 'oc.lazyLoad'*/
    .config(function($httpProvider, $animateProvider, $stateProvider, timeAgoSettings, BASE_MODAL, CONTENT_TYPES) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $animateProvider.classNameFilter(/(angular-animate|tab-pane)/);
        timeAgoSettings.allowFuture = true;

        var t = '';
        for (var k in CONTENT_TYPES) t += '|'+(k != 'comment' ? k : 'review');
        $stateProvider
            .state('main', { url: '/' })
            .state('main.showObjs', {
                url: 'show=:ids&type={type:(?:'+ t.slice(1)+')}{nobusiness:(?:&nobusiness)?}{showcomments:(?:&showcomments)?}',
                modal: true,
                templateUrl: BASE_MODAL,
                size: 'lg',
                controller: function ($scope, $uibModalInstance, $state, $stateParams, $timeout, $injector) {
                    $scope.loading = true;
                    $scope.nobusiness = $stateParams.nobusiness == '&nobusiness';
                    $scope.t = $stateParams.type;
                    var objService = $injector.get($scope.t+'Service');
                    switch ($scope.t) {
                        case 'item':
                            $scope.title = "Item(s)";
                            break;
                        case 'review':
                            $scope.title = "Review(s)";
                            break;
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
                    objService.load($stateParams.ids.split(','), $stateParams.showcomments == '&showcomments', $scope.nobusiness).then(function () { $timeout(function () {
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

    .directive('newScope', function() {
        return {
            scope: true,
            priority: 450
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
                '    <i ng-repeat="a in max track by $index" class="fa" ng-class="((ratingValue >= $index + 1) ? \'fa-star\' : floor(ratingValue) == $index && ratingValue % 1 >= 0.5 ? \'fa-star-half-o\' : \'fa-star-o\')+($last && (userNumber == 0 || (onClickStats !== undefined ? false : !showStats)) ? \' last-star\' : \'\')"></i' +
                '></span>' +
                '<span class="star-rating" ng-if="!readonly">' +
                '    <a href="javascript:" ng-repeat="a in max track by $index" ng-class="{\'last-star\': $last && (userNumber == 0 || (onClickStats !== undefined ? false : !showStats))}" ng-click="toggle($index)" ng-mouseover="hoverIn($index)" ng-mouseleave="hoverOut()"><i class="fa" ng-class="(hover > 0 && hover >= $index + 1 ? \'fa-star\' : hover == 0 ? ratingValue >= $index + 1 ? \'fa-star\' : ratingValue == $index + 0.5 ? \'fa-star-half-o\' : \'fa-star-o\' : \'fa-star-o\')+(userRating >= $index + 1 ? \' text-warning\' : \'\')"></i></a' +
                '></span><span ng-if="userNumber > 0 && (onClickStats !== undefined || showStats)">|<a href="javascript:" ng-if="onClickStats !== undefined" ng-click="show()" class="ml3">{{ ratingValue | number:1 }} ({{ userNumber }})</a><span ng-if="showStats && onClickStats === undefined" class="ml3">{{ ratingValue | number:1 }} ({{ userNumber }})</span></span>',
            scope: {
                ratingValue: '=?',
                userNumber: '=?',
                userRating: '=',
                max: '=?', //optional: default is 5
                onChange: '@?', //must return a promise
                showStats: '=?',
                onClickStats: '@?',
                funcParams: '=?'
            },
            link: function(scope, elem, attrs) {
                scope.floor = Math.floor;
                if (attrs.max === undefined) scope.max = new Array(5); else scope.max = new Array(attrs.max);
                scope.readonly = scope.userRating === undefined || scope.userRating == -1;
                if (!scope.readonly) {
                    scope.hover = 0;
                    scope.hoverIn = function (i) { scope.hover = i + 1 };
                    scope.hoverOut = function () { scope.hover = 0 };
                }
                if (scope.funcParams !== undefined) {
                    var p = '';
                    for (var k in scope.funcParams) p += ',' + k;
                    p = p.slice(1);
                } else scope.funcParams = {};
                if (scope.onChange !== undefined) var loading;
                scope.toggle = function (i) {
                    if (scope.onChange !== undefined) {
                        if (loading) return;
                        loading = true;
                        scope.$parent.$eval(scope.onChange + '(' + p + ', value)', angular.extend({}, scope.funcParams, {value: scope.userRating != i + 1 ? i + 1 : 0})).then(function () {
                            loading = false
                        });
                    } else if (scope.userRating !== undefined) {
                        scope.userRating = scope.userRating != i + 1 ? i + 1 : 0;
                        scope.ratingValue = scope.userRating;
                    }
                };
                scope.show = function () { scope.$parent.$eval(scope.onClickStats+'('+p+')', scope.funcParams) };
                if (scope.userRating !== undefined && scope.ratingValue !== undefined) scope.$watch('userRating', function (status, old_status) { if (status != old_status) scope.ratingValue = scope.ratingValue != 0 && scope.userNumber != 0 ? (((status != 0 && old_status == 0) ? (scope.userNumber - 1) : (status == 0 && old_status != 0) ? (scope.userNumber + 1) : scope.userNumber) * scope.ratingValue - old_status + status) / scope.userNumber : status; });
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

    .controller('UsersModalCtrl', function ($rootScope, $scope, $timeout, $resource, $window, $uibModalInstance, file, event, usersModalService, APIService, CONTENT_TYPES, HAS_STARS) {
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
        if (st) var stars = HAS_STARS[t];
        if (t == 0) o = APIService.init(); else o = APIService.init(3);
        switch (t){
            case 0:
                $scope.title = d.id == null ? ($scope.event !== undefined ? "Select friend(s)" : "Your friends") : "Friends";
                o = APIService.init();
                break;
            case 1:
            case 2:
                d.content_type = CONTENT_TYPES['business'];
                if (d.id == null || t == 2) {
                    if (d.id != null) $scope.title = "Favourites"; else $scope.title = "Your favourites";
                    d.is_person = 1;
                    $scope.favs = true;
                } else $scope.title = "Favoured by";
                break;
            default:
                d.content_type = CONTENT_TYPES[t];
                if (stars) $scope.title = "Ratings"; else $scope.title = "Reactions";
                var c = 0, l = 0;
        }
        $scope.tabs = [];
        $scope.load_page = function (i) {
            var t = angular.extend({}, d);
            if (i === undefined) i = 0;
            if ($scope.loaded !== null) {
                if (st) if (stars) t.stars = $scope.tabs[i].value; else t.is_dislike = $scope.tabs[i].value == 0;
                $scope.loaded = false;
                t.page = $scope.tabs[i].next_page;
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
                                    $scope.tabs[i] = {value: old + 1, heading: '<span class="star-rating">'};
                                    for (var j = 0; j <= old; j++) $scope.tabs[i].heading += '<i class="fa fa-star"></i>';
                                    $scope.tabs[i].heading += '</span>'; //$scope.tabs[i].heading.slice(1)
                                } else $scope.tabs[i] = {value: i, heading: old == 1 ? "Liked by" : "Disliked by"};
                            }
                        } else if ($scope.loaded == undefined) $scope.tabs[0] = {elems: []};
                        if ($scope.tabs[i].elems === undefined) $scope.tabs[i].elems = [];
                        $scope.tabs[i].elems.push.apply($scope.tabs[i].elems, result.results);
                        var pg;
                        if ($scope.tabs[i].next_page === undefined) pg = 1; else pg = $scope.tabs[i].next_page+1;
                        if (result.page_count == pg) { if ($scope.tabs[i].next_page !== undefined) delete $scope.tabs[i].next_page; } else $scope.tabs[i].next_page = pg;
                    }
                    if ($scope.loaded === undefined || l == (stars ? 5 : 2)) $timeout(function() {
                        if (st) $scope.tabs.sort(dynamicSort('-value'));
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
            $scope.tabs[0].elems[i].selected = $scope.tabs[0].elems[i].selected !== undefined ? !$scope.tabs[0].elems[i].selected : true;
            if ($scope.tabs[0].elems[i].selected) $scope.sel_cnt++; else $scope.sel_cnt--;
            //} else $window.location.href = '/'+($scope.favs ? $scope.tabs[0].elems[i].shortname : 'user/'+$scope.tabs[0].elems[i].username)+'/'
        };

        $scope.sendNotify = function (){
            $scope.working = true;
            var to = '';
            for (i = 0; i < $scope.tabs[0].elems.length; i++) if ($scope.tabs[0].elems[i].selected) to += ',' + $scope.tabs[0].elems[i].id;
            $rootScope.sendreq('api/events/'+$scope.event+'/notify/?notxt=1&to='+to.slice(1)).then(function (){ $scope.close() }, function () { $scope.working = false });
        }
    })

    .factory('APIService', function($resource) {
        return {
            init: function (t){
                var n;
                switch (t){
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

    .factory('uniService', function ($q, $timeout, APIService, COMMENT_PAGE_SIZE, CONTENT_TYPES, menuService, dialogService){
        var u = false, id = null, likeService = APIService.init(3), commentService = APIService.init(7);

        function UniObj(t){
            this.objs = [[],[], t];
            switch (t){
                case 'event':
                    this.s = APIService.init(2);
                    break;
                case 'item':
                    this.s = APIService.init(8);
                    break;
                case 'comment':
                    this.s = commentService;
            }
            this.page_num = 1;
            this.remids = [];
        }

        UniObj.prototype.remove = function (e, index, r, l) {
            if (r) if (!this.bu) for (var i = 0; i < this.objs[0].length; i++) if (this.objs[0][i].id == e[index].id) {
                this.objs[0].splice(i, 1);
                break;
            } else menuService.del(e[index].id);
            if (l) this.remids.push(e[index].id);
            if (!r || !u) e.splice(index, 1);
        };

        UniObj.prototype.getobjs = function (t, n) {
            if (t === undefined) return this.objs[2];
            var e;
            e = t ? this.objs[1] : this.objs[0];
            if (n === undefined) e.length = 0;
            return e;
        };

        UniObj.prototype.load = function (b, rel_state) { //, nob
            var ids = null, d, self = this;
            if (b !== undefined) if (angular.isArray(b)) {
                function showc(i) {
                    if (self.objs[1][i].showcomm === undefined) {
                        self.objs[1][i].showcomm = [[false, true], true];
                        self.loadComments(i, true).then(function l() { $timeout(function () { self.objs[1][i].showcomm[0][0] = true }) });
                    } else self.objs[1][i].showcomm[1] = true;
                }
                var p, i;
                ids = '';
                for (i = 0; i < b.length && b[i] !== undefined; i++) {
                    p = false;
                    for (var j = i + 1; j < b.length; j++) if (b[j] == b[i]) {
                        delete b[i];
                        p = true;
                    }
                    if (!p && /^\d+$/.test(b[i])) {
                        for (d in this.objs[0]) if (this.objs[0][d].id == b[i]) {
                            var ev = angular.copy(this.objs[0][d]);
                            /*delete ev.comments;
                            delete ev.user_comments;
                            delete ev.offset;
                            delete ev.comment_more;*/
                            if (ev.showcomm !== undefined) ev.showcomm = [[true, true], false]; //delete ev.showcomm;
                            this.objs[1].push(ev);
                            if (rel_state) showc(this.objs[1].length - 1);
                            p = true;
                            break;
                        }
                        if (!p) ids += ',' + b[i];
                    }
                }
                ids = ids.slice(1);
            } else id = b;
            if (ids == '') return $q.when(); else if (ids == null) {
                d = {page: this.page_num, id: id};
                if (rel_state !== undefined) {
                    u = rel_state == -1;
                    d.is_person = 1;
                }
                if (this.objs[2] == 'comment') d.content_type = CONTENT_TYPES['business'];
                return this.s.get(d,
                    function (result) {
                        self.objs[0].push.apply(self.objs[0], result.results);
                        self.objs[0].has_next_page = result.page_count > self.page_num;
                        self.page_num++;
                    }).$promise
            } else {
                d = this.objs[1];
                return this.s.query({ids: ids}, function (result) { //, no_business: this.objs[2] == 'comment' && nob || null
                    d.push.apply(d, result);
                    if (rel_state) for (i = 0; i < d.length; i++) showc(i);
                }).$promise
            }
        };

        UniObj.prototype.new = function() {
            var objs = this.objs[0], d;
            switch (this.objs[2]) {
                case 'event':
                    d = {text: arguments[0], when: arguments[1]};
                    break;
                /*case 'item':
                    //...
                    break;*/
                case 'comment':
                    d = {text: arguments[0], stars: arguments[1], object_id: arguments[2], content_type: CONTENT_TYPES['business']};
            }
            return this.s.save(d, function (result){ objs.unshift(result) }).$promise;
        };

        UniObj.prototype.del = function (index, r, par_ind, p) {
            var e = r ? this.objs[1] : this.objs[0];
            if (par_ind !== undefined) {
                if (r || index == null) var objs = [this.objs[0]];
                e = e[par_ind];
                var id = [e.id];
                if (index == null) {
                    if (r) objs.push(this.objs[1]);
                    id.push(e.main_comment.id);
                } else id.push(e[p][index].id);
                return commentService.delete({id: id[1]}, function (result) {
                    if (objs !== undefined) for (var l = 0; l < objs.length; l++) for (var i = 0; i < objs[l].length; i++) if (objs[l][i].id == id[0]) {
                        if (objs[l][i].main_comment != null && objs[l][i].main_comment.id == id[1]) if (result.id !== undefined) angular.copy(result, objs[l][i].main_comment); else delete objs[l][i].main_comment;
                        var uc = ['comments', 'user_comments'];
                        for (var k = 0; k < 2; k++) if (objs[l][i][uc[k]] !== undefined) for (var j = 0; j < objs[l][i][uc[k]].length; j++) if (objs[l][i][uc[k]][j].id == id[1]) {
                            objs[l][i][uc[k]].splice(j, 1);
                            objs[l][i].offset--;
                            break;
                        }
                        objs[l][i].comment_count = e.comment_count - 1;
                        break;
                    }
                    if (index != null) {
                        if (e.main_comment != null && e.main_comment.id == id[1]) if (result.id !== undefined) angular.copy(result, e.main_comment); else delete e.main_comment;
                        e[p].splice(index, 1);
                        e.comment_count--;
                        e.offset--;
                    }
                }).$promise;
            } else {
                var self = this;
                return this.s.delete({id: e[index].id}, function (){
                    self.remove(e, index, r);
                }, function (result){
                    if (self.objs[2] == 'item' && result.non_field_errors !== undefined) dialogService.show("You can't delete the last remaining item!", false)
                }).$promise;
            }
        };

        UniObj.prototype.setLikeStatus = function (index, r, dislike_stars, par_ind) {
            var e = r ? this.objs[1] : this.objs[0], id, isl;
            if (par_ind !== undefined) {
                id = index != null ? e[par_ind].comments[index] : e[par_ind].main_comment;
                par_ind = [e[par_ind], id.id, index != null];
                e = [id.manager_stars];
                id = par_ind[1];
                index = 0;
                isl = true;
            } else {
                id = e[index].id;
                isl = typeof(dislike_stars) == 'boolean';
            }
            var old_status = e[index].curruser_status, status, s;
            if (isl ? old_status == 1 && !dislike_stars || old_status == 2 && dislike_stars : dislike_stars == 0) {
                s = likeService.delete({content_type: par_ind !== undefined ? CONTENT_TYPES['comment'] : CONTENT_TYPES[this.objs[2]], id: id});
                status = 0;
            } else {
                var d = {content_type: par_ind !== undefined ? CONTENT_TYPES['comment'] : CONTENT_TYPES[this.objs[2]], object_id: id};
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
                    } else if (par_ind !== undefined || r || !u) if (isl) { if (old_status == 1) e[index].likestars_count--; else if (old_status == 2) e[index].dislike_count--; } else if (old_status != 0 && status == 0) e[index].likestars_count--;
                    if (par_ind !== undefined || r || !u || status != 0) e[index].curruser_status = status;
                    var i;
                    if (r || par_ind !== undefined) {
                        if (!u || status != 0 || par_ind !== undefined) {
                            var obj, objs = [self.objs[0]];
                            if (par_ind !== undefined) {
                                id = par_ind[0].id;
                                if (r) objs.push(self.objs[1]);
                                var mc = par_ind[0].main_comment !== undefined;
                            }
                            for (var t = 0; t < objs.length; t++) for (i = 0; i < objs[t].length; i++) if (objs[t][i].id === undefined || objs[t][i].id == id) {
                                if (par_ind !== undefined && objs[t][i].comments !== undefined) {
                                    if (par_ind[2] || r && objs[t] === self.objs[0]) {
                                        if (mc && objs[t][i].main_comment.id == par_ind[1]) objs.push([objs[t][i].main_comment.manager_stars]);
                                        if (objs[t][i] === par_ind[0]) break;
                                    }
                                    for (var j = 0; j < objs[t][i].comments.length; j++) if (objs[t][i].comments[j].id == par_ind[1]) {
                                        obj = objs[t][i].comments[j].manager_stars;
                                        break;
                                    }
                                } else if (par_ind === undefined || objs[t][i].main_comment === undefined) obj = objs[t][i]; else break;
                                obj.likestars_count = e[index].likestars_count;
                                if (isl) obj.dislike_count = e[index].dislike_count;
                                obj.curruser_status = status;
                                if (u) obj.person_status = status;
                                if (!isl) var k = [obj.comments, obj.user_comments];
                                break;
                            }
                        }
                        if (par_ind === undefined && u && status != 0 && old_status == 0) for (i = 0; i < self.remids.length; i++) if (self.remids[i] == id) {
                            self.remids.splice(i, 1);
                            e[index].person_status = e[index].curruser_status;
                            self.objs[0].push(e[index]);
                            self.objs[0].sort(self.objs[0].when !== undefined ? dynamicSortMultiple('-when', '-id') : dynamicSort('-id'));
                            break;
                        }
                    }
                    if (par_ind === undefined) {
                        if (u && status == 0) self.remove(e, index, r, true);
                        if (!isl && (r || !u || status != 0)) {
                            if (k === undefined) var k = [];
                            k.push.apply(k, [e[index].comments, e[index].user_comments]);
                            for (isl = 0; isl < k.length; isl++) if (k[isl] !== undefined) for (i = 0; i < k[isl].length; i++) if (k[isl][i].is_curruser) k[isl][i].manager_stars = status;
                        }
                    }
                });
        };

        UniObj.prototype.loadComments = function (index, r, l, a){
            var self = this, e = (r ? this.objs[1] : this.objs[0])[index], o = l === undefined || l > 0;
            if (l !== undefined) { if (l < 0) l = -l; } else l = null;
            if (e.offset === undefined) e.offset = 0;
            var p = commentService.get({content_type: CONTENT_TYPES[this.objs[2]], id: e.id, offset: o ? e.offset : (e.comments !== undefined ? e.comments.length : 0) - (a ? l : 0), limit: l, reverse: !o || null},
                function (result){
                    if (a !== 0) a = 0;
                    if (e.comments === undefined) e.comments = [];
                    var k = [e.comments, e.user_comments], no;
                    for (var i = 0; i < result.results.length; i++) {
                        no = false;
                        for (var j = 0; j < 1; j++) if (k[j] !== undefined) for (var m = 0; m < k[j].length; m++) if (k[j][m].id == result.results[i].id) {
                            if (!o && j == 1) {
                                e.user_comments.splice(m, 1);
                                no = null;
                                break;
                            }
                            no = true;
                            break;
                        }
                        if (!no) {
                            if (o) e.comments.unshift(result.results[i]); else e.comments.push(result.results[i]);
                            if (no === false) a++;
                        }
                    }
                    e.comment_count = result.count;
                    if (!o) e.comment_more -= a; else e.offset += l || (e.offset + COMMENT_PAGE_SIZE > e.count ? e.count - e.offset : COMMENT_PAGE_SIZE);
                }).$promise;
            return p.then(function (){
                    if (l != null ? a != l : a != COMMENT_PAGE_SIZE && e.comment_count > (e.comments !== undefined ? e.comments.length : 0) + (e.user_comments !== undefined ? e.user_comments.length : 0)) {
                        if (!o) return self.loadComments(index, r, a-l, true); else {
                            if (e.comment_more === undefined) e.comment_more = COMMENT_PAGE_SIZE - a; else e.comment_more += COMMENT_PAGE_SIZE - a;
                            return self.loadComments(index, r, COMMENT_PAGE_SIZE - a);
                        }
                    }
                    return p;
                }, function (){ return p });
        };

        UniObj.prototype.submitComment = function (index, txt, r){
            var e = (r ? this.objs[1] : this.objs[0])[index];
            if (r) var objs = this.objs[0];
            return commentService.save({content_type: CONTENT_TYPES[this.objs[2]], object_id: e.id, text: txt, status: e.status !== undefined ? e.status.value : null},
                function (result){
                    if (e.user_comments === undefined) e.user_comments = [];
                    e.user_comments.push(result);
                    if (angular.isObject(result.manager_stars)) if (e.main_comment == null) e.main_comment = angular.copy(result); else angular.copy(result, e.main_comment);
                    e.offset++;
                    e.comment_count++;
                    if (r) for (var i = 0; i < objs.length; i++) if (objs[i].id == e.id) {
                        if (objs[i].user_comments !== undefined) {
                            objs[i].user_comments.push(result);
                            if (angular.isObject(result.manager_stars)) if (objs[i].main_comment == null) objs[i].main_comment = angular.copy(result); else angular.copy(result, objs[i].main_comment);
                            objs[i].offset++;
                        }
                        objs[i].comment_count = e.comment_count;
                        break;
                    }
                }).$promise;
        };

        return { getInstance: function (t) { return new UniObj(t) } }
    })
    .factory('eventService', function (uniService) { return uniService.getInstance('event') })
    .factory('itemService', function (uniService) { return uniService.getInstance('item') })
    .factory('reviewService', function (uniService) { return uniService.getInstance('comment') })

    .controller('BaseCtrl', function ($rootScope, $scope, $timeout, objService, usersModalService, COMMENT_PAGE_SIZE) {
        $scope.r = $scope.$parent.objs !== undefined;
        $scope.objs = $scope.r ? $scope.$parent.objs : objService[0].getobjs(false);
        if (!$scope.r) {
            $scope.loading = true;
            var l = function() { $scope.loading = false };
            objService[0].load($scope.id, $scope.rel_state).then(function() { $scope.loading = false; if (objService[1] !== undefined) objService[1]() } /*function () { $timeout(function () { if ($scope.objs.length == 0) $scope.enableAnimation() }) }*/);
            $scope.load_page = function (){
                $scope.loading = true;
                objService[0].load().then(l, l);
            };
        }

        $scope.com = [['older', 'comments', 0], ['newer', 'user_comments', 1]];

        $scope.delete = function (index, par_ind, p){ objService[0].del(index, $scope.r, par_ind, p) };

        $scope.showDisLikes = function (index) { usersModalService.setAndOpen($scope.objs[index].id, objService[0].getobjs()) };

        $scope.toggleHr = function (f, l) { if (f) if (l) if (!angular.element('.objs'+$scope.r+'_'+$scope.$parent.t+' .ng-leave').length) return angular.element('.objs'+$scope.r+'_'+$scope.$parent.t+' .ng-leave-prepare').length; else return true; else return true; else return false };

        var loading;
        $scope.giveDisLike = function(index, dislike, par_ind) {
            if (loading) return;
            loading = true;
            function l(){ $timeout(function () { loading = false }) }
            return objService[0].setLikeStatus(index, $scope.r, dislike, par_ind).then(l, l);
        };

        function load_comments(index, m){
            function l() { $timeout(function (){ $scope.objs[index].showcomm[0][m || 0] = true }) }
            objService[0].loadComments(index, $scope.r, m === 1 ? $scope.objs[index].comment_more > COMMENT_PAGE_SIZE ? -COMMENT_PAGE_SIZE : -$scope.objs[index].comment_more : undefined).then(l, l);
        }

        $scope.showComments = function(index) {
            if ($scope.objs[index].showcomm === undefined) {
                $scope.objs[index].showcomm = [[false, true], true];
                load_comments(index);
            } else $scope.objs[index].showcomm[1] = !$scope.objs[index].showcomm[1];
        };

        $scope.show_next = function (index, m){ return $scope.objs[index].comments !== undefined && $scope.objs[index].showcomm[0][m || 0] ? m === 1 ? $scope.objs[index].comment_more !== undefined ? $scope.objs[index].comment_more > 0 : false : $scope.objs[index].comment_count > $scope.objs[index].comments.length + ($scope.objs[index].user_comments !== undefined ? $scope.objs[index].user_comments.length : 0) + ($scope.objs[index].comment_more !== undefined ? $scope.objs[index].comment_more : 0) : false };

        $scope.load_next = function (index, m){
            $scope.objs[index].showcomm[0][m || 0] = false;
            load_comments(index, m);
        };

        $scope.submitComment = function (index) {
            var el = angular.element('#'+$scope.$parent.t+index);
            if (el.val() != '') objService[0].submitComment(index, el.val(), $scope.r).then(
                function () {
                    el.val('');
                    if (objService[2] !== undefined) objService[2](index);
                })
        }
    })

    .controller('eventsCtrl', function($scope, $rootScope, $controller, $timeout, usersModalService, eventService, APIService) {
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [eventService]}));

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
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [itemService]}));
        
        itemService.bu = $scope.r && $scope.fav_state == -1;
    })

    .controller('reviewsCtrl', function($scope, $controller, reviewService, usersModalService) {
        var f = function (){ if (!$scope.r && $scope.$parent.$parent.$parent.$parent.$parent.fav_state !== undefined && $scope.$parent.$parent.$parent.$parent.$parent.fav_state != -1) $scope.$parent.$parent.$parent.$parent.$parent.showrevf = $scope.objs[0] === undefined || $scope.objs[0].curruser_status != -1 };
        angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [reviewService, f, function (index) { if ($scope.objs[index].status != $scope.choices[0]) $scope.objs[index].status = $scope.choices[0] }]}));

        $scope.isObject = function (obj) { return angular.isObject(obj) };

        $scope.delete = function (index, par_ind, p){ reviewService.del(index, $scope.r, par_ind, p).then(f) };

        $scope.showDisLikes = function (index, par_ind) { if (par_ind === undefined) usersModalService.setAndOpen($scope.objs[index].id, reviewService.getobjs()); else if (index != null) usersModalService.setAndOpen($scope.objs[par_ind].comments[index].id, 'comment'); else usersModalService.setAndOpen($scope.objs[par_ind].main_comment.id, 'comment'); };

        $scope.choices = [{name: "(None)", value: null}, {name: "Started", value: 0}, {name: "Closed", value: 1}, {name: "Completed", value: 2}, {name: "Declined", value: 3}, {name: "Under review", value: 4}, {name: "Planned", value: 5}, {name: "Archived", value: 6}, {name: "Need feedback", value: 7}];
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
                            $rootScope.title = '('+u+') '+$rootScope.title.slice(i);
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
                $rootScope.title = $rootScope.title.slice($rootScope.title.indexOf(' ')+1);
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
            $rootScope.sendreq('api/notifications/read/?notxt=1&ids='+ids.slice(1));
            ids = '';
        }
    });