if (OWNER_MANAGER) {
    app.requires.push('ngFileUpload');
    app.factory('checkField', function(){
        return function(obj, j, o, f) {
            function getsetf(v, d){
                var r, f = v ? 'value' : 'form';
                if (j !== undefined) {
                    r = obj[f];
                    if (typeof(j) == 'object') {
                        r = r[j[0]];
                        f = j[1];
                    } else f = j;
                } else r = obj;
                if (d !== undefined) r[f] = d; else return r[f];
            }
            var v = typeof(f) == 'function' ? f(getsetf()) : getsetf(), n = v !== undefined && v !== '';
            if (o || !n) if (n) getsetf(true, v); else getsetf(undefined, getsetf(true));
            return !o ? n && (typeof(v) == 'object' ? !angular.equals(v, getsetf(true)) : v != getsetf(true)) ? typeof(f) == 'function' ? v : true : false : n;
        }
    });
}

app.controller('BaseViewCtrl', function($scope, $timeout, $state, $document, $injector, $window, tabs) {
    // Tabs

    var chng = false, init = null;

    function triggerGA() {
        if ($window.gtag !== undefined) $window.gtag('event', 'page_view', {page_path: location.pathname+location.hash});
    }

    function setCurr() {
        location.hash = '#/'+tabs[$scope.active].name;
        triggerGA();
        $timeout(function () { chng = false });
    }

    function chkac(value) {
        if ($scope.active === undefined) return false;
        return tabs[$scope.active].name == value;
    }

    if (location.hash.slice(2) == '' && OWNER_MANAGER === null) location.hash = '#/menu';
    $scope.$watch(function () { return location.hash }, function (value, oldvalue) {
        if (chng || location.hash.substring(0, 7) == '#/show=') return;
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
        if (value != 0) { if (location.hash != '#/'+tabs[value].name) {
            location.hash = '#/'+tabs[value].name;
            triggerGA();
        } } else if (location.hash !== init && location.hash.substr(2) != '' && location.hash != '#/'+tabs[0].name) {
            location.hash = '#/'+tabs[0].name;
            triggerGA();
        }
        if (init !== undefined) init = undefined;
        $timeout(function () { chng = false });
    });

    // Owner
    if (!OWNER_MANAGER) return;
    var services = [$injector.get('$q'), $injector.get('Upload'), $injector.get('dialogService'), $injector.get('checkField')];

    $scope.gened = function (arr){ return {value: arr, form: arr.slice(), disabled: true} };
    if ($scope.u === true) {
        $scope.documentClick = {};
        $scope.setE = function (name){
            var r = $scope.gened(arguments.length > 2 ? jQuery.makeArray(arguments).splice(1) : arguments[1]);
            if (name != undefined) $scope.edit[name] = r; else $scope.edit.push(r);
        };
    }
    var editf;
    $scope.disableE = function (){ editf.disabled = true };
    function checkfield(j, o) { return services[3](editf, j, o) }
    $scope.execA = function (i, params, del, success, error, before, after) {
        editf = i != undefined ? $scope.edit[i] : $scope.edit;
        var j;
        if (params.constructor != Object) {
            var d = {};
            if (typeof(params) != 'string') for (j = 0; j < params.length; j++) { if (checkfield(j)) d[params[j]] = editf.form[j] } else if (checkfield()) d[params] = editf.form;
            if (Object.keys(d).length == 0) {
                $scope.disableE();
                return;
            }
        }
        function f() {
            if (before !== undefined && before()) return;
            editf.disabled = null;
            $scope.s.partial_update(params.constructor == Object ? params : d, function (result) {
                if (success === undefined) if (typeof(params) != 'string') for (j = 0; j < params.length; j++) checkfield(j, true); else checkfield(undefined, true); else success(result);
                if (del !== undefined) {
                    $document.off('click', $scope.documentClick[del[1]]);
                    if (Object.keys($scope.documentClick).length > 1) delete $scope.documentClick[del[1]]; else delete $scope.documentClick;
                    delete editf.disabled;
                    delete editf.form;
                } else $scope.disableE();
                if (after !== undefined) after();
            }, function (result) {
                if (error !== undefined) error(result);
                $scope.disableE();
            });
        }
        if (del !== undefined) services[2].show(interpolate(gettext("After changing the %s for the first time, you won't be able to do that again."), [del[0]])+'<br>'+gettext("Are you sure that you want to continue?")).then(f); else f();
    };

    function upload(file, pk) {
        var deferred = services[0].defer();
        services[1].http({
            url: '/api/upload/'+(pk ? pk+'/' : '')+'avatar/',
            method: 'PUT',
            data: file,
            headers: {'Content-Disposition': 'attachment; filename="'+file.name+'"', 'Content-Type': '*/*'}
        }).then(function (resp) {
            deferred.resolve();
            console.log('Success ' + resp.config.data.file.name + ' uploaded.');
        }, function (resp) {
            deferred.reject(resp.data);
            console.log('Error status: ' + resp.status);
        /*}, function (evt) {
            console.log('Progress: ' + parseInt(100.0 * evt.loaded / evt.total) + '% (' + evt.config.file.name + ')');
        */});
        return deferred.promise;
    }
    ($scope.setW = function (i, a) {
        var w = $scope.$watch('img[\''+i+'\'].file', function () {
            //console.log($scope.file);
            if ($scope.img !== undefined && $scope.img[i] !== undefined && $scope.img[i].file != undefined) {
                function reset() { $scope.img[i].file = null }
                function showmsg(msg) {
                    reset();
                    services[2].show(msg, false);
                }
                if ($scope.img[i].file.size <= 4500000) {
                    upload($scope.img[i].file, a !== undefined ? a : i).then(function () {
                        $scope.img[i].ts = '?' + (+new Date());
                        $timeout(reset);
                    }, function (data) { if (data.detail) showmsg(data.detail); else reset() });
                } else showmsg(gettext("You can't upload image larger than 4.5MB!"));
            } else if ($scope.img === undefined) w();
        });
        if ($scope.img !== undefined && typeof(i) == 'number') $scope.img[i] = {w: w};
    })('a', $scope.u === undefined ? 'business' : null);
});

