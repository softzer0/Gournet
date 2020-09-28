function formatTime(v){ return moment(v).format('HH:mm') }
app
    .directive('dragToReorder', function() {
        return {
            link: function(scope, element, attrs) {
                var dragOverHandler, draggingClassName, dropHandler, droppingAboveClassName, droppingBelowClassName, droppingClassName, theList;
                theList = scope.$eval(attrs.dragToReorder);
                if (theList == null) throw 'Must specify the list to reorder';

                /*
                drag stuff
                */
                draggingClassName = 'dragging';
                element.attr('draggable', true);
                element.on('dragstart', function(e) {
                    element.addClass(draggingClassName);
                    return e.originalEvent.dataTransfer.setData('text/plain', scope.$index);
                });
                element.on('dragend', function() { return element.removeClass(draggingClassName) });

                /*
                drop stuff
                */
                droppingClassName = 'dropping';
                droppingAboveClassName = 'dropping-above';
                droppingBelowClassName = 'dropping-below';
                dragOverHandler = function(e) {
                    var offsetY;
                    e.preventDefault();
                    offsetY = e.offsetY || e.layerY;
                    if (offsetY < (this.offsetHeight / 2)) {
                        element.removeClass(droppingBelowClassName);
                        return element.addClass(droppingAboveClassName);
                    } else {
                        element.removeClass(droppingAboveClassName);
                        return element.addClass(droppingBelowClassName);
                    }
                };
                dropHandler = function(e) {
                    var droppedItemIndex, newIndex;
                    e.preventDefault();
                    droppedItemIndex = parseInt(e.originalEvent.dataTransfer.getData('text/plain'), 10);
                    newIndex = null;
                    if (element.hasClass(droppingAboveClassName)) if (droppedItemIndex < scope.$index) newIndex = scope.$index - 1; else newIndex = scope.$index; else if (droppedItemIndex < scope.$index) newIndex = scope.$index; else newIndex = scope.$index + 1;
                    function end(){
                        element.removeClass(droppingClassName);
                        element.removeClass(droppingAboveClassName);
                        element.removeClass(droppingBelowClassName);
                        return element.off('drop', dropHandler);
                    }
                    scope.$eval(attrs.dragCallback)(theList[droppedItemIndex], newIndex).then(function() {
                        theList.splice(newIndex, 0, theList.splice(droppedItemIndex, 1)[0]);
                        end();
                    }, end);
                };
                element.on('dragenter', function(e) {
                    if (element.hasClass(draggingClassName)) return;
                    element.addClass(droppingClassName);
                    element.on('dragover', dragOverHandler);
                    return element.on('drop', dropHandler);
                });
                return element.on('dragleave', function(e) {
                    element.removeClass(droppingClassName);
                    element.removeClass(droppingAboveClassName);
                    element.removeClass(droppingBelowClassName);
                    element.off('dragover', dragOverHandler);
                    return element.off('drop', dropHandler);
                });
            }
        };
    })

    .directive('stringToNumber', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(value) { return '' + value });
                ngModel.$formatters.push(function(value) { return parseFloat(value) });
            }
        }
    })

    .constant('EDIT_DATA', {value: {0: {}}, form: {0: {}}, tz: undefined})

    .controller('EventCtrl', function($rootScope, $scope, $timeout, eventService) {
        //$scope.name = angular.element('.lead.text-center.br2').text();
        $scope.picker = {
            date: $scope.$parent.currTime,
            options: {minDate: $rootScope.currTime}
        };
        $scope.submitEvent = function () {
            var el = angular.element('[name=\'forms.event\'] [name=\'text\']');
            $scope.forms.event.alert = el.val().length < $scope.minchar;
            if ($scope.forms.event.alert) {
                el.focus();
                return;
            }
            $rootScope.currTime = new Date();
            $rootScope.currTime.setMinutes($rootScope.currTime.getMinutes()+1);
            if ($scope.picker.date === undefined || $scope.picker.date < $rootScope.currTime) $scope.picker.date = $rootScope.currTime;
            $scope.picker.options.minDate = $rootScope.currTime;
            $scope.loading = true;
            function l(){ $timeout(function(){ delete $scope.loading }) }
            eventService.new(el.val(), $scope.picker.date).then(function () {
                el.val('');
                l();
            }, l);
        };
    })

    .controller('ItemCtrl', function($scope, $timeout, menuService, dialogService, APIService, USER) {
        $scope.submitItem = function () {
            var el = angular.element('[name=\'forms.item\'] [name=\'name\']');
            $scope.forms.item.alert = el.val().length < 2 ? true : undefined;
            if ($scope.forms.item.alert) {
                el.focus();
                return;
            }
            var cat = angular.element('[name=\'forms.item\'] [name=\'cat\']').val();
            if (menuService.find('name', el.val(), cat)) {
                $scope.forms.item.alert = false;
                el.focus();
                return;
            }
            var ch = $scope.unpub !== undefined;
            $scope.loading = true;
            function l(){ $timeout(function(){ delete $scope.loading }) }
            menuService.new(el.val(), angular.element('[name=\'forms.item\'] [name=\'price\']').val(), cat).then(
                function () {
                    el.val('');
                    l();
                    if (!ch) return;
                    $scope.$parent.unpub = gettext("This message will disappear once your business is approved. When published, it will become visible/accessible to others.");
                    ch = false;
                }, l
                /*function (result) {
                    if (result.data !== undefined && result.data.non_field_errors !== undefined) {
                        $scope.forms.item.alert = false;
                        el.focus();
                        l();
                    }
                }*/
            );
        };

        var s = APIService.init(8);
        $scope.changedCurr = function (){
            dialogService.show(gettext("If you change the business currency now, then item prices in the menu will be converted to that new currency.")+'<br>'+gettext("Are you sure that you want to continue?")).then(function (){
                $scope.$parent.refreshing = true;
                s.partial_update_a({currency: $scope.curr[0]}, function (result) {
                    for (var i = 0; i < result.length; i++) menuService.find('id', result[i].id, result[i].category, function (obj){
                        obj.price = result[i].price;
                        $scope.$parent.$parent.$parent.edit_i[obj.id].form = result[i].price;
                        obj.converted = result[i].converted;
                    });
                    if ($scope.curr[0] == USER.currency || result.length > 0 && result[0].converted != null) $scope.$parent.curr[1] = USER.currency; else $scope.$parent.curr[1] = $scope.curr[0];
                    $scope.$parent.data.curr = $scope.curr[0];
                    delete $scope.$parent.refreshing;
                }, function (){
                    $scope.$parent.curr[0] = $scope.data.curr;
                    delete $scope.$parent.refreshing;
                });
            }, function (){ $scope.$parent.curr[0] = $scope.data.curr });
        };

        function do_enable_disable_form (sc, e, v){
            sc.form_disabled = v;
            $scope.$parent.$parent.$parent.edit_i[e.id].disabled = v;
        }
        $scope.$parent.doIAction = function (sc, e){
            if ($scope.edit_i[e.id].form != '' && $scope.edit_i[e.id].form != e.price) {
                do_enable_disable_form(sc, e, null);
                s.partial_update({object_id: e.id, price: $scope.edit_i[e.id].form}, function (result) {
                    e.price = result.price;
                    e.converted = result.converted;
                    do_enable_disable_form(sc, e, true);
                }, function () { do_enable_disable_form(sc, e, true) });
            } else do_enable_disable_form(sc, e, true);
        };

        $scope.$parent.enableForm = function (sc, e) {
            $scope.$parent.$parent.$parent.edit_i[e.id].disabled = false;
            $timeout(function () { sc.form_disabled = false });
        };

        $scope.$parent.dragFn = function (e, i) { return s.partial_update({object_id: e.id, ordering: i}).$promise };

        $scope.$parent.setUnavailable = function (i) {
            dialogService.show(!i.unavailable ? gettext("Are you sure that you want to set this item as unavailable? The item won't be visible in search.") : gettext("Are you sure that you want to set this item as available? Guests would be able to order it.")).then(function () {
                s.partial_update({object_id: i.id, unavailable: !i.unavailable}, function (result) { i.unavailable = result.unavailable });
            });
        };
    })

    .controller('ManagerCtrl', function($scope, $uibModal, BASE_MODAL, EDIT_DATA, APIService, dialogService) {
        $scope.edit = [];
        $scope.data = EDIT_DATA;

        //$rootScope.$watch('currTime', function (val){ if (val !== undefined) });
        var s = APIService.init(9);
        $scope.s = s;
        function showerr(msg){
            dialogService.show(msg, false);
            $scope.form[2] = '';
            return true;
        }
        $scope.doAction = function (){
            $scope.execA(null, ['type', 'name', 'shortname'], undefined, undefined, function (result){
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k in result.data) if (k == 'shortname') return showerr(gettext("Specified shortname is already taken."));
            }, function () {
                //if (!/^[\w.-]+$/.test($scope.edit.form[2])) showerr("Specified shortname is invalid.");
                if ($scope.edit.form[2] && $scope.edit.form[2] != $scope.edit.value[2]) for (var k = 0; k < $scope.forbidden.length; k++) if ($scope.edit.form[2] == $scope.forbidden[k]) return showerr(gettext("Specified shortname is not permitted."));
            });
        };

        $scope.openEdit = function (){
            $uibModal.open({size: 'md', windowClass: 'ai', templateUrl: BASE_MODAL, controller: function ($rootScope, $scope, $controller, $uibModalInstance, EDIT_DATA, checkField, dialogService){
                $scope.data = EDIT_DATA;
                $scope.title = gettext("Edit business info");
                $scope.file = '../../../edit';
                angular.extend(this, $controller('ModalCtrl', {$scope: $scope, $uibModalInstance: $uibModalInstance}), $controller('CreateCtrl', {$scope: $scope}));

                function disablef(d) {
                    $scope.data.disabled = d;
                    $scope.map.marker.options.draggable = !d;
                }
                $scope.doSave = function (){
                    var d = {};
                    if (checkField($scope.data, 'phone')) d.phone = $scope.data.form.phone;
                    for (var i = 0; i < $scope.data.form.supported_curr.length; i++) if ($scope.data.form.supported_curr[i] == $scope.data.curr) {
                        $scope.data.form.supported_curr.splice(i, 1);
                        break;
                    }
                    if (checkField($scope.data, 'supported_curr')) d.supported_curr = $scope.data.form.supported_curr;
                    if (checkField($scope.data, 'address') || checkField($scope.data, 'location')) {
                        d.address = $scope.data.form.address;
                        d.location = $scope.data.form.location;
                    }
                    for (i = 0; i < $scope.data.wks.length; i+=2) {
                        var w = i === 0 || $scope.work[Math.floor(i / 2)-1];
                        if (w && $scope.data.form[0][$scope.data.wks[i]].getTime() == $scope.data.form[0][$scope.data.wks[i+1]].getTime() && formatTime($scope.data.form[0][$scope.data.wks[i]]) != '00:00') {
                            $scope.data.form[0][$scope.data.wks[i]] = new Date(0, 0, 0, 0, 0);
                            $scope.data.form[0][$scope.data.wks[i+1]] = new Date(0, 0, 0, 0, 0);
                        }
                        for (var j = 0; j < 2; j++) {
                            var r = w ? checkField($scope.data, [0, $scope.data.wks[i+j]], false, formatTime) : $scope.data.value[0][$scope.data.wks[i+j]] ? null : false;
                            if (r !== false) d[$scope.data.wks[i+j]] = r;
                        }
                    }
                    if (Object.keys(d).length == 0) {
                        $scope.close();
                        return;
                    }
                    disablef(true);
                    s.partial_update(d, function (result) {
                        $scope.data.error = false;
                        r = false;
                        for (i in $scope.data.form) if (i != 0) $scope.data.value[i] = $scope.data.form[i]; else for (j = 0; j < $scope.data.wks.length; j++) if (d[$scope.data.wks[j]] !== undefined) {
                            r = true;
                            $scope.data.value[0][$scope.data.wks[j]] = d[$scope.data.wks[j]];
                        }
                        if (d.address !== undefined || d.location !== undefined || r) {
                            $scope.data.tz = result.tz;
                            $rootScope.currTime = new Date();
                        }
                        $scope.close();
                    }, function (result) {
                        if (result.data.phone !== undefined) {
                            $scope.data.form.phone = '';
                            dialogService.show(gettext("The entered phone number is not valid."), false);
                        }
                        disablef(false);
                    });
                };
            }}).result.finally(function (){ $scope.data.disabled = false });
        };
    });
