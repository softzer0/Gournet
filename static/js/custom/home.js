var app = angular.module('mainApp', ['ui.bootstrap', 'ngResource', 'yaru22.angular-timeago', 'ngFitText']) /*, 'oc.lazyLoad', 'angularCSS'*/
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
            $scope.ok = function() { $uibModalInstance.close() };
            $scope.cancel = function() { $uibModalInstance.dismiss('cancel'); };
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

                    var modalHtml = '<div class="modal-body">' + message + '</div>';
                    modalHtml += '<div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">'+(YesNo ? 'Yes' : 'OK')+'</button>'+(!OkOnly ? '<button class="btn btn-warning" ng-click="cancel()">'+(YesNo ? 'No' : 'Cancel')+'</button></div>':'');

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


    .controller('MainCtrl', function($scope, $uibModal) {
        $scope.showFriendsModal = function (){
            $uibModal.open({
                size: 'lg',
                templateUrl: '/static/modals/friends.html',
                scope: $scope,
                controller: 'FriendsModalCtrl' /*,
                appendTo: angular.element('#uctrl')*/
            });
        };
    })

    .controller('SettCtrl', function($rootScope, $scope, $uibModal) { /*, $css*/
        /*$css.add('/static/css/sett.css');*/
        $scope.showSettModal = function (id) {
            $scope.id = id;
            if (id == 1) $rootScope.showed = true; else $rootScope.showed = false;
            $uibModal.open({
                size: 'lg',
                templateUrl: '/static/modals/settings.html',
                scope: $scope,
                controller: 'SettModalCtrl'
            });
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
                    function success(result) {
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
        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };

        // Email

        //var load;
        $scope.sent = [];
        $scope.showed = false;
        $rootScope.$watch('showed', function () { $scope.showed = $rootScope.showed; });
        $scope.$watch('showed', function () {
            if (!$rootScope.showed) return;
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
            $scope.pass_err_txt = '';
        };
        $scope.changePassword = function () {
            if (!$scope.changepw.$valid) return;
            var pw_fields = angular.element('input[type="password"]');
            if ($scope.pass[1] != $scope.pass[2]) {
                //if ($scope.pass_err != 4) {
                $scope.pass_err_txt = "New password fields don't match.";
                $scope.pass_err = 4;
                pw_fields[2].focus();
                //}
                return;
            }
            if ($scope.pass[0] == $scope.pass[1]) {
                /*var t = "Your new password matches the current password, please enter a different one.";
                if ($scope.pass_err_txt != t) {*/
                $scope.pass_err_txt = "Your new password matches the current password, please enter a different one."; //t
                $scope.pass_err = 2;
                pw_fields[1].focus();
                //}
                return;
            }
            $scope.dismissError();
            $rootScope.sendreq('password/change/', 'oldpassword='+$scope.pass[0]+'&password1='+$scope.pass[1]+'&password2='+$scope.pass[2]).then(function (){
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
                'query': {method:'GET'}
            });
    })

    .controller('NotificationCtrl', function ($rootScope, $scope, $timeout, notifService) {
        const NOTIF_PAGE_SIZE = 5;

        $scope.notifs = [];
        $scope.loading = false;
        ($scope.getNotifs = function (notick) {
            var page_num;
            if (notick) {
                $scope.loading = true;
                page_num = Math.floor($scope.notifs.length / NOTIF_PAGE_SIZE) + 1;
            } else page_num = 1;
            notifService.query({page: page_num},
                function success(result) {
                    if ($scope.has_next_page === undefined || page_num > 1) $scope.has_next_page = result.page_count > page_num;
                    if (result.results.length) {
                        if ($scope.notifs.length && page_num == 1) {
                            if (result.results[0].id != $scope.notifs[0].id) {
                                if (result.results[0].id > $scope.notifs[0].id) {
                                    var id, i = 0;
                                    if ($scope.notifs.length) id = $scope.notifs[0].id;
                                    while (result.results[0].unread && result.results[0].id != id) {
                                        $scope.notifs.unshift(result.results[0]);
                                        result.results.splice(0, 1);
                                        if (!$scope.unread) $scope.unread = $scope.notifs[0].unread;
                                        if (!result.results.length) break;
                                        if (i + 1 < $scope.notifs.length) id = $scope.notifs[i++].id;
                                    }
                                    if ($scope.unread && $scope.opened) markAllAsRead(1);
                                } else {
                                    while (result.results[0].id != $scope.notifs[0].id) {
                                        $scope.notifs.splice(0, 1);
                                        if (!$scope.notifs.length) break;
                                        if (!$scope.unread) $scope.unread = $scope.notifs[0].unread;
                                    }
                                    if (!$scope.notifs.length && $scope.unread) $scope.unread = false;
                                }
                            } else return;
                        } else {
                            if (page_num > 1) result.results.splice(0, $scope.notifs.length % NOTIF_PAGE_SIZE);
                            $scope.notifs.push.apply($scope.notifs, result.results);
                            if (!$scope.unread) $scope.unread = result.results.some(function (e) { return e.unread });
                            if (page_num > 1) {
                                if ($scope.unread) markAllAsRead(page_num);
                                $timeout(function() { $scope.loading = false });
                            }
                        }
                    } else if ($scope.notifs.length) {
                        $scope.notifs.length = 0;
                        $scope.unread = false;
                    } else return;
                    enableScroll();
                });
            if (page_num == 1) $timeout($scope.getNotifs, 10000);
        })();
        $scope.$watch('opened', function() {
            if ($scope.opened === undefined) return;
            if ($scope.opened && $scope.unread) markAllAsRead(1);
            if (!$scope.opened) {
                if ($scope.notifs.length > NOTIF_PAGE_SIZE) {
                    $scope.notifs.splice(NOTIF_PAGE_SIZE, $scope.notifs.length - NOTIF_PAGE_SIZE);
                    $scope.has_next_page = true;
                }
                for (var i = 0; i < $scope.notifs.length; i++) if ($scope.notifs[i].unread) $scope.notifs[i].unread = false; else break;
            }
            $scope.unread = false;
        });
        function enableScroll(){
            if (!$scope.opened) return;
            var e = angular.element('#notif').next().find('.popover-content');
            $timeout(function() { if (e.height() < e.children('.dt').height()) e.css('overflow-y', 'scroll'); else e.css('overflow-y', 'hidden') });
        }
        function markAllAsRead(page_num){ $rootScope.sendreq('api/notifications/read/'+page_num) }
    })

    .factory('friendService', function($resource) {
        return $resource('/api/friends/:id/?format=json', null,
            {
                'query': {method: 'GET'},
                'save': {method: 'POST'},
                'delete': {method:'DELETE'}
            });
    })

    .controller('FriendsModalCtrl', function ($scope, $timeout, $uibModalInstance, friendService) {
        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.friends = [];
        ($scope.load_page = function() {
            $scope.loaded = false;
            friendService.query({id: $scope.user_id, page: $scope.next_page},
                function success(result) {
                    $scope.friends.push.apply($scope.friends, result.results);
                    var pg;
                    if ($scope.next_page === undefined) pg = 1; else pg = $scope.next_page+1;
                    if (result.page_count == pg) delete $scope.next_page; else $scope.next_page = pg;
                    $timeout(function() { $scope.loaded = true });
                })
        })();
    });