angular.module('mainApp', ['ui.bootstrap', 'ngResource']) /*, 'angularCSS'*/
    .config(['$httpProvider', function($httpProvider) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    }])

    .run(function($rootScope, $http) {
        $rootScope.sendreq = function(url, data) {
            return $http({
                method: 'POST',
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
                /*ngDialogYn: '=',
                ngDialogOkOnly: '=',*/
                ngDialogClick: '&'
            },
            link: function(scope, element, attrs) {
                element.bind('click', function() {
                    var message = attrs.ngDialogMessage || "Are you sure?";
                    var YesNo = attrs.ngDialogYn || false;
                    var OkOnly = attrs.ngDialogOkOnly || false;

                    var modalHtml = '<div class="modal-body">' + message + '</div>';
                    modalHtml += '<div class="modal-footer"><button class="btn btn-primary" ng-click="ok()">'+/*(YesNo ? */'Yes'/* : 'OK')*/+'</button>'+/*(!OkOnly ? */'<button class="btn btn-warning" ng-click="cancel()">'+/*(YesNo ? */'No'/* : 'Cancel')*/+'</button></div>'/*:'')*/;

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

    .controller('SettCtrl', function($rootScope, $scope, $uibModal) { /*, $css*/
        /*$css.add('/static/css/sett.css');*/
        $scope.showSettModal = function (id) {
            $scope.id = id;
            if (id == 1) $rootScope.showed = true; else $rootScope.showed = false;
            $uibModal.open({
                size: 'lg',
                templateUrl: '/static/modals/settings.html',
                scope: $scope,
                controller: 'ModalInstanceCtrl'
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
                for (var e in emails) if (emails[e].email == email) return false;
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

    .controller('ModalInstanceCtrl', function($rootScope, $scope, $uibModalInstance, emailService) {
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
            emailService.load().then(function (){ $scope.loaded = true; /*load = false*/ });
            //} else { $scope.loaded = true }
            $scope.addEmail = function (email) {
                if (!$scope.addemail.$valid) return;
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
            $scope.pass_err = undefined;
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
            $rootScope.sendreq('password/change/', 'oldpassword='+$scope.pass[0]+'&password1='+$scope.pass[1]+'&password2='+$scope.pass[2]).then(function (data){
                $scope.pass_err = 0;
                for(var i=0; i<3; i++) $scope.pass[i] = '';
            }, function (data){
                if (data.data.form_errors !== undefined) {
                    var err = 0;
                    for (var e in data.data.form_errors) {
                        //if ($scope.pass_err_txt != '') $scope.pass_err_txt += '\r\n';
                        if (e == 'oldpassword') err += 1; else err += 2;
                        for (var i = 0; i < data.data.form_errors[e].length; i++) {
                            if ($scope.pass_err_txt != ''/*i>0*/) $scope.pass_err_txt += ' ';
                            $scope.pass_err_txt += data.data.form_errors[e][i];
                        }
                    }
                    $scope.pass_err = err;
                    if (err == 1 || err == 3) pw_fields[0].focus(); else pw_fields[1].focus();
                }
            });
        }
    });
