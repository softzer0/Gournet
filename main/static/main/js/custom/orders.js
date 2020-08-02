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

        var fields = ['created', 'delivered', 'requested', 'finished'];
        function load(result){
            for (var i = 0; i < result.length; i++) {
                var date;
                for (var a = 0; a < fields.length; a++) if (result[i][fields[a]]) {
                    date = parseFloat(Date.parse(result[i][fields[a]]) / 1000 + parseFloat('0.000'+result[i][fields[a]].substr(-4, 3)));
                    if (after < date) after = date;
                }
                var table = null, person;
                if (tables.curr === undefined) tables.curr = result[i].ordered_items[0].item.converted === null ? props.curr : USER.currency;
                for (a = 0; a < tables.list.length; a++) if (tables.list[a].num == result[i].table_number) {
                    table = tables.list[a];
                    break;
                }
                var nt = table === null;
                if (nt) {
                    table = {num: result[i].table_number, total: 0};
                    if (props.is_waiter) table.persons = []; else table.orders = [];
                }
                if (props.is_waiter) {
                    person = result[i].person != null ? result[i].person.id : result[i].session;
                    for (a = 0; a < table.persons.length; a++) if (table.persons[a].id == person) {
                        person = table.persons[a];
                        break;
                    }
                    if (a === table.persons.length) person = {id: person, total: 0, orders: []};
                } else {
                    person = {orders: table.orders};
                }
                var j, obj = [null, null], d = false, o = null, ind;
                for (var k = 0; k < person.orders.length; k++) {
                    if (!d) {
                        ind = {};
                        if (person.orders[k].ordered_items.length == result[i].ordered_items.length) for (var l = 0; l < person.orders[k].ordered_items.length; l++) for (j = 0; j < result[i].ordered_items.length; j++) if (result[i].ordered_items[j].item.id == person.orders[k].ordered_items[l].item.id) ind[result[i].ordered_items[j].item.id] = result[i].ordered_items[j].quantity;
                        d = result[i].finished == null && (result[i].ordered_items.length > 0 || result[i].delivered == null) && Object.keys(ind).length == result[i].ordered_items.length && (person.orders[k].created != null) == (result[i].created != null) && (person.orders[k].delivered != null) == (result[i].delivered != null) && person.orders[k].request_type == result[i].request_type && (person.orders[k].requested != null) == (result[i].requested != null) && person.orders[k].note == result[i].note;
                    }
                    if (person.orders[k].ids.indexOf(result[i].id) > -1 || d) {
                        obj[person.orders[k].ids.indexOf(result[i].id) > -1 ? 1 : 0] = person.orders[k];
                        if (obj[1] != null && o === null) o = k;
                        if ((obj[0] != null || result[i].finished != null) && obj[1] != null) break;
                    }
                }
                var id = result[i].id, e = obj[0] != null, p = 0;
                if (result[i].finished == null && (result[i].ordered_items.length > 0 || result[i].delivered == null)) {
                    if (e) {
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
                        obj[0] = result[i];
                    }
                    for (j = 0; j < obj[0].ordered_items.length; j++) {
                        p += ind[obj[0].ordered_items[j].item.id] * (obj[0].ordered_items[j].item.converted || obj[0].ordered_items[j].item.price);
                    }
                    if (p > 0 || obj[0].delivered == null) {
                        if (!e) {
                            person.orders.push(obj[0]);
                            obj[0].total = 0;
                            obj[0].ids = [id];
                            delete obj[0].id;
                            delete obj[0].table_number;
                        }
                        obj[0].total += p;
                        if (props.is_waiter) person.total += p;
                        table.total += p;
                        if (props.is_waiter && obj[0].person != null) {
                            if (!persons.hasOwnProperty(obj[0].person.id)) persons[obj[0].person.id] = obj[0].person;
                            delete obj[0].person;
                        }
                        date = obj[0].requested || obj[0].created;
                        if (person.date == null || date != null && new Date(person.date) < new Date(date)) person.date = date;
                        if (props.is_waiter && a === table.persons.length) table.persons.push(person);
                        if (nt) tables.list.push(table);
                    }
                }
                if (obj[1] != null) {
                    for (j = 0; j < obj[1].ordered_items.length; j++) {
                        obj[1].ordered_items[j].quantity -= ind[obj[1].ordered_items[j].item.id];
                        p = ind[obj[1].ordered_items[j].item.id] * (obj[1].ordered_items[j].item.converted || obj[1].ordered_items[j].item.price);
                        obj[1].total -= p;
                        if (props.is_waiter) person.total -= p;
                        table.total -= p;
                    }
                    obj[1].ids.splice(obj[1].ids.indexOf(id), 1);
                    if (obj[1].ids.length === 0) {
                        person.orders.splice(o, 1);
                        if (props.is_waiter && person.orders.length === 0) table.persons.splice(a, 1);
                    }
                }
            }
        }

        return {
            load: load,
            query: function (is_waiter, curr){
                (function tick() {
                    if (props === undefined) props = {is_waiter: is_waiter, curr: curr}; else $timeout.cancel(props.ti);
                    service.query({is_waiter: props.is_waiter, after: after}, function (result) {
                        load(result);
                        props.ti = $timeout(tick, 10000);
                    }, function () { props.ti = $timeout(tick, 10000) });
                })();
            },
            tables: tables,
            persons: persons
        }
    })

    .controller('OrdersCtrl', function ($scope, $timeout, APIService, orderListService, dialogService){
        $scope.loadOrders = orderListService.query;
        $scope.tables = orderListService.tables;
        $scope.persons = orderListService.persons;

        $scope.sortPerson = function(person){ return person.date != null ? new Date(person.date) : 0 };
        $scope.sortItem = function(item){ return item.requested || item.delivered || item.created ? new Date(item.requested || item.delivered || item.created) : 0 };

        $scope.openPopover = function (is_waiter, obj){
            if (!obj.opened) {
                $scope.popover = {type: [{count: 0, list: []}]};
                if (is_waiter) $scope.popover.type.push({count: 0, list: []});
                function check(o) {
                    if (o.request_type == null && (!is_waiter && o.total > 0 || is_waiter && o.delivered == null)) {
                        Array.prototype.push.apply($scope.popover.type[0].list, o.ids);
                        $scope.popover.type[0].count++;
                        if ($scope.popover.notes !== undefined && o.note) $scope.popover.notes++;
                    } else if (is_waiter) {
                        Array.prototype.push.apply($scope.popover.type[1].list, o.ids);
                        $scope.popover.type[1].count++;
                    }
                }
                if (obj.hasOwnProperty('persons')) {
                    $scope.popover.notes = 0;
                    for (var i = 0; i < obj.persons.length; i++) for (var j = 0; j < obj.persons[i].orders.length; j++) check(obj.persons[i].orders[j]);
                } else if (obj.hasOwnProperty('orders')) {
                    $scope.popover.notes = 0;
                    for (i = 0; i < obj.orders.length; i++) check(obj.orders[i]);
                } else check(obj);
                $scope.popover.target = obj;
                $timeout(function (){
                    if (!is_waiter && $scope.popover.type[0].list.length == 0) $scope.popover.title = null; else if (!is_waiter && $scope.popover.type[0].list.length > 0) $scope.popover.title = gettext("Choose type of payment"); else $scope.popover.title = $scope.popover.type[0].list.length > 0 && ($scope.popover.type.length == 1 || $scope.popover.type[1].list.length == 0) ? gettext("Confirm delivery below") : $scope.popover.type[1].list.length > 0 && $scope.popover.type[0].list.length == 0 ? gettext("Confirm payment below") : gettext("Choose below");
                    obj.opened = true;
                });
            } else $timeout(function (){ obj.opened = false });

            var service = APIService.init(13);
            $scope.doAction = function (t){
                dialogService.show(gettext("Are you sure?")).then(function (){
                    var data = {ids: '&ids='+$scope.popover.type[$scope.popover.type.length === 2 ? t : 0].list.join(',')};
                    if ($scope.popover.type.length === 1) data.request_type = t; else if (t == 0) data.delivered = true; else data.finished = true;
                    service.update(data, function (result){ orderListService.load(result.data) }, function (res) {
                        dialogService.show(res.data && res.data.detail ? gettext("Either the business has been closed in the meantime, or there is currently no waiter for the table.") : gettext("There was some error while doing this action."), false);
                    });
                });
            };
        };
    });