$(function() {

    var lastScrollTop = $(window).scrollTop();

    var initialSidebarTop = $('header').height() + 20;
    var footerHeight = $('footer').height() + 10;

    var lastWindowHeight = $(window).height();

    var working = false;

    function trigger() {

        if (working) return; else working = true;

        var $sidebar = $('.bs-sidebar.affix');

        var scrollTop = $(window).scrollTop();
        var windowHeight = $(window).height();
        var isScrollingDown = (scrollTop > lastScrollTop);

        if ($sidebar.css('z-index') != '0') {

            var sidebarHeight = $sidebar.outerHeight();
            var scrollBottom = scrollTop + windowHeight;

            var sidebarTop = $sidebar.offset().top;
            var sidebarBottom = sidebarTop + sidebarHeight + footerHeight;

            var heightDelta = Math.abs(windowHeight - sidebarHeight - footerHeight - initialSidebarTop);
            var scrollDelta = lastScrollTop - scrollTop;

            var isWindowLarger = (windowHeight > sidebarHeight + initialSidebarTop + 10);

            if (isWindowLarger && $sidebar.hasClass('relative') || (!isWindowLarger && scrollTop > initialSidebarTop + heightDelta)) {
                $sidebar.removeClass('relative');
            } else if (!isScrollingDown && scrollTop <= initialSidebarTop) {
                $sidebar.addClass('relative');
            }

            var dragBottomDown = (isScrollingDown && sidebarBottom <= scrollBottom);
            var dragTopUp = (!isScrollingDown && sidebarTop >= scrollTop);

            if (dragBottomDown || !isScrollingDown && lastWindowHeight != windowHeight) {
                if (isWindowLarger) {
                    $sidebar.css('top', initialSidebarTop);
                } else {
                    $sidebar.css('top', initialSidebarTop - heightDelta);
                }
            } else if (dragTopUp) {
                $sidebar.css('top', initialSidebarTop);
            } else if (!$sidebar.hasClass('relative')) {
                var currentTop = parseInt($sidebar.css('top'), 10);

                var minTop = initialSidebarTop - heightDelta;
                var scrolledTop = currentTop + scrollDelta;

                var isPageAtBottom = (scrollTop + windowHeight >= $(document).height());
                var newTop = (isPageAtBottom) ? minTop : scrolledTop;

                $sidebar.css('top', newTop);
            }

        } else $sidebar.css('top', 0);

        lastScrollTop = scrollTop;
        lastWindowHeight = windowHeight;

        working = false;
    }

    $(window).scroll(trigger);
    $(window).resize(trigger);
    $('.bs-sidebar.affix').resize(trigger);
    $('.col-md-9').resize(trigger);
});