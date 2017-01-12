app.requires.push('ngFileUpload');
app
    .controller('BaseViewCtrl', function($scope, $timeout, $state, $q, tabs, Upload, dialogService) {
        $scope.clickOutside = function (i){ if ($scope.edit[i].disabled === false) $scope.edit[i].disabled = true };

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

        var disupl = $scope.$watch('file', function (){
            //console.log($scope.file);
            if ($scope.file != undefined) {
                function reset() { $scope.file = null }
                if ($scope.file.size <= 2000000) {
                    $scope.upload($scope.file, $scope.u === undefined ? 'business' : undefined).then(function (){
                        $scope.img = $scope.img.split('?')[0]+'?'+(+ new Date());
                        $timeout(reset);
                    }, reset);
                } else {
                    reset();
                    dialogService.show("You can't upload image larger than 2MB!", false);
                }
            } else if ($scope.file === undefined) disupl();
        });

        $scope.gend = function (){
            var d = {};
            for (var i = 0; i < arguments.length; i++) if ($scope.edit[0].form[i] != $scope.edit[0].value[i]) d[arguments[i]] = $scope.edit[0].form[i];
            return d;
        };

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
    });