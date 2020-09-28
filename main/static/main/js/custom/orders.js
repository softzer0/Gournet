app
    .factory('orderListService', function ($timeout, $filter, USER, APIService){
        var service = APIService.init(13), tables = {list: []}, persons = {}, after = null, props;

        function parseDate(d) { return parseFloat(Date.parse(d) / 1000 + parseFloat('0.000'+d.substr(-4, 3))) }
        function parseAfter(d) {
            if (d) {
                var date = parseDate(d);
                if (after < date) after = date;
            }
        }
        var fields = ['created', 'delivered', 'requested', 'finished'];
        function load(result){
            for (var i = 0; i < result.length; i++) {
                for (var a = 0; a < fields.length; a++) parseAfter(result[i][fields[a]]);
                for (a = 0; a < result[i].ordered_items.length; a++) parseAfter(result[i].ordered_items[a].made);
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
                var j, obj = [null, null], d = false, d1 = false, o = null, ind, io = false;
                for (var k = 0; k < person.orders.length; k++) {
                    io = person.orders[k].ids.indexOf(result[i].id) > -1;
                    if (!d) {
                        ind = {};
                        if (person.orders[k].ordered_items.length === result[i].ordered_items.length) {
                            for (var l = 0; l < person.orders[k].ordered_items.length; l++) for (j = 0; j < result[i].ordered_items.length; j++) if (result[i].ordered_items[j].item.id == person.orders[k].ordered_items[l].item.id) {
                                if (!d1) d1 = person.orders[k].ordered_items[l].made == null && result[i].ordered_items[j].made != null;
                                ind[result[i].ordered_items[j].item.id] = [result[i].ordered_items[j].quantity, person.orders[k].ordered_items[l].made != result[i].ordered_items[j].made && result[i].ordered_items[j].made, +(!io || person.orders[k].ordered_items[l].made != result[i].ordered_items[j].made)];
                            }
                            d = result[i].finished == null && (result[i].ordered_items.length > 0 || result[i].delivered == null) && Object.keys(ind).length == result[i].ordered_items.length && (person.orders[k].created != null) == (result[i].created != null) && (person.orders[k].delivered != null) == (result[i].delivered != null) && person.orders[k].request_type == result[i].request_type && (person.orders[k].requested != null) == (result[i].requested != null) && (person.orders[k].note == result[i].note || result[i].delivered != null);
                        }
                    }
                    if (io || d) {
                        if (io) obj[1] = person.orders[k]; else if (obj[0] == null) obj[0] = person.orders[k];
                        if (obj[1] != null && o === null) o = k;
                        if ((obj[0] != null || result[i].finished != null) && obj[1] != null) break;
                    }
                }
                if (d1 && d && obj[0] == null) obj.splice(0, 1);
                var id = result[i].id, e = obj[0] != null, p = 0;
                if (result[i].finished == null && (result[i].ordered_items.length > 0 || result[i].delivered == null)) {
                    if (e) {
                        io = obj[0].ids.indexOf(id) === -1;
                        if (io) obj[0].ids.push(id);
                        for (j = 0; j < obj[0].ordered_items.length; j++) {
                            if (!d1 || io) obj[0].ordered_items[j].quantity += ind[obj[0].ordered_items[j].item.id][0] * ind[obj[0].ordered_items[j].item.id][2];
                            if (ind[obj[0].ordered_items[j].item.id][1] && (obj[0].ordered_items[j].made == null || parseDate(obj[0].ordered_items[j].made) < parseDate(ind[obj[0].ordered_items[j].item.id][1]))) obj[0].ordered_items[j].made = ind[obj[0].ordered_items[j].item.id][1];
                        }
                        obj[0].created = result[i].created;
                        obj[0].delivered = result[i].delivered;
                        obj[0].request_type = result[i].request_type;
                        obj[0].requested = result[i].requested;
                    } else {
                        ind = {};
                        for (j = 0; j < result[i].ordered_items.length; j++) ind[result[i].ordered_items[j].item.id] = [result[i].ordered_items[j].quantity, result[i].ordered_items[j].made];
                        obj[0] = result[i];
                    }
                    var ap = null;
                    for (j = 0; j < obj[0].ordered_items.length; j++) {
                        p += ind[obj[0].ordered_items[j].item.id][0] * (obj[0].ordered_items[j].item.converted || obj[0].ordered_items[j].item.price);
                        if (ind[obj[0].ordered_items[j].item.id][1]) obj[0].ordered_items[j].made_quantity = (obj[0].ordered_items[j].made_quantity || 0) + ind[obj[0].ordered_items[j].item.id][0];
                        if (obj[0].ordered_items[j].has_preparer && ap !== false) ap = obj[0].ordered_items[j].quantity === obj[0].ordered_items[j].made_quantity;
                    }
                    if (ap !== null) obj[0].all_prepared = ap;
                    if (p > 0 || obj[0].delivered == null) {
                        if (!e) {
                            person.orders.push(obj[0]);
                            obj[0].total = 0;
                            obj[0].ids = [id];
                            delete obj[0].id;
                            delete obj[0].table_number;
                        }
                        if (!d1 || io) {
                            obj[0].total += p;
                            if (props.is_waiter) person.total += p;
                            table.total += p;
                        }
                        if (props.is_waiter && obj[0].person != null) {
                            if (!persons.hasOwnProperty(obj[0].person.id)) persons[obj[0].person.id] = obj[0].person;
                            delete obj[0].person;
                        }
                        var date = obj[0].requested || obj[0].created;
                        if (person.date == null || date != null && new Date(person.date) < new Date(date)) person.date = date;
                        if (props.is_waiter && a === table.persons.length) table.persons.push(person);
                        if (nt) tables.list.push(table);
                    }
                }
                if (obj[1] != null) {
                    for (j = 0; j < obj[1].ordered_items.length; j++) {
                        obj[1].ordered_items[j].quantity -= ind[obj[1].ordered_items[j].item.id][0];
                        p = ind[obj[1].ordered_items[j].item.id][0] * (obj[1].ordered_items[j].item.converted || obj[1].ordered_items[j].item.price);
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

    .controller('OrdersCtrl', function ($scope, $timeout, APIService, orderListService, orderErrorService, dialogService){
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
                    if (!is_waiter && $scope.popover.type[0].list.length == 0) $scope.popover.title = null; else if (!is_waiter && $scope.popover.type[0].list.length > 0) $scope.popover.title = gettext("Choose type of payment or request cancellation"); else $scope.popover.title = $scope.popover.type[0].list.length > 0 && ($scope.popover.type.length == 1 || $scope.popover.type[1].list.length == 0) ? gettext("Confirm delivery below") : $scope.popover.type[1].list.length > 0 && $scope.popover.type[0].list.length == 0 ? gettext("Confirm finishment below") : $scope.popover.type[0].list.length > 0 && ($scope.popover.type.length == 1 || $scope.popover.type[1].list.length > 0) ? gettext("Choose below") : null;
                    obj.opened = true;
                });
            } else $timeout(function (){ obj.opened = false });

            var service = APIService.init(13);
            $scope.doAction = function (t){
                dialogService.show(gettext("Are you sure?")).then(function (){
                    var data = {ids: '&ids='+$scope.popover.type[$scope.popover.type.length === 2 ? t-1 : 0].list.join(',')};
                    if ($scope.popover.type.length === 1) data.request_type = t; else if (t == 1) data.delivered = true; else data.finished = true;
                    service.update(data, function (result){ orderListService.load(result.data) }, function (res) {
                        if (res.data && res.data.data) orderListService.load(res.data.data);
                        orderErrorService(res, true);
                    });
                });
            };
        };
    });