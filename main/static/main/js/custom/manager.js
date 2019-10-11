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

    .constant('EDIT_DATA', {value: [[]], form: [[]], tz: undefined})

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
    });
