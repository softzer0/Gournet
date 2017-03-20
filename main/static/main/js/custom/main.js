app.requires.push('ui.bootstrap', 'nya.bootstrap.select', 'ngResource', 'ngAside', 'yaru22.angular-timeago', 'ngFitText', 'ngAnimate', 'ui.router', 'ui.router.modal', 'ui.bootstrap.datetimepicker', 'datetime', 'ct.ui.router.extras'); //, 'mgcrea.bootstrap.affix', 'angularCSS', 'oc.lazyLoad'
app
    .config(function($httpProvider, $animateProvider, $stateProvider, timeAgoSettings, BASE_MODAL, CONTENT_TYPES) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $animateProvider.classNameFilter(/(angular-animate|tab-pane)/);
        timeAgoSettings.allowFuture = true;

        var t = '', name = (window.location.pathname != '/' ? 'main.' : '') + 'showObjs';
        for (var k in CONTENT_TYPES) t += '|'+(k != 'comment' ? k : 'review');
        if (window.location.pathname != '/') $stateProvider.state('main', {url: '/'}); else if (window.location.hash == '' || window.location.hash == '#') window.location.hash = '#/';
        $stateProvider.state(name, {
            url: (window.location.pathname == '/' ? '/' : '') + 'show={ids:[0-9]+(?:,[0-9]+)*}&type={type:(?:'+t.slice(1)+')}{showcomments:(?:&showcomments)?}',
            params: {ts: null},
            modal: true,
            templateUrl: BASE_MODAL,
            size: 'lg',
            controller: function ($scope, $uibModalInstance, $stateParams, $timeout, $injector) {
                $scope.loading = true;
                $scope.t = $stateParams.type;
                var objService = $injector.get($scope.t+'Service');
                switch ($scope.t) {
                    case 'event':
                        $scope.title = gettext("Event(s)");
                        break;
                    case 'item':
                        $scope.title = gettext("Item(s)");
                        if ($stateParams.ts !== null) $scope.ts = $stateParams.ts;
                        break;
                    case 'review':
                        $scope.title = gettext("Review(s)");
                }
                $scope.file = '../events';

                $scope.close = function() {
                    delete $scope.close;
                    $uibModalInstance.dismiss('cancel');
                };
                $scope.$on('$stateChangeStart', function(evt, toState) {
                    if ($scope.close !== undefined && toState.name != name) $scope.close();
                    objService.getobjs(true, null);
                });

                $scope.objs = objService.getobjs(true, false);
                objService.load($stateParams.ids.split(','), $stateParams.showcomments == '&showcomments', $scope.ts !== undefined).then(function () { //, $scope.nobusiness
                    $timeout(function () {
                        $scope.loading = false;
                        $scope.modal_loaded = true;
                    });
                }); //$scope.enableAnimation(); }
            }
        });
    })

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

    .filter('unsafe', function($sce) { return $sce.trustAsHtml })
    //.filter('spaces', function() { return function(input) { return input.replace(/\s+/g, '+') } })

    .filter('translate', function() {
        return function(input, params, context) {
            var r = context !== undefined ? pgettext(context, input) : gettext(input);
            return params != null ? interpolate(r, [params]/*, params.constructor == Object*/) : r;
        }
    })
    .directive('translate', function($compile, $timeout) {
        return {
            compile: function(element, attrs) {
                if (attrs.translate == '') {
                    element.html(gettext(element.html()));
                    return;
                }
                attrs.html = element.html().split('<br plural="">');
                return {
                    post: function (scope, element, attrs) {
                        delete attrs.html[2];
                        scope.$watch(function () {
                            return scope.$eval(attrs.translate);
                        }, function (val) {
                            var p = attrs.html[2];
                            attrs.html[2] = ngettext(attrs.html[0], attrs.html[1], attrs.add !== undefined ? val + attrs.add : attrs.subtract !== undefined ? val - attrs.subtract : val);
                            if (p == attrs.html[2]) return;
                            element.html(attrs.html[2]);
                            $compile(element.contents())(scope);
                        });
                    }
                }
            }
        }
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
                    windowClass: 'modal-confirm',
                    template: '<div class="modal-body"><span class="ww">' + message + '</span></div><div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">'+(OkCancel === undefined ? gettext("Yes") : gettext("OK"))+'</button>'+((OkCancel || OkCancel === undefined) ? '<button class="btn btn-warning" ng-click="cancel()">'+(OkCancel === undefined ? gettext("No") : gettext("Cancel"))+'</button></div>':''),
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
                ngDialogMessage: '@?',
                ngDialogOkcancel: '=?',
                ngDialogOkonly: '=?',
                ngDialogClick: '&'
            },
            link: function(scope, element, attrs) {
                element.bind('click', function() {
                    dialogService.show(attrs.ngDialogMessage || gettext("Are you sure?"), (attrs.ngDialogOkcancel && attrs.ngDialogOkonly) ? false : attrs.ngDialogOkcancel || (attrs.ngDialogOkonly ? false : undefined)).then(function() { scope.ngDialogClick() }/*, function() {}*/);
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

    .directive('suchHref', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                element.addClass('clickable');
                element.on('click', function() {
                    window.location.href = attr.suchHref;
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
                '    <i ng-repeat="_ in max track by $index" class="fa" ng-class="(floor(starRating) > $index + 1 || starRating == $index + 1 ? \'fa-star\' : floor(starRating) == $index + 1 && starRating % 1 >= 0.5 ? \'fa-star-half-o\' : \'fa-star-o\')+($last && (userNumber == 0 || (onClickStats !== undefined ? false : userNumber === undefined || userNumber == 0)) ? \' last-star\' : \'\')"></i' +
                '></span>' +
                '<span class="star-rating" ng-if="!readonly">' +
                '    <a href="javascript:" ng-repeat="a in max track by $index" ng-class="{\'last-star\': $last && (userNumber == 0 || (onClickStats !== undefined ? false : userNumber === undefined || userNumber == 0))}" ng-click="toggle($index)" ng-mouseover="hoverIn($index)" ng-mouseleave="hoverOut()"><i class="fa" ng-class="(hover > 0 && hover >= $index + 1 ? \'fa-star\' : hover == 0 ? floor(starRating) > $index + 1 || starRating == $index + 1 ? \'fa-star\' : floor(starRating) == $index + 1 && starRating % 1 >= 0.5 ? \'fa-star-half-o\' : \'fa-star-o\' : \'fa-star-o\')+(userRating >= $index + 1 ? \' text-warning\' : \'\')"></i></a' +
                '></span><span ng-if="userNumber > 0 && (onClickStats !== undefined || userNumber !== undefined && userNumber != 0)">|<a href="javascript:" ng-if="onClickStats !== undefined" ng-click="show()" class="ml3">{{ starRating | number:1 }} ({{ userNumber }})</a><span ng-if="userNumber !== undefined && userNumber != 0 && onClickStats === undefined" class="ml3">{{ starRating | number:1 }} ({{ userNumber }})</span></span>',
            scope: {
                starRating: '=?',
                userNumber: '=?',
                userRating: '=',
                readonly: '@?',
                //max: '&?', //optional: default is 5
                onChange: '@?', //must return a promise
                //showStats: '=?',
                onClickStats: '@?',
                funcParams: '=?'
            },
            link: function(scope) {
                scope.floor = Math.floor;
                /*if (scope.max === undefined)*/ scope.max = new Array(5); //else scope.max = new Array(attrs.max);
                if (scope.readonly === undefined) scope.readonly = scope.userRating === undefined || scope.userRating == -1;
                if (scope.userRating !== undefined && scope.starRating !== undefined) scope.$watch('userRating', function (status, old_status) {
                    if (status == old_status) return;
                    if (status != 0 && old_status == 0) scope.userNumber++; else if (status == 0 && old_status != 0) scope.userNumber--;
                    scope.starRating = scope.starRating != 0 && scope.userNumber != 0 ? (((status != 0 && old_status == 0) ? (scope.userNumber - 1) : (status == 0 && old_status != 0) ? (scope.userNumber + 1) : scope.userNumber) * scope.starRating - old_status + status) / scope.userNumber : status;
                });
                if (scope.funcParams !== undefined && (scope.onClickStats !== undefined || !scope.readonly && scope.onChange !== undefined)) {
                    var p = '';
                    for (var k in scope.funcParams) p += ',' + k;
                    p = p.slice(1);
                } else scope.funcParams = {};
                if (scope.onClickStats !== undefined) scope.show = function () { scope.$parent.$eval(scope.onClickStats+'('+p+')', scope.funcParams) };
                if (scope.readonly) return;
                scope.hover = 0;
                scope.hoverIn = function (i) { scope.hover = i + 1 };
                scope.hoverOut = function () { scope.hover = 0 };
                /*if (scope.onChange !== undefined)*/ var loading;
                scope.toggle = function (i) { //$event,
                    scope.hoverOut(); //$event.stopPropagation();
                    if (scope.onChange !== undefined) {
                        if (loading) return;
                        loading = true;
                        scope.$parent.$eval(scope.onChange + '(' + p + ', value)', angular.extend({}, scope.funcParams, {value: scope.userRating != i + 1 ? i + 1 : 0})).then(function () { loading = false });
                    } else if (scope.userRating !== undefined) scope.userRating = scope.userRating != i + 1 ? i + 1 : 0; //scope.starRating = scope.userRating;
                };
			}
		};
	})

    .directive('clickOutside', function ($document, $parse) {
        return {
           restrict: 'A',
           scope: {clickOutside: '&', inScope: '@?'},
           link: function (scope, el) {
               function documentClick(e) { if (el.children('div').is(':visible') && e.currentTarget.body.className.indexOf('modal') == -1 && e.target.parentElement.className.indexOf('uib-day') == -1 && el !== e.target && !el[0].contains(e.target)) scope.$apply(function () { scope.$eval(scope.clickOutside) }) }
               $document.on('click', documentClick);
               if (scope.inScope) $parse(scope.inScope).assign(scope.$parent, documentClick);
           }
        }
    })

    .directive('selectOnClick', function () {
        return {
            restrict: 'A',
            link: function (scope, element) {
                var isFocused = false;
                element.on('click', function () {
                    if (!isFocused) {
                        try { this.setSelectionRange(0, this.value.length + 1) } catch (err) { this.select() }
                        isFocused = true;
                    }
                });
                element.on('blur', function () { isFocused = false });
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

    .controller('ModalCtrl', function ($scope, $uibModalInstance){
        $scope.close = function() { $uibModalInstance.dismiss('cancel') };
        $scope.set_modal_loaded = function (){
            var unregister = $scope.$watch(function() { return angular.element('.loaded').length }, function(value) {
                if (value > 0) {
                    unregister();
                    delete $scope.set_modal_loaded;
                    $scope.modal_loaded = true;
                }
            });
        };
    })

    .controller('UsersModalCtrl', function ($rootScope, $scope, $timeout, $resource, $uibModalInstance, $controller, file, event, usersModalService, APIService, CONTENT_TYPES, HAS_STARS) { //, $window
        angular.extend(this, $controller('ModalCtrl', {$scope: $scope, $uibModalInstance: $uibModalInstance}));

        $scope.file = file;
        if (event !== undefined) {
            $scope.event = event;
            $scope.sel_cnt = 0;
            $scope.check_disabled = function () { return $scope.sel_cnt == 0 };
            $scope.button_text = "Notify (%s)"; // interpolate(gettext("Notify (%s)"), [$scope.sel_cnt])

            $scope.makeSel = function (i) {
                //if ($scope.event !== undefined) {
                if ($scope.event === undefined || $scope.working) return;
                $scope.tabs[0].elems[i].selected = $scope.tabs[0].elems[i].selected !== undefined ? !$scope.tabs[0].elems[i].selected : true;
                if ($scope.tabs[0].elems[i].selected) $scope.sel_cnt++; else $scope.sel_cnt--;
                //} else $window.location.href = '/'+($scope.favs ? $scope.tabs[0].elems[i].shortname : 'user/'+$scope.tabs[0].elems[i].username)+'/'
            };

            $scope.doAction = function (){
                $scope.working = true;
                var to = '';
                for (i = 0; i < $scope.tabs[0].elems.length; i++) if ($scope.tabs[0].elems[i].selected) to += ',' + $scope.tabs[0].elems[i].id;
                $rootScope.sendreq('api/events/'+$scope.event+'/notify/?notxt=1&to='+to.slice(1)).then(function (){ $scope.close() }, function () { $scope.working = false });
            }
        }

        var d = {id: usersModalService.params.id}, t = usersModalService.params.type, o, st = typeof(t) == 'string', i;
        if (st) var stars = HAS_STARS[t];
        if (t == 0) o = APIService.init(); else o = APIService.init(3);
        switch (t){
            case 0:
                $scope.title = d.id == null ? ($scope.event !== undefined ? gettext("Select friend(s)") : gettext("Your friends")) : gettext("Friends");
                o = APIService.init();
                break;
            case 1:
            case 2:
                d.content_type = CONTENT_TYPES['business'];
                if (d.id == null || t == 2) {
                    if (d.id != null) $scope.title = gettext("Favourites"); else $scope.title = gettext("Your favourites");
                    d.is_person = 1;
                    $scope.favs = true;
                } else $scope.title = gettext("Favoured by");
                break;
            default:
                d.content_type = CONTENT_TYPES[t];
                if (stars) $scope.title = gettext("Ratings"); else $scope.title = gettext("Reactions");
        }
        $scope.tabs = [];
        ($scope.load_page = function (i) {
            var t = angular.copy(d);
            if (i === undefined) i = 0;
            if ($scope.loaded !== undefined) {
                if (st) if (stars) t.stars = $scope.tabs[i].value; else t.is_dislike = $scope.tabs[i].value;
                $scope.loaded = false;
                t.page = $scope.tabs[i].next_page;
            } else if (st) t.init = 1;
            function f(result){
                if (t.init || result.results.length > 0) {
                    var pg;
                    if ($scope.loaded === undefined) {
                        if (st) {
                            t = 0;
                            function load() {
                                $scope.tabs[t].elems.push.apply($scope.tabs[t].elems, result[i].results);
                                if (result[i].has_more) $scope.tabs[t].next_page = 2;
                                t++;
                            }
                            if (stars) {
                                for (i = 4; i >= 0; i--) if (result[i].results.length > 0) {
                                    $scope.tabs[t] = {elems: [], value: i + 1, heading: '<span class="star-rating">'};
                                    for (pg = 0; pg <= i; pg++) $scope.tabs[t].heading += '<i class="fa fa-star"></i>';
                                    $scope.tabs[t].heading += '</span>'; //$scope.tabs[t].heading.slice(1)
                                    load();
                                }
                            } else for (i = 0; i < 2; i++) if (result[i].results.length > 0) {
                                $scope.tabs[t] = {elems: [], value: i + 1, heading: i == 0 ? gettext("Liked by") : gettext("Disiked by")};
                                load();
                            }
                        } else $scope.tabs[0] = {elems: []};
                    }
                    if (!st || $scope.loaded !== undefined) {
                        $scope.tabs[i].elems.push.apply($scope.tabs[i].elems, result.results);
                        if ($scope.tabs[i].next_page === undefined) pg = 1; else pg = $scope.tabs[i].next_page + 1;
                        if (result.page_count != pg) $scope.tabs[i].next_page = pg; else if ($scope.tabs[i].next_page !== undefined) delete $scope.tabs[i].next_page;
                    }
                }
                $timeout(function(){ $scope.loaded = true });
            }
            if (t.init) o.query(t, f); else o.get(t, f);
        })();
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
                        n = 'emails';
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
                    case 9:
                        n = 'businesses';
                        break;
                    case 10:
                        n = 'feed';
                        break;
                    case 11:
                        n = 'home';
                        break;
                    case 12:
                        n = 'account';
                        break;
                    case 13:
                        n = 'manager';
                        break;
                    default: n = 'users'
                }
                return $resource('/api/'+n+'/:id/?format=json:m', {id: '@object_id'},
                {
                    'get': {method: 'GET'},
                    'query': {method: 'GET', isArray: true},
                    'save': {
                        method: 'POST',
                        transformRequest: function (data) {
                            delete data.m;
                            return JSON.stringify(data);
                        },
                        params: {m: '@m'}
                    },
                    'update': {method: 'PUT'},
                    'partial_update': {method: 'PATCH'},
                    'partial_update_a': {method: 'PATCH', isArray: true},
                    'delete': {method: 'DELETE'}
                });
            }
        }
    })

    .factory('makeFriendService', function ($timeout, APIService) { //, $q
        var friendService = APIService.init(), loading;
        function l() { $timeout(function() { loading = false }) }

        return {
            /*config: function (u) {
                u.rel_state_msg = "Are you sure that you want to ";
                switch (u.rel_state) {
                    case 0:
                        u.rel_state_msg += "send a friend request to this person?";
                        break;
                    case 1:
                        u.rel_state_msg += "cancel the friend request to this person?";
                        break;
                    case 2:
                        u.rel_state_msg += "accept the friend request from this person?";
                        break;
                    case 3:
                        u.rel_state_msg += "remove from friends this person?";
                }
                return $q.when();
            },*/
            run: function (u, id) {
                if (loading) return;
                loading = true;
                //var c = this.config;
                switch (u.rel_state) {
                    case 0:
                    case 2:
                        friendService.save({to_person: id || u.id || u.target.id},
                            function () {
                                u.rel_state++;
                                //c(u);
                                if (u.rel_state == 3) if (u.friend_count.length !== undefined) u.friend_count[0]++; else u.friend_count++;
                                l();
                            });
                        break;
                    default:
                        friendService.delete({id: id || u.id || u.target.id},
                            function () {
                                if (u.rel_state == 3) if (u.friend_count.length !== undefined) u.friend_count[0]--; else u.friend_count--;
                                u.rel_state = 0;
                                //c(u);
                                l();
                            });
                }
            }
        }
    })

    .factory('uniService', function ($q, $timeout, $injector, APIService, COMMENT_PAGE_SIZE, CONTENT_TYPES, dialogService, USER){
        var u = false, ld = {}, likeService = APIService.init(3), commentService = APIService.init(7), services = {}; //, rs = false

        function getService(name, func) {
            if (services[name] === undefined) services[name] = $injector.get(name);
            if (func !== undefined) func(); else return services[name];
        }

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
                    break;
                case 'business':
                    this.s = APIService.init(9);
                    break;
                case 'user':
                    this.s = APIService.init();
                    break;
                default: this.u = {event: APIService.init(2), item: APIService.init(8), comment: commentService, business: APIService.init(9), user: APIService.init(), feed: APIService.init(10)};
            }
            this.page_offset = 1;
            this.remids = [];
            this.unloaded = [false, false];
        }

        UniObj.prototype.remove = function (e, index, r, l) {
            if (r) if (!this.menu) {
                for (var i = 0; i < this.objs[0].length; i++) if (this.objs[0][i].id == e[index].id) {
                    this.objs[0].splice(i, 1);
                    break;
                }
            } else getService('menuService').del(e[index].category, e[index].id);
            if (l) this.remids.push(e[index].id);
            if (!r || !u) e.splice(index, 1);
        };

        UniObj.prototype.getobjs = function (t, n) {
            if (t === undefined) return this.objs[2];
            var e;
            e = t ? this.objs[1] : this.objs[0];
            if (n == undefined) {
                e.length = 0;
                if (!t) {
                    this.page_offset = 1;
                    delete this.props.has_next_page;
                    ld = {};
                    if (services.markerService !== undefined) services.markerService.markers.length = 0;
                }
            }
            this.unloaded[t ? 1 : 0] = n === null;
            return n !== null ? e : $q.when();
        };
        UniObj.prototype.props = {};

        UniObj.prototype.load = function (b, rel_state, cn) {
            var ids = null, self = this, d, i, j;
            if (b !== undefined) if (angular.isArray(b)) {
                function showc(i) {
                    if (self.objs[1][i].showcomm === undefined) {
                        self.objs[1][i].showcomm = [[false, true], true];
                        self.loadComments(i, true).then(function l() { if (!self.unloaded[1]) $timeout(function () { if (!self.unloaded[1]) self.objs[1][i].showcomm[0][0] = true }) });
                    } else self.objs[1][i].showcomm[1] = true;
                }
                var p;
                ids = '';
                for (i = 0; i < b.length && b[i] !== undefined; i++) {
                    p = false;
                    for (j = i + 1; j < b.length; j++) if (b[j] == b[i]) {
                        delete b[i];
                        p = true;
                    }
                    if (!p) { // && /^\d+$/.test(b[i])
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
            }
            if (ids == '') return $q.when(); else if (ids == null) {
                if (cn !== undefined) {
                    ld.position = cn.longitude+','+cn.latitude;
                    if (this.page_offset > 1) {
                        this.page_offset = 1 - (services.SEARCH_PAGE_SIZE !== undefined);
                        cn = null;
                    }
                }
                this.unloaded[0] = false;
                if (this.props.has_next_page !== undefined) if (services.SEARCH_PAGE_SIZE !== undefined) ld.offset = this.page_offset; else ld.page = this.page_offset;
                if (b !== undefined) if (typeof(b) == 'string') ld.search = b; else ld.id = b;
                if (rel_state === true) ld.favourites = 1; else if (rel_state !== undefined) {
                    u = rel_state == null;
                    ld.is_person = 1;
                    //rs = true;
                }
                if (this.page_offset == 1 && this.objs[2] == 'comment') ld.content_type = CONTENT_TYPES['business'];
                function appendResults(results) {
                    if (cn === null) if (results.length > 0) for (i = self.objs[0].length - 1; i >= 0; i--) {
                        for (j = results.length - 1; j >= 0; j--) if (self.u !== undefined ? self.objs[0][i].type == results[j].type && (self.objs[0][i].target !== undefined ? self.objs[0][i].friend.id == results[j].friend.id && self.objs[0][i].target.id == results[j].target.id : self.objs[0][i].id == results[j].id) : self.objs[0][i].id == results[j].id) {
                            if (results[j].distance !== undefined) {
                                self.objs[0][i].distance.value = results[j].distance.value;
                                self.objs[0][i].distance.unit = results[j].distance.unit;
                            }
                            results.splice(j, 1);
                            ids = true;
                            break;
                        }
                        if (ids) {
                            if (results.length == 0) break;
                            ids = false;
                        } else self.objs[0].splice(i, 1);
                    } else self.objs[0].length = 0;
                    self.objs[0].push.apply(self.objs[0], results);
                    if (cn === null && self.u === undefined) self.objs[0].sort(dynamicSortMultiple('-distance.unit', 'distance.value')); //change (for another language)
                }
                if (this.page_offset > 1 || b !== undefined || rel_state !== undefined || this.u !== undefined) d = (this.s || this.u.feed).get(ld,
                    function (result) {
                        if (self.unloaded[0]) return;
                        appendResults(result.results);
                        if (result.count !== undefined) {
                            getService('SEARCH_PAGE_SIZE', function (){ self.page_offset = 0 });
                            self.page_offset += services.SEARCH_PAGE_SIZE;
                            self.props.has_next_page = result.count > self.page_offset;
                        } else {
                            self.props.has_next_page = result.page_count > self.page_offset;
                            self.page_offset++;
                        }
                        if ((services.markerService !== undefined || result.results.length > 0) && (ld.favourites == 1 || self.u !== undefined || result.count > 0 && (result.results[0].location !== undefined || result.results[0].business !== undefined && result.results[0].business.location !== undefined))) getService('markerService').load(result.results, self.u !== undefined);
                }); else {
                    d = APIService.init(11).query(ld,
                        function (result) {
                            if (self.unloaded[0]) return;
                            USER.deftz = result[0];
                            if (services.markerService !== undefined || result[1].results.length > 0) getService('markerService').load(result[1].results, null);
                            appendResults(result[2].results);
                            self.props.has_next_page = result[2].has_more;
                            self.page_offset++;
                        });
                }
                return d.$promise;
            } else {
                d = this; cn = cn ? this.menu || null : null;
                return this.s.query({ids: ids, no_business: cn, has_img_ind: cn}, function (result) {
                    if (d.unloaded[1]) return;
                    d.objs[1].push.apply(d.objs[1], result);
                    if (rel_state) for (i = 0; i < d.objs[1].length; i++) showc(i);
                }).$promise
            }
        };

        UniObj.prototype.new = function() {
            var self = this, d;
            switch (this.objs[2]) {
                case 'event':
                    d = {text: arguments[0], when: arguments[1]};
                    break;
                case 'comment':
                    d = {text: arguments[0], stars: arguments[1], object_id: arguments[2], content_type: CONTENT_TYPES['business']};
            }
            return this.s.save(d, function (result){ if (!self.unloaded[0]) self.objs[0].unshift(result) }).$promise;
        };

        UniObj.prototype.del = function (index, r, par_ind, p) {
            var e = r ? this.objs[1] : this.objs[0], self = this;
            if (par_ind !== undefined) {
                if (r || index == null) var objs = [this.objs[0]];
                e = e[par_ind];
                var id = [e.id];
                if (index == null) {
                    if (r) objs.push(this.objs[1]);
                    id.push(e.main_comment.id);
                } else id.push(e[p][index].id);
                return commentService.delete({id: id[1]}, function (result) {
                    if (self.unloaded[r ? 1 : 0]) return;
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
                var is_item = e[index].name !== undefined;
                return (this.s || this.u[e[index].type]).delete({id: e[index].id}, function (){
                    if (!self.unloaded[r ? 1 : 0]) self.remove(e, index, r);
                }, function (result){
                    if (is_item && result.data !== undefined && result.data.non_field_errors !== undefined) dialogService.show(gettext("You can't delete the last remaining item!"), false);
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
                s = likeService.delete({content_type: CONTENT_TYPES[e[index].type || this.objs[2]], id: id});
                status = 0;
            } else {
                var d = {content_type: CONTENT_TYPES[e[index].type || this.objs[2]], object_id: id};
                if (isl) d.is_dislike = dislike_stars; else d.stars = dislike_stars;
                s = old_status > 0 ? likeService.update(d) : likeService.save(d);
                status = isl ? dislike_stars ? 2 : 1 : dislike_stars;
            }
            var self = this;
            return s.$promise.then(
                function () {
                    if (self.unloaded[r ? 1 : 0]) return;
                    if (status != 0) {
                        if (isl) {
                            if (status == 1) {
                                e[index].likestars_count++;
                                if (old_status == 2) e[index].dislike_count--;
                            } else {
                                e[index].dislike_count++;
                                if (old_status == 1) e[index].likestars_count--;
                            }
                        }
                        if (!r && u) {
                            e[index].person_status[0] = status;
                            e[index].person_status[1] = new Date();
                        }
                    } else if ((par_ind !== undefined || r || !u) && isl) if (old_status == 1) e[index].likestars_count--; else if (old_status == 2) e[index].dislike_count--;
                    if (par_ind !== undefined || r || !u || status != 0) e[index].curruser_status = status;
                    var i;
                    if (self.objs[0] !== undefined && (r || par_ind !== undefined)) {
                        var obj;
                        if (!u || status != 0 || par_ind !== undefined) {
                            var objs = [self.objs[0]];
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
                                if (isl) obj.dislike_count = e[index].dislike_count;
                                obj.curruser_status = status;
                                if (u) {
                                    obj.person_status[0] = status;
                                    obj.person_status[1] = e[index].person_status[1];
                                }
                                if (!isl) var k = [obj.comments, obj.user_comments];
                                break;
                            }
                        }
                        if (par_ind === undefined && u && status != 0 && old_status == 0) for (i = 0; i < self.remids.length; i++) if (self.remids[i] == id) {
                            self.remids.splice(i, 1);
                            obj = angular.copy(e[index]);
                            obj.person_status[0] = status;
                            obj.person_status[1] = new Date();
                            self.objs[0].push(obj);
                            self.objs[0].sort(dynamicSortMultiple('-person_status.1/created', '-id'));
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
            var p = commentService.get({content_type: CONTENT_TYPES[e.type || this.objs[2]], id: e.id, offset: o ? e.offset : (e.comments !== undefined ? e.comments.length : 0) - (a ? l : 0), limit: l, reverse: !o || null},
                function (result){
                    if (self.unloaded[r ? 1 : 0]) return;
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
                    if (self.unloaded[r ? 1 : 0]) return;
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
            var e = (r ? this.objs[1] : this.objs[0])[index], self = this;
            if (r) var objs = this.objs[0];
            return commentService.save({content_type: CONTENT_TYPES[e.type || this.objs[2]], object_id: e.id, text: txt, status: e.status !== undefined ? e.status.value : null},
                function (result){
                    if (self.unloaded[r ? 1 : 0]) return;
                    if (e.user_comments === undefined) e.user_comments = [];
                    e.user_comments.push(result);
                    if (result.manager_stars.status !== undefined) if (e.main_comment == null) e.main_comment = angular.copy(result); else angular.copy(result, e.main_comment);
                    e.offset++;
                    e.comment_count++;
                    if (r) for (var i = 0; i < objs.length; i++) if (objs[i].id == e.id) {
                        if (objs[i].user_comments !== undefined) {
                            objs[i].user_comments.push(result);
                            if (result.manager_stars.status !== undefined) if (objs[i].main_comment == null) objs[i].main_comment = angular.copy(result); else angular.copy(result, objs[i].main_comment);
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

    .controller('BaseCtrl', function ($scope, $timeout, objService, usersModalService, COMMENT_PAGE_SIZE) {
        $scope.r = $scope.$parent.objs !== undefined;
        $scope.objs = $scope.r ? $scope.$parent.objs : objService[0].getobjs(false, false);
        if (!$scope.r) { // && $scope.objs.length == 0
            $scope.props = objService[0].props;
            function l() { $timeout(function() { $scope.loading = false })}
            function load(s) { //$timeout(function() {
                if (s || $scope.$parent.t == 'user') $scope.$parent.$parent.$parent.$parent.loading = undefined;
                else if ($scope.loading) {
                    $timeout(load, 100 + Math.floor(Math.random() * 10));
                    return;
                }
                $scope.loading = true;
                objService[0].load($scope.id || $scope.keywords, $scope.u ? $scope.u.rel_state !== undefined ? false : null : $scope.is_fav, $scope.$parent.t != 'user' ? $scope.coords : undefined).then(function() {
                    l();
                    if (objService.length == 2) objService[1]();
                } /*function () { $timeout(function () { if ($scope.objs.length == 0) $scope.enableAnimation() }) }*/);
            /*})*/}
            if ($scope.$parent.t == 'user' || $scope.$parent.$parent.$parent.$parent.loading === undefined) load();
            $scope.load_page = function (){
                if ($scope.wid !== undefined) {
                    navigator.geolocation.clearWatch($scope.wid);
                    $scope.$parent.$parent.$parent.$parent.wid = undefined;
                }
                $scope.loading = true;
                objService[0].load().then(l, l);
            };
        }

        if (!$scope.r) $scope.$on('$destroy', function() { objService[0].getobjs($scope.r, null) });

        if ($scope.$parent.t == 'user') return;

        if (angular.element('#home_map').length == 1) $scope.load = load;

        $scope.showDisLikes = function (index, par_ind) { if (par_ind === undefined) usersModalService.setAndOpen($scope.objs[index].id, $scope.objs[index].type || objService[0].getobjs()); else if (index != null) usersModalService.setAndOpen($scope.objs[par_ind].comments[index].id, 'comment'); else usersModalService.setAndOpen($scope.objs[par_ind].main_comment.id, 'comment') };

        $scope.toggleHr = function (f, l) { if (f) if (l) return $scope.checkAnim(); else return true; else return false };

        var loading;
        $scope.giveDisLike = function(index, dislike, par_ind) {
            if (loading) return;
            loading = true;
            function l(){ $timeout(function () { loading = false }) }
            return objService[0].setLikeStatus(index, $scope.r, dislike, par_ind).then(l, l);
        };

        if ($scope.$parent.t == 'business') return;

        $scope.checkAnim = function () { return angular.element('.objs'+$scope.r+'_'+$scope.$parent.t+' > [class*=\'ng-leave\']').length };

        $scope.delete = function (index, par_ind, p){ objService[0].del(index, $scope.r, par_ind, p).then(function () { if (objService.length == 2) objService[1](true) }) }; //... > 1)

        $scope.com = [[gettext("Load older"), 'comments', 0], [gettext("Load newer"), 'user_comments', 1]];

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
            var el = angular.element('#'+$scope.$parent.t+index), bu = angular.element('#'+$scope.$parent.t+index+'b');
            bu.attr('disabled', true);
            if (el.val() != '') objService[0].submitComment(index, el.val(), $scope.r).then(
                function () {
                    el.val('');
                    bu.attr('disabled', false);
                    if ($scope.objs[index].status !== undefined && $scope.objs[index].status != $scope.choices[0]) $scope.objs[index].status = $scope.choices[0]; //if (objService.length == 3) objService[2](index);
                }, function () { bu.attr('disabled', false) })
        }
    })

    .controller('EventsCtrl', function($scope, $rootScope, $timeout, usersModalService, APIService) {
        $scope.notifySelect = function (index){ usersModalService.setAndOpen(null, 0, $scope.objs[index].id) };

        $scope.isFuture = function (index) { return (new Date($scope.objs[index].when)).valueOf() > $rootScope.currTime };

        function subTime(d,h,m,v){
            var r = new Date(d);
            r.setHours(d.getHours()-h);
            r.setMinutes(d.getMinutes()-m);
            r.setSeconds(0, 0);
            return v ? r.valueOf() : r;
        }
        var when, id, index;
        $scope.cmb = {choices: [gettext("(Custom)")]};
        $scope.picker = {options: {minDate: subTime($rootScope.currTime, 0, -1)}};
        $scope.initRmn = function (ind){
            if (id !== undefined && $scope.objs[ind].id == id) return;
            id = $scope.objs[ind].id; index = ind;
            when = new Date($scope.objs[index].when);
            $scope.picker.options.maxDate = when;
            $scope.cmb.choices.length = 1;
            var md = $scope.picker.options.minDate.valueOf();
            if (subTime(when, 0, 15, true) > md) $scope.cmb.choices.push(gettext("15 minutes"));
            if (subTime(when, 0, 30, true) > md) $scope.cmb.choices.push(gettext("Half an hour"));
            for (var i = 2; i >= 0; i--) if ($scope.cmb.choices.length >= i + 1) {
                if ($scope.cmb.selected != $scope.cmb.choices[i]) $scope.cmb.selected = $scope.cmb.choices[i]; else checkSel();
                break;
            }
            if (subTime(when, 0, 45, true) > md) $scope.cmb.choices.push(gettext("45 minutes"));
            if (subTime(when, 1, 0, true) > md) $scope.cmb.choices.push(gettext("An hour"));
            if (subTime(when, 2, 0, true) > md) $scope.cmb.choices.push(gettext("2 hours"));
            if (subTime(when, 3, 0, true) > md) $scope.cmb.choices.push(gettext("3 hours"));
            if (subTime(when, 4, 0, true) > md) $scope.cmb.choices.push(gettext("4 hours"));
            if (subTime(when, 5, 0, true) > md) $scope.cmb.choices.push(gettext("5 hours"));
            if (subTime(when, 6, 0, true) > md) $scope.cmb.choices.push(gettext("Half a day"));
            if (subTime(when, 24, 0, true) > md) $scope.cmb.choices.push(gettext("A day"));
            if (subTime(when, 48, 0, true) > md) $scope.cmb.choices.push(gettext("2 days"));
            if (subTime(when, 72, 0, true) > md) $scope.cmb.choices.push(gettext("3 days"));
            if (subTime(when, 96, 0, true) > md) $scope.cmb.choices.push(gettext("4 days"));
            if (subTime(when, 120, 0, true) > md) $scope.cmb.choices.push(gettext("5 days"));
            if (subTime(when, 144, 0, true) > md) $scope.cmb.choices.push(gettext("6 days"));
            if (subTime(when, 168, 0, true) > md) $scope.cmb.choices.push(gettext("A week"));
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
            if (value === undefined) {
                if ($scope.cmb.selected != $scope.cmb.choices[0]) $scope.cmb.selected = $scope.cmb.choices[0];
                return;
            }
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
            if (chk(168, 0)) return;
            if ($scope.cmb.selected != $scope.cmb.choices[0]) $scope.cmb.selected = $scope.cmb.choices[0];
        });

        var reminderService = APIService.init(6);
        $scope.setReminder = function ($event){
            $event.stopPropagation();
            $scope.working = true;
            $rootScope.currTime = new Date();
            var curr = subTime($rootScope.currTime, 0, -1);
            if ($scope.picker.date === undefined || $scope.picker.date < curr) $scope.picker.date = curr;
            $scope.picker.options.minDate = curr;
            reminderService.save({object_id: $scope.objs[index].id, when: $scope.picker.date},
                function (){
                    $scope.cmb.opened[index] = false;
                    $timeout(function () { $scope.working = false });
                },
                function () { $scope.working = false });
        };
    })

    .controller('ItemsCtrl', function($scope, USER) { $scope.user_curr = USER.currency })

    .controller('ReviewsCtrl', function($scope, REVIEW_STATUS) { $scope.choices = REVIEW_STATUS }) //, $injector) { ... }) //change

    .controller('eventsOnlyCtrl', function ($scope, $controller, eventService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [eventService]}), $controller('EventsCtrl', {$scope: $scope})) })

    .controller('itemsOnlyCtrl', function($scope, $controller, itemService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [itemService]}), $controller('ItemsCtrl', {$scope: $scope})) })

    .controller('reviewsOnlyCtrl', function ($scope, $controller, reviewService) { angular.extend(this, $controller('BaseCtrl', {$scope: $scope, objService: [reviewService, function (del){
        var p = $scope.$parent.$parent.$parent.$parent.$parent;
        if (!$scope.r && p.fav_state !== undefined && p.fav_state != -1) {
            p.showrevf = $scope.objs.length == 0 || $scope.objs[0].curruser_status != -1;
            if (del) p.rating.user = 0;
        }
    }]}), $controller('ReviewsCtrl', {$scope: $scope})); /*, function (index) { if ($scope.objs[index].status != $scope.choices[0]) $scope.objs[index].status = $scope.choices[0] }*/ })

    .controller('MainCtrl', function($rootScope, $window, $scope, $uibModal, $aside, $timeout, $controller, usersModalService, APIService, NOTIF_PAGE_SIZE) { //, $interval
        angular.extend(this, $controller('BaseMainCtrl', {$scope: $scope}));

        $rootScope.title = $window.document.title;
        $rootScope.currTime = new Date();
        $scope.showOffcanvas = function (){
            $aside.open({
                size: 'sm',
                templateUrl: 'offcanvas',
                scope: $scope,
                windowClass: 'oc',
                placement: 'right',
                controller: function ($scope, $uibModal, $uibModalInstance, BASE_MODAL) { /*, $css*/
                    /*$css.add('/static/main/css/sett.css');*/
                    $scope.showSettModal = function (index) {
                        $uibModal.open({
                            size: 'lg',
                            templateUrl: BASE_MODAL,
                            windowClass: 'sett',
                            controller: 'SettModalCtrl',
                            resolve: { index: function (){ return index || 0 } }
                        });
                    };
                    $scope.close = function() {
                        $uibModalInstance.dismiss('cancel');
                        delete $scope.close;
                    };
                    $scope.c = function() { if ($scope.close !== undefined) $scope.close() };
                    $scope.$on('$stateChangeStart', function() { $scope.c() });
                }
            });
        };

        $scope.showFavouritesModal = function (id, t){ usersModalService.setAndOpen(id === null ? null : (id || $scope.id), t ? 2 : 1) };
        $scope.showFriendsModal = function (id){ usersModalService.setAndOpen(id === null ? null : (id || $scope.id), 0) };

        $scope.co = function (e, k, r){ if (e[k] === (r ? true : false)) e[k] = r ? false : true };

        // Search

        var bsearchService = APIService.init(9);
        $scope.search = {show: false, keywords: '', count: null, loading: false, results: [],
            func: function () {
                $scope.search.count = null;
                if ($scope.search.keywords != '') {
                    $scope.search.show = true;
                    $scope.search.loading = true;
                    bsearchService.get({search: $scope.search.keywords, limit: 5},
                        function (result) {
                            $scope.search.results.length = 0;
                            if (result.results.length > 0) $scope.search.results.push.apply($scope.search.results, result.results);
                            $scope.search.count = result.count;
                            $timeout(function () { $scope.search.loading = false });
                            $scope.search.chngl();
                        },
                        function () {
                            $scope.search.results.length = 0;
                            $scope.search.loading = false;
                            $scope.search.chngl();
                        }
                    );
                } else {
                    $scope.search.show = false;
                    $scope.search.results.length = 0;
                }
            },
            chngl: function () {
                $timeout(function (){
                    var e = angular.element('#quicks');
                    if (e.offset().left + e.outerWidth() > angular.element(window).width()) e.css('left', angular.element(window).width() > e.outerWidth() ? (angular.element(window).width() - e.outerWidth()) / 2 : 0); else if (e.offset().left != angular.element('#sr').offset().left && angular.element('#sr').offset().left + e.outerWidth() < angular.element(window).width()) e.css('left', angular.element('#sr').offset().left);
                });
            }
        };

        // Notfication system

        var notifService = APIService.init(4);

        $scope.notif_loading = false;
        $scope.notifs = [];
        var ids = '', frse, u = 0;
        ($scope.getNotifs = function (notick) {
            if (notick) {
                $scope.notif_loading = true;
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
                    if ($scope.opened) $scope.setSize(true);
                    if ($scope.notif_loading) $timeout(function() { $scope.notif_loading = false });
                }
                if (frse === undefined) {
                    frse = false;
                    $scope.getNotifs(true);
                }
            });
            if (!notick) $timeout($scope.getNotifs, 10000);
        })();
        var setScroll = function (e) {
            var popc = e.find('.popover-content');
            if (popc.height() < 18+popc.children('.dt').height()) popc.css('overflow-y', 'scroll'); else popc.css('overflow-y', 'hidden');
        };
        $scope.setSize = function (p) { $timeout(function () {
            var e = angular.element('#notif').next();
            //console.log(angular.element(window).width() - (e.offset().left + e.outerWidth()));
            if (e.offset().left == 0 || e.offset().left == 1 || angular.element(window).width() - (e.offset().left + e.outerWidth()) == 66) {
                //console.log(angular.element(window).width()+' '+(e.width()+66));
                if (angular.element(window).width() <= e.width() + 66) {
                    e.addClass('notif');
                    e.children('.arrow').css('left', angular.element('#nf').offset().left + 6);
                    //e.children('.popover-content').css('white-space', 'normal');
                    setScroll(e); //e = e.find('.popover-content');
                    // angular.element('#nct').scope().$apply(); // if (e.height() < 18+e.children('.dt').height()) e.css('overflow-y', 'scroll'); else e.css('overflow-y', 'hidden');
                } else if (p) setScroll(e);
            } else $scope.setSize(p);
        }, 1000) };
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
            } else $scope.setSize();
            $scope.unread = false;
        });
        function markAllAsRead(){
            $rootScope.sendreq('api/notifications/read/?notxt=1&ids='+ids.slice(1));
            ids = '';
        }
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
                return APIService.init(5).query({}, function (result) { emails.push.apply(emails, result) }).$promise;
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

    .controller('SettModalCtrl', function($rootScope, $scope, $timeout, $uibModalInstance, index, emailService, USER) { //, $animate
        $scope.close = function() { $uibModalInstance.dismiss('cancel') };
        $scope.set_modal_loaded = function (s){ if ($scope.obj.active == 0 || s) $timeout(function() { $scope.modal_loaded = true; if (s) delete $scope.set_modal_loaded }) };
        $scope.title = gettext("Settings");
        $scope.file = 'settings';
        $scope.obj = {active: index, pass: [], email: undefined, selected: 0};
        $scope.user = USER;
        //$scope.enableAnimation = function (){ console.log(angular.element('.nji')[0]); $animate.enabled(angular.element('.nji')[0], true) };

        // Email

        //var load;
        var deact = $scope.$watch('obj.active', function (value) {
            if (value == 0 && $scope.emails === undefined) {
                //$scope.obj.selected = 0;
                $scope.emails = emailService.emails;
                $scope.sent = [];
                //if ($scope.emails.length == 0) {
                    //load = true;
                emailService.load().then(function (){ $timeout(function() { $scope.loaded = true; /*load = false*/ }) });
                $scope.addEmail = function () {
                    if ($scope.obj.email == '' || $scope.obj.email === undefined) return;
                    for (var e in $scope.emails) if ($scope.emails[e].email == $scope.obj.email) return;
                    $scope.obj.adding = true;
                    emailService.add($scope.obj.email).then(function (){
                        $scope.sent.push($scope.obj.email);
                        $scope.obj.email = '';
                        delete $scope.obj.adding;
                    }, function (){ delete $scope.obj.adding });
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

                $scope.$on('$destroy', function() { $scope.emails.length = 0 });

                // Password

                $scope.dismissError = function (){
                    delete $scope.pass_err;
                    delete $scope.pass_err_txt;
                };
                $scope.changePassword = function () {
                    for (var i = 0; i < 3; i++) if ($scope.obj.pass[i] === undefined) return; //!$scope.changepw.$valid
                    var pw_fields = angular.element('input[type="password"]');
                    if ($scope.obj.pass[1] != $scope.obj.pass[2]) {
                        //if ($scope.pass_err != 4) {
                        $scope.pass_err_txt = gettext("New password fields don't match.");
                        $scope.pass_err = 4;
                        pw_fields[2].focus();
                        //}
                        return;
                    }
                    /*if ($scope.obj.pass[0] == $scope.obj.pass[1]) {
                        //var t = "Your new password matches the current password, enter a different one.";
                        //if ($scope.pass_err_txt != t) {
                        $scope.pass_err_txt = "Your new password matches the current entered password, so use a different one."; //t
                        $scope.pass_err = 2;
                        pw_fields[1].focus();
                        //}
                        return;
                    }*/
                    $scope.dismissError();
                    $scope.obj.changing = true;
                    $rootScope.sendreq('password/', 'oldpassword='+$scope.obj.pass[0]+'&password1='+$scope.obj.pass[1]+'&password2='+$scope.obj.pass[2]).then(function (){
                        $scope.pass_err = 0;
                        for (i = 0; i < 3; i++) $scope.obj.pass[i] = '';
                        delete $scope.obj.changing;
                    }, function (response){
                        if (response.data !== undefined && response.data.form_errors !== undefined) {
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
                            delete $scope.obj.changing;
                        }
                    });
                };
            } else if (value == 1 && $scope.setD === undefined) {
                $scope.modal_loaded = false;
                $scope.submitLocal = function (){
                    $scope.obj.saving = true;
                    $rootScope.sendreq('i18n/', 'language='+USER.language+'&currency='+USER.currency+'&tz='+USER.tz).then(function (response){
                        delete $scope.obj.saving;
                        if (response.data.altered.length > 0) $scope.$parent.refresh = true;
                    }, function (){ delete $scope.obj.saving });
                };
                $scope.setD = function (p, v) { if (USER[p] === undefined) USER[p] = v }
            } else deact();
        });
    });