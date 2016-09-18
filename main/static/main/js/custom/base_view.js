app.controller('BaseViewCtrl', function($scope, $timeout, $state, tabs) {
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
        if (chng) return;
        if (init !== undefined) init = value;
        value = value.substr(2);
        if (value != '') {
            oldvalue = oldvalue.substr(2);
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
        if (tabs[value].func !== undefined) tabs[value].func();
        if (value != 0) { if (location.hash != '#/'+tabs[value].name) location.hash = '#/'+tabs[value].name } else if (location.hash !== init && location.hash.substr(2) != '' && location.hash != '#/'+tabs[0].name) location.hash = '#/'+tabs[0].name;
        if (init !== undefined) init = undefined;
        $timeout(function () { chng = false });
    });
});