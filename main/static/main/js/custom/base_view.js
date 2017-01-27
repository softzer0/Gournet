app.requires.push('ngFileUpload');
app
    .controller('BaseViewCtrl', function($scope, $timeout, $state, $q, $document, tabs, Upload, dialogService) {
        // Tabs

        var chng = false, init = null;

        function setCurr() {
            location.hash = '#/'+tabs[$scope.active].name;
            $timeout(function () { chng = false });
        }

        function chkac(value) {
            if ($scope.active === undefined) return false;
            return tabs[$scope.active].name == value;
        }

        $scope.$watch(function () { return location.hash }, function (value, oldvalue) {
            if (chng || location.hash.slice(7) == '#/show=') return;
            if (init !== undefined) init = value;
            value = value.slice(2);
            if (value != '') {
                oldvalue = oldvalue.slice(2);
                var o = false;
                for (var i = 0; i < tabs.length; i++) {
                    if (value == tabs[i].name) {
                        $scope.active = i;
                        if (oldvalue == '') break;
                    }
                    if (oldvalue != '' && !o) {
                        o = oldvalue == tabs[i].name;
                        if (o && chkac(value)) break;
                    }
                }
                if (oldvalue != '' && !o && chkac(value)) {
                    chng = true;
                    $state.go('main');
                    $timeout(setCurr);
                }
            } else if ($scope.active != 0) {
                if ($scope.active === undefined) return;
                chng = true;
                setCurr();
            }
        });

        $scope.$watch('active', function (value) {
            if (value === undefined) return;
            chng = true;
            tabs[value].func();
            if (value != 0) { if (location.hash != '#/'+tabs[value].name) location.hash = '#/'+tabs[value].name } else if (location.hash !== init && location.hash.substr(2) != '' && location.hash != '#/'+tabs[0].name) {
                location.hash = '#/'+tabs[0].name;
                if (window.ga !== undefined) $timeout(function() { window.ga('send', 'pageview', window.location.pathname+window.location.hash) });
            }
            if (init !== undefined) init = undefined;
            $timeout(function () { chng = false });
        });

        // Owner
        if (angular.element('.img_p').length == 0) return;

        $scope.documentClick = {};
        $scope.co = function (i){ if ($scope.edit[i].disabled === false) $scope.edit[i].disabled = true };

        $scope.edit = [];
        $scope.setE = function (val){ $scope.edit.push({value: arguments.length > 1 ? jQuery.makeArray(arguments) : arguments[0], form: arguments.length > 1 ? jQuery.makeArray(arguments) : arguments[0], disabled: true}) };
        $scope.disableE = function (i){ $scope.edit[i].disabled = true };
        function checkfield(i, j, o) {
            var v = j !== undefined ? $scope.edit[i].form[j] : $scope.edit[i].form, n = v !== undefined && v !== '';
            if (o) if (n) if (j !== undefined) $scope.edit[i].value[j] = $scope.edit[i].form[j]; else $scope.edit[i].value = $scope.edit[i].form; else if (j !== undefined) $scope.edit[i].form[j] = $scope.edit[i].value[j]; else $scope.edit[i].form = $scope.edit[i].value;
            return !o ? n && v != (j !== undefined ? $scope.edit[i].value[j] : $scope.edit[i].value) : n;
        }
        $scope.execA = function (i, params, del, success, error, before) {
            var j;
            if (params.constructor != Object) {
                var d = {};
                if (typeof(params) != 'string') for (j = 0; j < params.length; j++) { if (checkfield(i, j)) d[params[j]] = $scope.edit[i].form[j] } else if (checkfield(i)) d[params] = $scope.edit[i].form;
                if (success === undefined && Object.keys(d).length == 0) {
                    $scope.disableE(i);
                    return;
                }
            }
            function f() {
                if (before !== undefined) if (before()) return;
                $scope.edit[i].disabled = null;
                $scope.s.partial_update(params.constructor == Object ? params : d, function (result) {
                    if (success === undefined) if (typeof(params) != 'string') for (j = 0; j < params.length; j++) checkfield(i, j, true); else checkfield(i, undefined, true); else success(result);
                    if (del !== undefined) {
                        $document.off('click', $scope.documentClick[del[1]]);
                        if (Object.keys($scope.documentClick).length > 1) delete $scope.documentClick[del[1]]; else delete $scope.documentClick;
                        delete $scope.edit[i].disabled;
                        delete $scope.edit[i].form;
                    } else $scope.disableE(i);
                }, function (result) {
                    if (error !== undefined) error(result);
                    $scope.disableE(i);
                });
            }
            if (del !== undefined) dialogService.show("After changing the "+del[0]+" for the first time, you won't be able to do that again."+'<br>'+"Are you sure that you want to continue?").then(f); else f();
        };

        $scope.upload = function (file, pk) {
            var deferred = $q.defer();
            Upload.upload({
                url: '/upload/' + (pk ? pk + '/' : ''),
                file: file
            }).then(function (resp) {
                deferred.resolve();
                console.log('Success ' + resp.config.file.name + ' uploaded.');
            }, function (resp) {
                deferred.reject();
                console.log('Error status: ' + resp.status);
            /*}, function (evt) {
                console.log('Progress: ' + parseInt(100.0 * evt.loaded / evt.total) + '% (' + evt.config.file.name + ')');
            */});
            return deferred.promise;
        };

        ($scope.setW = function (i, a) {
            var w = $scope.$watch('img[\''+i+'\'].file', function () {
                //console.log($scope.file);
                if ($scope.img !== undefined && $scope.img[i] !== undefined && $scope.img[i].file != undefined) {
                    function reset() { $scope.img[i].file = null }
                    if ($scope.img[i].file.size <= 2000000) {
                        $scope.upload($scope.img[i].file, a || i).then(function () {
                            $scope.img[i].ts = '&' + (+new Date());
                            $timeout(reset);
                        }, reset);
                    } else {
                        reset();
                        dialogService.show("You can't upload image larger than 2MB!", false);
                    }
                } else if ($scope.img === undefined) w();
            });
            if ($scope.img !== undefined && typeof(i) == 'number') $scope.img[i] = {w: w};
        })('a', $scope.u === undefined ? 'business' : undefined);
    });