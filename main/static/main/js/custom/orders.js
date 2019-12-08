app
    .directive('animateOnChange', function($animate, $timeout) {
        return function(scope, elem, attr) {
            scope.$watch(attr.animateOnChange, function(nv, ov) {
                if (nv == ov) return;
                var c = 'change';
                $animate.addClass(elem, c).then(function() { $timeout(function() { $animate.removeClass(elem, c) }, 2500) });
            });
       }
    })

    .factory('orderListService', function ($timeout, $filter, USER, APIService){
        var service = APIService.init(13), tables = {list: []}, persons = {}, after = null, props;

        return {
            load: function (is_waiter, curr){
                (function tick() {
                    if (props === undefined) props = {is_waiter: is_waiter, curr: curr}; else $timeout.cancel(props.ti);
                    service.query({is_waiter: props.is_waiter, after: after}, function (result){
                        after = (new Date).getTime();
                        for (var i = 0; i < result.length; i++) {
                            var person = result[i].person != null ? result[i].person.id : result[i].session;
                            if (tables.curr === undefined) tables.curr = result[i].ordered_items[0].item.converted === null ? props.curr : USER.currency;
                            for (var a = 0; a < tables.list.length; a++) if (tables.list[a].num == result[i].table_number) break;
                            if (a == tables.list.length) tables.list.push({num: result[i].table_number, total: 0, persons: []});
                            for (var b = 0; b < tables.list[a].persons.length; b++) if (tables.list[a].persons[b].id == person) break;
                            if (b == tables.list[a].persons.length) tables.list[a].persons.push({id: person, total: 0, orders: []});
                            person = tables.list[a].persons[b];
                            var j, obj = [null, null], d = false, o, ind;
                            for (var k = 0; k < person.orders.length; k++) {
                                if (!d) {
                                    ind = {};
                                    if (person.orders[k].ordered_items.length == result[i].ordered_items.length) for (var l = 0; l < person.orders[k].ordered_items.length; l++) for (j = 0; j < result[i].ordered_items.length; j++) if (result[i].ordered_items[j].item.id == person.orders[k].ordered_items[l].item.id) ind[result[i].ordered_items[j].item.id] = result[i].ordered_items[j].quantity;
                                }
                                if (!d && result[i].paid == null && Object.keys(ind).length == result[i].ordered_items.length && (person.orders[k].created != null) == (result[i].created != null) && (person.orders[k].delivered != null) == (result[i].delivered != null) && person.orders[k].request_type == result[i].request_type && (person.orders[k].requested != null) == (result[i].requested != null)) d = true;
                                if (person.orders[k].ids.indexOf(result[i].id) > -1 || d) {
                                    obj[person.orders[k].ids.indexOf(result[i].id) > -1 ? 1 : 0] = person.orders[k];
                                    if (!d) o = k;
                                    if (obj[0] != null && obj[1] != null) break;
                                }
                            }
                            var id = result[i].id;
                            if (result[i].paid == null) {
                                if (obj[0] != null) {
                                    if (obj[0].ids.indexOf(id) === -1) {
                                        obj[0].ids.push(id);
                                        for (j = 0; j < obj[0].ordered_items.length; j++) obj[0].ordered_items[j].quantity += ind[obj[0].ordered_items[j].item.id];
                                    }
                                    obj[0].created = result[i].created;
                                    obj[0].delivered = result[i].delivered;
                                    obj[0].request_type = result[i].request_type;
                                    obj[0].requested = result[i].requested;
                                } else {
                                    ind = {};
                                    for (j = 0; j < result[i].ordered_items.length; j++) ind[result[i].ordered_items[j].item.id] = result[i].ordered_items[j].quantity;
                                    person.orders.push(result[i]);
                                    obj[0] = person.orders[person.orders.length-1];
                                    obj[0].ids = [id];
                                    delete obj[0].id;
                                    delete obj[0].table_number;
                                }
                                if (obj[0].person != null) {
                                    if (!persons.hasOwnProperty(obj[0].person.id)) persons[obj[0].person.id] = obj[0].person;
                                    delete obj[0].person;
                                }
                                for (j = 0; j < obj[0].ordered_items.length; j++) {
                                    person.total += ind[obj[0].ordered_items[j].item.id] * (obj[0].ordered_items[j].item.converted || obj[0].ordered_items[j].item.price);
                                    tables.list[a].total += ind[obj[0].ordered_items[j].item.id] * (obj[0].ordered_items[j].item.converted || obj[0].ordered_items[j].item.price);
                                }
                                var date = obj[0].requested || obj[0].created;
                                if (person.date == null || date != null && new Date(person.date) < new Date(date)) person.date = date;
                            }
                            if (obj[1] != null) {
                                for (j = 0; j < obj[1].ordered_items.length; j++) {
                                    person.total -= ind[obj[1].ordered_items[j].item.id] * (obj[1].ordered_items[j].item.converted || obj[1].ordered_items[j].item.price);
                                    tables.list[a].total -= ind[obj[1].ordered_items[j].item.id] * (obj[1].ordered_items[j].item.converted || obj[1].ordered_items[j].item.price);
                                }
                                obj[1].ids.splice(obj[1].ids.indexOf(id), 1);
                                if (obj[1].ids.length == 0) {
                                    person.orders.splice(o, 1);
                                    if (person.orders.length == 0) tables.list[a].persons.splice(b, 1);
                                }
                            }
                        }
                        props.ti = $timeout(tick, 10000);
                    });
                })();
            },
            tables: tables,
            persons: persons
        }
    })

    .controller('OrdersCtrl', function ($scope, $timeout, APIService, orderListService, dialogService){
        $scope.loadOrders = orderListService.load;
        $scope.tables = orderListService.tables;
        $scope.persons = orderListService.persons;

        $scope.sortPerson = function(person){ return person.date != null ? new Date(person.date) : 0 };
        $scope.sortItem = function(item){ return item.requested || item.delivered || item.created ? new Date(item.requested || item.delivered || item.created) : 0 };

        $scope.openPopover = function (obj){
            if (!obj.opened) {
                $scope.popover = {type: [{count: 0, list: []}, {count: 0, list: []}]};
                function check(o) {
                    if (o.request_type == null && o.delivered == null) {
                        Array.prototype.push.apply($scope.popover.type[0].list, o.ids);
                        $scope.popover.type[0].count++;
                    } else {
                        Array.prototype.push.apply($scope.popover.type[1].list, o.ids);
                        $scope.popover.type[1].count++;
                    }
                }
                if (obj.hasOwnProperty('persons')) {
                    for (var i = 0; i < obj.persons.length; i++) for (var j = 0; j < obj.persons[i].orders.length; j++) check(obj.persons[i].orders[j]);
                } else if (obj.hasOwnProperty('orders')) {
                    for (i = 0; i < obj.orders.length; i++) check(obj.orders[i]);
                } else check(obj);
                $scope.popover.target = obj;
                $timeout(function (){
                    $scope.popover.title = $scope.popover.type[0].list.length > 0 && $scope.popover.type[1].list.length == 0 ? gettext("Confirm delivery below") : $scope.popover.type[1].list.length > 0 && $scope.popover.type[0].list.length == 0 ? gettext("Confirm payment below") : gettext("Choose below");
                    obj.opened = true;
                });
            } else $timeout(function (){ obj.opened = false });

            var service = APIService.init(13);
            $scope.doAction = function (t){
                dialogService.show(gettext("Are you sure?")).then(function (){
                    var data = {ids: '&ids='+$scope.popover.type[t].list.join(',')};
                    if (t == 0) data.delivered = true; else data.paid = true;
                    service.update(data, function (){ orderListService.load() });
                });
            };
        };
    });