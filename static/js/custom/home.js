var app = angular.module('mainApp', ['ui.bootstrap', 'ngResource', 'ngRoute', 'ngAside', 'yaru22.angular-timeago', 'ngFitText']) /*, 'oc.lazyLoad', 'angularCSS'*/
    .config(function($httpProvider) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    })

    .filter('unsafe', function($sce) { return $sce.trustAsHtml; })

    .run(function($rootScope, $http) {
        $rootScope.sendreq = function(url, data) {
            if (data) method = 'POST'; else method = 'GET';
            return $http({
                method: method,
                url: '/'+url,
                data: data,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            })/*.then(function(response) { return response.data })*/;
        };
    })
    
    .directive('ngDialogClick', function($uibModal) {
        var ModalInstanceCtrl = function($scope, $uibModalInstance) {
            $scope.ok = function($event) {
                $uibModalInstance.close();
                $event.stopPropagation();
            };
            $scope.cancel = function($event) {
                $uibModalInstance.dismiss('cancel');
                $event.stopPropagation();
            };
        };

        return {
            restrict: 'A',
            scope: {
                ngDialogMessage: '@',
                ngDialogYn: '=',
                ngDialogOkOnly: '=',
                ngDialogClick: '&'
            },
            link: function(scope, element, attrs) {
                element.bind('click', function() {
                    var message = attrs.ngDialogMessage || "Are you sure?";
                    var YesNo = attrs.ngDialogYn || false;
                    var OkOnly = attrs.ngDialogOkOnly || false;

                    var modalHtml = '<div class="modal-body">' + message + '</div><div class="modal-footer"><button class="btn btn-primary" ng-click="ok($event)">'+(YesNo ? 'Yes' : 'OK')+'</button>'+(!OkOnly ? '<button class="btn btn-warning" ng-click="cancel($event)">'+(YesNo ? 'No' : 'Cancel')+'</button></div>':'');

                    var modalInstance = $uibModal.open({
                        windowTopClass: 'modal-confirm',
                        template: modalHtml,
                        controller: ModalInstanceCtrl
                    });

                    modalInstance.result.then(function() {
                        scope.ngDialogClick();
                    }/*, function() {}*/);
                });

            }
        }
    })

    /*.config(function($routeProvider, $locationProvider) {
        $routeProvider.when('?show=:ids', {
            // ...
        });
        $locationProvider.html5mode = true;
    })*/
    
    .factory('usersModalService', function($uibModal) {
        var params = {};
        
        return {
            params: params,
            setAndOpen: function(id, type) {
                params.id = id;
                params.type = type;
                $uibModal.open({
                    size: 'lg',
                    templateUrl: '/static/modals/friends.html',
                    controller: 'UsersModalCtrl'
                });
            }
        }
    })

    .controller('MainCtrl', function($scope, $uibModal, $aside, $timeout, usersModalService) {
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
                    /*$css.add('/static/css/sett.css');*/
                    $scope.showSettModal = function (id) {
                        $scope.id = id;
                        $uibModal.open({
                            size: 'lg',
                            templateUrl: '/static/modals/settings.html',
                            scope: $scope,
                            controller: 'SettModalCtrl'
                        });
                    };
                    $scope.cancel = function($event) {
                        $uibModalInstance.dismiss('cancel');
                        $event.stopPropagation();
                    };
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

    .factory('emailService', function($rootScope, $resource) {
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
                return $resource('/api/email/?format=json').query({},
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
                /*return*/ _sendreq('primary', emails[selected].email).then(function (){
                    var t = emails[0];
                    t.primary = false;
                    emails[selected].primary = true;
                    emails[0] = emails[selected];
                    emails[selected] = t;
                });
            }
        }

    })

    .controller('SettModalCtrl', function($rootScope, $scope, $timeout, $uibModalInstance, emailService) {
        $scope.cancel = function($event) {
            $uibModalInstance.dismiss('cancel');
            $event.stopPropagation();
        };

        // Email

        //var load;
        $scope.sent = [];
        $scope.$watch('id', function () {
            if ($scope.id == 1 || $scope.emails !== undefined) return;
            $scope.selected = 0;
            $scope.emails = emailService.emails;
            //if ($scope.emails.length == 0) {
                //load = true;
            emailService.load().then(function (){ $timeout(function() { $scope.loaded = true; /*load = false*/ }) });
            //} else { $scope.loaded = true }
            $scope.addEmail = function (email) {
                if (!$scope.addemail.$valid) return;
                for (var e in $scope.emails) if ($scope.emails[e].email == email) return;
                emailService.add(email).then(function (){
                    $scope.sent.push($scope.email);
                    $scope.email = ''
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
                emailService.resend().then(function (){
                    var t = $scope.emails[$scope.selected].email;
                    for (var i = 0; i < $scope.sent.length; i++) if ($scope.sent[i]==t) return;
                    $scope.sent.push(t);
                });
            };
            $scope.makePrimaryEmail = function () {
                emailService.primary()/*.then(function (){
                    $scope.selected = 0;
                    $scope.EmailSelected();
                })*/;
            };
        });
        $scope.$watch('emails.length', function () {
            //if (load) return;
            $scope.selected = $scope.emails.length-1;
            $scope.EmailSelected();
        });
        $scope.EmailSelected = function () {
            emailService.setCurrent($scope.selected);
        };

        // Password

        $scope.dismissError = function (){
            delete $scope.pass_err;
            delete $scope.pass_err_txt;
        };
        $scope.changePassword = function () {
            if (!$scope.changepw.$valid) return;
            const pw_fields = angular.element('input[type="password"]');
            if ($scope.pass[1] != $scope.pass[2]) {
                //if ($scope.pass_err != 4) {
                $scope.pass_err_txt = "New password fields don't match.";
                $scope.pass_err = 4;
                pw_fields[2].focus();
                //}
                return;
            }
            if ($scope.pass[0] == $scope.pass[1]) {
                /*var t = "Your new password matches the current password, enter a different one.";
                if ($scope.pass_err_txt != t) {*/
                $scope.pass_err_txt = "Your new password matches the current password, enter a different one."; //t
                $scope.pass_err = 2;
                pw_fields[1].focus();
                //}
                return;
            }
            $scope.dismissError();
            $rootScope.sendreq('password/', 'oldpassword='+$scope.pass[0]+'&password1='+$scope.pass[1]+'&password2='+$scope.pass[2]).then(function (){
                $scope.pass_err = 0;
                for(var i=0; i<3; i++) $scope.pass[i] = '';
            }, function (response){
                if (response.data.form_errors !== undefined) {
                    var err = 0;
                    for (var e in response.data.form_errors) {
                        //if ($scope.pass_err_txt != '') $scope.pass_err_txt += '\r\n';
                        if (e == 'oldpassword') err += 1; else err += 2;
                        for (var i = 0; i < response.data.form_errors[e].length; i++) {
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

    .factory('notifService', function($resource) {
        return $resource('/api/notifications/:id/?format=json', null,
            {
                //'update': {method: 'PUT'},
                'get': {method:'GET'},
                'query': {method:'GET', isArray: true}
            });
    })

    .controller('NotificationCtrl', function ($rootScope, $scope, $timeout, notifService) {
        const NOTIF_PAGE_SIZE = 5;

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
                    if (page_num !== undefined) if (frse) res.splice(0, ($scope.notifs.length - u) % NOTIF_PAGE_SIZE); else if (frse == false) {
                        res.splice(u);
                        frse = true;
                    }
                    $scope.notifs.push.apply($scope.notifs, res);
                    if (page_num === undefined) {
                        for (var i = 0; i < res.length - 1; i++) ids += res[i].id+',';
                        ids += res[i].id;
                        if (!$scope.opened) {
                            u += i+1;
                            $scope.unread = true;
                        } else markAllAsRead();
                    }
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
            $rootScope.sendreq('api/notifications/read/?notxt=1&ids='+ids);
            ids = '';
        }
    })

    .factory('frifavService', function($resource) {
        return {
            init: function (t){
                var n;
                switch (t){
                    case 1:
                        n = 'favourites';
                        break;
                    default: n = 'friends'
                }
                return $resource('/api/'+n+'/:id/?format=json', null,
                {
                    'get': {method: 'GET'},
                    'save': {method: 'POST'},
                    'delete': {method:'DELETE'}
                });
            }
        }
    })

    .controller('UsersModalCtrl', function ($scope, $timeout, $uibModalInstance, $resource, usersModalService, frifavService) {
        $scope.cancel = function($event) {
            $uibModalInstance.dismiss('cancel');
            $event.stopPropagation();
        };

        var d = {id: usersModalService.params.id}, t = usersModalService.params.type, o;
        switch (t){
            case 0:
                if (d.id == null) $scope.title = "Your friends"; else $scope.title = "Friends";
                o = frifavService.init();
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
                o = frifavService.init(1);
                /*break;
            case 2:
                ...*/
        }
        $scope.elems = [];
        ($scope.load_page = function() {
            $scope.loaded = false;
            d.page = $scope.next_page;
            o.get(d,
                function (result){
                    $scope.elems.push.apply($scope.elems, result.results);
                    var pg;
                    if ($scope.next_page === undefined) pg = 1; else pg = $scope.next_page+1;
                    if (result.page_count == pg) delete $scope.next_page; else $scope.next_page = pg;
                    $timeout(function() { $scope.loaded = true });
                })
        })();
    });