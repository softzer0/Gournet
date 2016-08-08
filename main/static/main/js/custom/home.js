const COMMENT_PAGE_SIZE = 4;

var app = angular.module('mainApp', ['ui.bootstrap', 'nya.bootstrap.select', 'ngResource', 'ngAside', 'yaru22.angular-timeago', 'ngFitText', 'ngAnimate', 'ui.router', 'ui.router.modal', 'ui.bootstrap.datetimepicker', 'datetime']) /*, 'oc.lazyLoad', 'angularCSS'*/
    .config(function($httpProvider, $animateProvider, $stateProvider, timeAgoSettings) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $animateProvider.classNameFilter(/(angular-animate|tab-pane)/);
        timeAgoSettings.allowFuture = true;

        $stateProvider
            .state('main', { url: '/' })
            .state('main.showEvents', {
                url: 'show=:ids',
                modal: true,
                templateUrl: '/static/main/modals/base.html',
                size: 'lg',
                controller: function ($scope, $uibModalInstance, $state, $stateParams, $timeout, eventService) {
                    $scope.title = "Events";
                    $scope.file = 'events';

                    $scope.close = function() { $uibModalInstance.dismiss('cancel') };
                    $scope.set_modal_loaded = function (){
                        var unregister = $scope.$watch(function() { return angular.element('.loaded').length }, function() {
                            if (angular.element('.loaded').length > 0) {
                                unregister();
                                $scope.modal_loaded = true;
                            }
                        });
                    };
                    $scope.set_loaded = function (){ $scope.loaded = true; };

                    $scope.events = eventService.events(true);
                    eventService.load($stateParams.ids.split(',')).then(
                        function () { $timeout(function () {
                            if ($scope.events.length == 0) {
                                $scope.set_loaded();
                                //$scope.enableAnimation();
                            }
                        })
                    });
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
            show: function (message, OkOnly, OkCancel) {
                return $uibModal.open({
                    windowTopClass: 'modal-confirm',
                    template: '<div class="modal-body">' + message + '</div><div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">'+(!OkCancel ? 'Yes' : 'OK')+'</button>'+(!OkOnly ? '<button class="btn btn-warning" ng-click="cancel()">'+(!OkCancel ? 'No' : 'Cancel')+'</button></div>':''),
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
                    var OkOnly = attrs.ngDialogOkonly || false;
                    dialogService.show(attrs.ngDialogMessage || "Are you sure?", OkOnly, OkOnly || attrs.ngDialogOkcancel || false).then(function() { scope.ngDialogClick() }/*, function() {}*/);
                });
            }
        }
    })

    .factory('usersModalService', function($uibModal) {
        var params = {};
        
        return {
            params: params,
            setAndOpen: function(id, type, event) {
                params.id = id;
                params.type = type;
                var n;
                if (type != 3) n = 'friends'; else n = 'likes';
                $uibModal.open({
                    size: 'lg',
                    templateUrl: '/static/main/modals/base.html',
                    controller: 'UsersModalCtrl',
                    resolve: {
                        file: function () { return n },
                        event: function () { return event }
                    }
                });
            }
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
                return $resource('/api/'+n+'/:id/?format=json', {}, //id: "@event"
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
        var itemService = APIService.init(8), menu = [
            {category: "Alcoholic beverages", content: [
                {category: "Ciders", show: false, content: []},
                {category: "Whiskeys", show: false, content: []},
                {category: "Wines", show: false, content: []},
                {category: "Beers", show: false, content: []},
                {category: "Vodkas", show: false, content: []},
                {category: "Brandy", show: false, content: []},
                {category: "Liqueurs", show: false, content: []},
                {category: "Cocktails", show: false, content: []},
                {category: "Tequilas", show: false, content: []},
                {category: "Gin", show: false, content: []},
                {category: "Rum", show: false, content: []}
            ]},
            {category: "Other drinks", content: [
                {category: "Coffee", show: false, content: []},
                {category: "Soft drinks", show: false, content: []},
                {category: "Juices", show: false, content: []},
                {category: "Teas", show: false, content: []},
                {category: "Hot chocolate", show: false, content: []},
                {category: "Water", show: false, content: []}
            ]},
            {category: "Food", content: [
                {category: "Fast food", show: false, content: []},
                {category: "Meals", show: false, content: []},
                {category: "Barbecue", show: false, content: []},
                {category: "Seafood", show: false, content: []},
                {category: "Salads", show: false, content: []},
                {category: "Desserts", show: false, content: []}
            ]}
        ], category = {
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
            'meal': menu[2].content[1].content,
            'barbecue': menu[2].content[2].content,
            'seafood': menu[2].content[3].content,
            'salad': menu[2].content[4].content,
            'dessert': menu[2].content[5].content
        };

        return {
            menu: menu,
            load: function (id){
                return itemService.query({id: id},
                    function (result){
                        var i, c = result[0].category;
                        for (i = 0; i < result.length; i++){
                            if (c != result[i].category) c = result[i].category;
                            delete result[i].category;
                            category[c].push(result[i]);
                        }
                        category = null;
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
                        if (menu[0].category == "Other drinks") menu[0].category = "Drinks"; //if (menu.length)
                    }
                ).$promise;
            }
        }
    })

    .factory('eventService', function ($q, APIService){
        var events = [[],[]], page_num = 1, id = null, s = APIService.init(2), likeService = APIService.init(3), commentService = APIService.init(7), u = false, remids = [];

        function dynamicSort(property) {
            var sortOrder;
            if(property[0] === '-') {
                sortOrder = -1;
                property = property.substr(1);
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

        function remove(e, index, r) {
            if (r) for (var i = 0; i < events[0].length; i++) if (events[0][i].id == e[index].id) {
                events[0].splice(i, 1);
                break;
            }
            if (!r || !u) e.splice(index, 1); else remids.push(e[index].id);
        }

        return {
            events: function (t, n) {
                var e;
                e = t ? events[1] : events[0];
                if (n === undefined) e.length = 0;
                return e;
            },
            load: function (b, rel_state){
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
                        if (!p) if (/^\d+$/.test(b[i])) {
                            for (d in events[0]) if (events[0][d].id == b[i]) {
                                var ev = jQuery.extend(true, {}, events[0][d]);
                                delete ev.comments;
                                delete ev.user_comments;
                                events[1].push(ev);
                                p = true;
                                break;
                            }
                            if (!p) ids += ','+b[i];
                        }
                    }
                    ids = ids.substr(1);
                } else id = b;
                d = {page: page_num, ids: ids};
                if (ids == '') return $q.when(); else if (ids == null) d.id = id;
                if (rel_state !== undefined) {
                    u = rel_state == -1;
                    d.user = 1;
                }
                return s.get(d,
                    function (result){
                        var e;
                        e = ids == null ? events[0] : events[1];
                        e.push.apply(e, result.results);
                        e.has_next_page = result.page_count > page_num;
                        page_num++;
                    }).$promise
            },
            new: function(txt, when) {
                return s.save({text: txt, when: when}, function (result){ events[0].unshift(result) }).$promise
            },
            del: function (index, r, par_ind, p) {
                var e;
                e = r ? events[1] : events[0];
                p = p ? e[par_ind].comments : e[par_ind].user_comments;
                if (par_ind !== undefined) return commentService.delete({id: p[index].id}, function (){
                    p.splice(index, 1);
                    e[par_ind].comment_count--;
                }).$promise; else return s.delete({id: e[index].id}, function (){ remove(e, index, r) }).$promise
            },
            setLikeStatus: function (index, dislike, r) {
                var e;
                e = r ? events[1] : events[0];
                var old_status = e[index].curruser_status, status, s;
                if (old_status == 1 && !dislike || old_status == 2 && dislike) {
                    s = likeService.delete({id: e[index].id});
                    if (u) remove(e, index, r);
                    status = 0;
                } else {
                    var d = {event: e[index].id, is_dislike: dislike};
                    if (old_status > 0) s = likeService.update(d); else s = likeService.save(d);
                    status = dislike ? 2 : 1;
                }
                return s.$promise.then(
                    function (){
                        if (status > 0) {
                            if (status == 1) {
                                e[index].like_count++;
                                if (old_status == 2) e[index].dislike_count--;
                            } else {
                                e[index].dislike_count++;
                                if (old_status == 1) e[index].like_count--;
                            }
                            if (!r && u) e[index].person_status = status;
                        } else {
                            if (!r && u) return;
                            if (old_status == 1) e[index].like_count--; else if (old_status == 2) e[index].dislike_count--;
                        }
                        e[index].curruser_status = status;
                        if (r && u && old_status == 0) for (var i = 0; i < remids.length; i++) if (remids[i] == e[index].id) {
                            remids.splice(i, 1);
                            events[0].push(e[index]);
                            events[0].sort(dynamicSortMultiple('-when', '-id'));
                        }
                    });
            },
            loadComments: function (index, pg, r){
                var e;
                e = (r ? events[1] : events[0])[index];
                return commentService.get({id: e.id, page: pg},
                    function (result){
                        if (!e.hasOwnProperty('comments')) e.comments = [];
                        result.results.splice(0, e.comments.length % COMMENT_PAGE_SIZE);
                        e.comments.push.apply(e.comments, result.results);
                        if (e.hasOwnProperty('user_comments')) for (var i = 0; i < result.results.length; i++) for (var j = 0; j < e.user_comments.length; j++) if (result.results[i].id == e.user_comments[j].id) e.user_comments.splice(j, 1);
                        e.comment_count = result.comment_count;
                    }).$promise;
            },
            submitComment: function (index, txt, r){
                var e;
                e = (r ? events[1] : events[0])[index];
                return commentService.save({event: e.id, text: txt},
                    function (result){
                        if (!e.hasOwnProperty('user_comments')) e.user_comments = [];
                        e.user_comments.push(result);
                        e.comment_count++;
                    }).$promise;
            }
        }
    })

    .factory('eventActionsService', function ($timeout, $uibModal, usersModalService, eventService) {
        var loading, currTime;

        return {
            setCurrTime: function(t) { currTime = (new Date(t)).valueOf() },
            giveDisLike: function(index, dislike, r) {
                if (loading) return;
                loading = true;
                function l(){ $timeout(function () { loading = false }) }
                eventService.setLikeStatus(index, dislike, r).then(l, l);
            },
            delete: function (index, r, par_ind, p){ eventService.del(index, r, par_ind, p) },
            showDisLikes: function (index, r) { usersModalService.setAndOpen(eventService.events(r, true)[index].id, 3) },
            notifySelect: function (index, r){ usersModalService.setAndOpen(null, 0, eventService.events(r, true)[index].id) },
            isFuture: function (index, r) { return (new Date(eventService.events(r, true)[index].when)).valueOf() > currTime },
            toggleHr: function (f, lr) { if (f) if (lr) return angular.element('.events_false .ng-leave').length; else return true; else return false }
        }
    })

    .controller('EventsCtrl', function ($rootScope, $scope, $timeout, APIService, eventService, eventActionsService) {
        $scope.r = $scope.$parent.events !== undefined;
        $scope.events = $scope.r ? $scope.$parent.events : eventService.events();
        $scope.a = eventActionsService;
        $rootScope.$watch('currTime', function (){ $scope.a.setCurrTime($rootScope.currTime) });

        if ($scope.$parent.$parent.$parent != null) var id = $scope.$parent.$parent.$parent.id, r_s = $scope.$parent.$parent.$parent.rel_state;
        if (!$scope.r) {
            $scope.loading = true;
            var l = function() { $scope.loading = false };
            eventService.load(id, r_s).then(l /*function () { $timeout(function () { if ($scope.events.length == 0) $scope.enableAnimation() }) }*/);
            $scope.load_page = function (){
                $scope.loading = true;
                eventService.load().then(l, l);
            };
        }
        
        function subTime(d,h,m,v){
            var r = new Date(d);
            r.setHours(d.getHours()-h);
            r.setMinutes(d.getMinutes()-m);
            r.setSeconds(0, 0);
            if (v) return r.valueOf(); else return r;
        }
        var when, index;
        $scope.cmb = {choices: ["(Custom)"]};
        $scope.picker = {options: {minDate: subTime($rootScope.currTime, 0, -1)}};
        $scope.initRmn = function (ind){
            if (index !== undefined) if ($scope.events[ind].id == $scope.events[index].id) return;
            index = ind;
            when = new Date($scope.events[index].when);
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

        $scope.$watch('cmb.selected', function() { if ($scope.cmb.selected !== undefined) checkSel() });

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

        $scope.$watch('picker.date', function() {
            if ($scope.picker.date === undefined) return;
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
            reminderService.save({event: $scope.events[index].id, when: $scope.picker.date},
                function (){
                    $scope.cmb.opened[index] = false;
                    $timeout(function () { $scope.working = false });
                },
                function () { $scope.working = false });
        };

        $scope.showcomm = [];
        $scope.showComments = function(index) {
            if (!$scope.showcomm.hasOwnProperty(index)) {
                $scope.showcomm[index] = [false, true];
                load_comments(index);
            } else $scope.showcomm[index][1] = !$scope.showcomm[index][1];
        };

        $scope.show_next = function (index){
            if (!$scope.events[index].hasOwnProperty('comments')) return false;
            if ($scope.showcomm[index][0]) {
                if ($scope.events[index].hasOwnProperty('user_comments')) if ($scope.events[index].comment_count == $scope.events[index].comments.length + $scope.events[index].user_comments.length) return false;
                return $scope.events[index].comment_count > $scope.events[index].comments.length;
            } else return false;
        };

        $scope.load_next = function (index){
            $scope.showcomm[index][0] = false;
            load_comments(index);
        };

        function load_comments(index){
            function l() { $timeout(function (){ $scope.showcomm[index][0] = true }) }
            eventService.loadComments(index, $scope.events[index].comments !== undefined ? Math.floor($scope.events[index].comments.length / COMMENT_PAGE_SIZE) + 1 : 1, $scope.r).then(l, l);
        }

        $scope.submitComment = function (index) {
            var el = angular.element('#txt_'+index);
            if (el.val() != '') eventService.submitComment(index, el.val(), $scope.r).then(function () { el.val('') })
        }
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
                controller: function ($scope, $uibModal, $uibModalInstance) { /*, $css*/
                    /*$css.add('/static/main/css/sett.css');*/
                    $scope.showSettModal = function (index) {
                        if (index === undefined) index = 0;
                        $uibModal.open({
                            size: 'lg',
                            templateUrl: '/static/main/modals/base.html',
                            windowTopClass: 'sett',
                            controller: 'SettModalCtrl',
                            resolve: { index: function (){ return index; } }
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
        $scope.$watch('obj.active', function () {
            if ($scope.obj.active == 1 || $scope.emails !== undefined) return;
            //$scope.obj.selected = 0;
            $scope.emails = emailService.emails;
            //if ($scope.emails.length == 0) {
                //load = true;
            emailService.load().then(function (){ $timeout(function() { $scope.loaded = true; /*load = false*/ }) });
            //} else { $scope.loaded = true }
        });
        $scope.$watch('emails.length', function () {
            if ($scope.emails === undefined) return; //load
            $scope.obj.selected = $scope.emails.length-1;
            $scope.EmailSelected();
        });
        $scope.addEmail = function () {
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

        // Password

        $scope.dismissError = function (){
            delete $scope.pass_err;
            delete $scope.pass_err_txt;
        };
        $scope.changePassword = function () {
            //if (!$scope.changepw.$valid) return;
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
            var i = 0;
            $rootScope.sendreq('password/', 'oldpassword='+$scope.obj.pass[0]+'&password1='+$scope.obj.pass[1]+'&password2='+$scope.obj.pass[2]).then(function (){
                $scope.pass_err = 0;
                for (; i < 3; i++) $scope.obj.pass[i] = '';
            }, function (response){
                if (response.data.hasOwnProperty('form_errors')) {
                    var err = 0;
                    $scope.pass_err_txt = '';
                    for (var e in response.data.form_errors) {
                        //if ($scope.pass_err_txt != '') $scope.pass_err_txt += '\r\n';
                        if (e == 'oldpassword') err += 1; else err += 2;
                        for (; i < response.data.form_errors[e].length; i++) {
                            if ($scope.pass_err_txt != ''/*i>0*/) $scope.pass_err_txt += ' ';
                            $scope.pass_err_txt += response.data.form_errors[e][i];
                        }
                    }
                    $scope.pass_err = err;
                    if (err == 1 || err == 3) pw_fields[0].focus(); else pw_fields[1].focus();
                }
            });
        }
    })

    .controller('NotificationCtrl', function ($rootScope, $scope, $timeout, APIService) {
        const NOTIF_PAGE_SIZE = 5;
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
        $scope.$watch('opened', function() {
            if ($scope.opened === undefined) return;
            if ($scope.opened && $scope.unread) {
                markAllAsRead();
                u = 0;
                $rootScope.title = $rootScope.title.substr($rootScope.title.indexOf(' ')+1);
            }
            if (!$scope.opened) {
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
    })

    .controller('UsersModalCtrl', function ($rootScope, $scope, $timeout, $resource, $window, $uibModalInstance, file, event, usersModalService, APIService) {
        $scope.close = function() { $uibModalInstance.dismiss('cancel') };
        $scope.set_modal_loaded = function (){
            var unregister = $scope.$watch(function() { return angular.element('.loaded').length }, function() {
                if (angular.element('.loaded').length > 0) {
                    unregister();
                    $scope.modal_loaded = true;
                }
            });
        };
        $scope.file = file;
        $scope.event = event;
        if ($scope.event !== undefined) $scope.sel_cnt = 0;

        var d = {id: usersModalService.params.id}, t = usersModalService.params.type, o;
        switch (t){
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
            case 3:
                $scope.title = "Reactions";
                o = APIService.init(3);
                break;
            default:
                $scope.title = d.id == null ? ($scope.event !== undefined ? "Select friend(s)" : "Your friends") : "Friends";
                o = APIService.init();
        }
        $scope.elems = [];
        $scope.next_page = [null, null];
        $scope.load_page = function (t, l) {
            $scope.loaded = false;
            if (t !== undefined) d.is_dislike = t; else t = 0;
            d.page = $scope.next_page[t];
            o.get(d,
                function (result){
                    $scope.elems.push.apply($scope.elems, result.results);
                    var pg;
                    if ($scope.next_page[t] == null) pg = 1; else pg = $scope.next_page[t]+1;
                    if (result.page_count == pg) delete $scope.next_page[t]; else $scope.next_page[t] = pg;
                    if (l === undefined) $timeout(function() { $scope.loaded = true });
                })
        };
        if (t == 3) {
            $scope.load_page(0, true);
            $scope.load_page(1);
        } else $scope.load_page();

        $scope.check = function (is_dislike) {
            return $scope.elems.some(function(el) { return el.is_dislike == is_dislike });
        };

        $scope.makeSel = function (i) {
            //if ($scope.event !== undefined) {
            if ($scope.event === undefined || $scope.working) return;
            $scope.elems[i].selected = $scope.elems[i].hasOwnProperty('selected') ? !$scope.elems[i].selected : true;
            if ($scope.elems[i].selected) $scope.sel_cnt++; else $scope.sel_cnt--;
            //} else $window.location.href = '/'+($scope.favs ? $scope.elems[i].shortname : 'user/'+$scope.elems[i].username)+'/'
        };

        $scope.sendNotify = function (){
            $scope.working = true;
            var to = '';
            for (var i = 0; i < $scope.elems.length; i++) if ($scope.elems[i].selected) to += ',' + $scope.elems[i].id;
            $rootScope.sendreq('api/events/'+$scope.event+'/notify/?notxt=1&to='+to.substr(1)).then(function (){ $scope.close() }, function () { $scope.working = false });
        }
    });