var oc = ['opened', 'closed'];
app
    .factory('waiterService', function ($timeout, $filter, USER, APIService){
        var service = APIService.init(14), display_categs = {}, categs = {list: [], opened: false}, tables = [], has_satsun;

        function add_categs(list) {
            for (var i = 0; i < categs.list.length; i++) if (angular.equals(categs.list[i].types, list)) return categs.list[i].list;
            var display = [];
            for (i = 0; i < list.length; i++) display.push(display_categs[list[i]]);
            categs.list.push({types: list, display: display.join('; '), list: []});
            return categs.list[categs.list.length-1].list;
        }

        function add(o) {
            if (o.table != null) {
                var t = o.table - 1;
                if (tables[t] === undefined) tables[t] = [];
                t = tables[t];
            } else t = add_categs(o.categories);
            delete o.table;
            delete o.categories;
            var r = {obj: o, edit: {state: false}, dt: [[false, false], [false, false], [false, false], [false, false], [false, false], [false, false]]};
            t.push(r);
            for (var j = 0; j < 2; j++) if (has_satsun[j] === true) t[t.length-1].dt.push([false, false]); else for (var k = 0; k < 2; k++) delete o[oc[k]+has_satsun[j]];
            tables.last++;
            return r;
        }

        return {
            load_display_categs: function (list) { angular.extend(display_categs, list) },
            add_categs: add_categs,
            add: add,
            load: function (ss){
                has_satsun = ss;
                return service.query({}, function (result){ for (var i = 0; i < result.length; i++) add(result[i]) }).$promise;
            },
            del: function (id){ return service.delete({id: id}).$promise },
            save: function (waiter, id){ return (id ? service.partial_update(angular.extend({object_id: id}, waiter)) : service.save(waiter)).$promise },
            tables: tables,
            categs: categs
        }
    })

    .controller('WaitersCtrl', function ($scope, $timeout, waiterService, dialogService, usersModalService){
        $scope.tables = waiterService.tables;
        $scope.categs = waiterService.categs;
        $scope.addTable = function (){ $scope.tables.push([]) };

        $scope.loadCategs = waiterService.load_display_categs;
        $scope.addCategs = function (){
            $scope.categs.opened = false;
            var categs = $scope.categs.sel;
            $scope.categs.sel = [];
            waiterService.add_categs(categs);
        };

        var wt, days;
        $scope.loadWaiters = function (d, w){
            $scope.loading = true;
            days = d;
            wt = w;
            waiterService.load([w.length >= 7 && days[6], w.length >= 8 && days[7]]).then(function (){ delete $scope.loading });
        };

        function delWaiterObj (p, i){
            delete $scope.edit_objs[p[i].obj.id];
            p.splice(i, 1);
        }
        $scope.deleteWaiter = function (p, i){
            waiterService.del(p[i].obj.id).then(function (){ delWaiterObj(p, i) });
        };

        $scope.edit_objs = {};
        $scope.showEdit = function (waiter){
            $scope.edit_objs[waiter.obj.id] = angular.extend({}, waiter.obj);
            for (var i = 0; i < wt.length; i++) {
                for (var j = 0; j < 2; j++){
                    var v = $scope.edit_objs[waiter.obj.id][oc[j]+days[i]];
                    $scope.edit_objs[waiter.obj.id][oc[j]+days[i]] = v != null ? new Date(0, 0, 0, v.split(':')[0], v.split(':')[1]) : new Date(0, 0, 0, wt[i][j] ? wt[i][j][0] : j === 0 ? 8 : 0, wt[i][j] ? wt[i][j][1] : 0);
                }
                waiter.edit['e'+days[i]] = !!v;
            }
            waiter.edit.state = true;
        };
        $scope.cancelEdit = function (p, i){ if (p[i].obj.id) p[i].edit.state = false; else delWaiterObj(p, i) };

        $scope.saveWaiter = function (target, p){
            var obj = angular.extend({}, target.obj), id = obj.id;
            if (id) {
                 delete obj.id;
                 delete obj.person;
            } else obj.person = obj.person.id;
            var c = false, c1 = false;
            for (var i = 0; i < wt.length; i++) for (var j = 0; j < 2; j++) {
                if (target.edit['e'+days[i]]) {
                    c1 = true;
                    var v = $scope.edit_objs[target.obj.id][oc[j] + days[i]], h = '' + v.getHours(), m = '' + v.getMinutes();
                    obj[oc[j] + days[i]] = '00'.substring(0, 2 - h.length) + h + ':' + '00'.substring(0, 2 - m.length) + m;
                } else obj[oc[j] + days[i]] = null;
                if (!c) c = obj[oc[j] + days[i]] !== target.obj[oc[j] + days[i]];
            }
            if (!c) {
                target.edit.state = false;
                return;
            } else if (!c1) return dialogService.show(gettext("You must set at least one working day."), false);
            target.edit.state = null;
            if (!id) if (!p.list) obj.table = $scope.tables.indexOf(p)+1; else obj.categories = p.types;
            waiterService.save(obj, id).then(function (res){
                angular.extend(target.obj, res, {person: target.obj.person});
                if (!id) {
                    delete target.obj.table;
                    delete target.obj.categories;
                }
                target.edit.state = false;
            }, function (res){
                target.edit.state = true;
                if (res.data && res.data.non_field_errors) dialogService.show(gettext(res.data.non_field_errors[0]), false);
            });
        };

        $scope.addUsers = function (t){
            var u = [];
            if (!t.list) for (var i = 0; i < t.length; i++) u.push(t[i].obj.person.id);
            usersModalService.setAndOpen(null, 0, u.join(',')).result.then(function (res) { for (i = 0; i < res.length; i++) $scope.showEdit(waiterService.add(!t.list ? {table: $scope.tables.indexOf(t)+1, person: res[i]} : {categories: t.types, person: res[i]})) });
        };
    });