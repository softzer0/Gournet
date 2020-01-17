var oc = ['opened', 'closed'];
app
    .factory('waiterService', function ($timeout, $filter, USER, APIService){
        var service = APIService.init(14), tables = {list: [], last: 0}, has_satsun;

        function add(t, w) {
            if (tables.list[t] === undefined) tables.list[t] = [];
            var r = {id: tables.last, obj: w, edit: {state: false}, dt: [[false, false]]};
            tables.list[t].push(r);
            for (var j = 0; j < 2; j++) if (has_satsun[j] === true) tables.list[t][tables.list[t].length-1].dt.push([false, false]); else for (var k = 0; k < 2; k++) delete w[oc[k]+has_satsun[j]];
            tables.last++;
            return r;
        }

        return {
            add: add,
            load: function (ss){
                has_satsun = ss;
                return service.query({}, function (result){
                    for (var i = 0; i < result.length; i++) {
                        var table = result[i].table-1;
                        delete result[i].table;
                        add(table, result[i]);
                    }
                }).$promise;
            },
            del: function (id){ return service.delete({id: id}).$promise },
            save: function (waiter, id){ return (id ? service.partial_update(angular.extend({object_id: id}, waiter)) : service.save(waiter)).$promise },
            tables: tables
        }
    })

    .controller('WaitersCtrl', function ($scope, $timeout, waiterService, dialogService, usersModalService){
        $scope.tables = waiterService.tables;
        $scope.addTable = function (){ $scope.tables.list.push([]) };

        var wt = [['']];
        $scope.loadWaiters = function (regular, sat, sun){
            $scope.loading = true;
            wt[0].push(regular);
            if (sat) wt.push(['_sat', sat]);
            if (sun) wt.push(['_sun', sun]);
            waiterService.load([!!sat || '_sat', !!sun || '_sun']).then(function (){ delete $scope.loading });
        };

        function delWaiterObj (p_i, i){
            delete $scope.edit_objs[$scope.tables.list[p_i][i].obj.id];
            $scope.tables.list[p_i].splice(i, 1);
        }
        $scope.deleteWaiter = function (p_i, i){
            waiterService.del($scope.tables.list[p_i][i].obj.id).then(function (){ delWaiterObj(p_i, i) });
        };

        $scope.edit_objs = {};
        $scope.showEdit = function (waiter){
            $scope.edit_objs[waiter.id] = angular.extend({}, waiter.obj);
            for (var i = 0; i < wt.length; i++) {
                for (var j = 0; j < 2; j++){
                    var v = $scope.edit_objs[waiter.id][oc[j]+wt[i][0]];
                    $scope.edit_objs[waiter.id][oc[j]+wt[i][0]] = v != null ? new Date(0, 0, 0, v.split(':')[0], v.split(':')[1]) : new Date(0, 0, 0, wt[i][1][j][0], wt[i][1][j][1]);
                }
                if (i > 0) waiter.edit[wt[i][0]] = !!v;
            }
            waiter.edit.state = true;
        };
        $scope.cancelEdit = function (p_i, i){ if ($scope.tables.list[p_i][i].obj.id) $scope.tables.list[p_i][i].edit.state = false; else delWaiterObj(p_i, i) };

        $scope.saveWaiter = function (waiter){
            var obj = angular.extend({}, waiter.obj), id = obj.id;
            if (id) {
                 delete obj.id;
                 delete obj.person;
            } else obj.person = obj.person.id;
            var c = false;
            for (var i = 0; i < wt.length; i++) for (var j = 0; j < 2; j++) {
                if (i === 0 || waiter.edit[wt[i][0]]) {
                    var v = $scope.edit_objs[waiter.id][oc[j] + wt[i][0]], h = '' + v.getHours(), m = '' + v.getMinutes();
                    obj[oc[j] + wt[i][0]] = '00'.substring(0, 2 - h.length) + h + ':' + '00'.substring(0, 2 - m.length) + m;
                } else obj[oc[j] + wt[i][0]] = null;
                if (!c) c = obj[oc[j] + wt[i][0]] !== waiter.obj[oc[j] + wt[i][0]];
            }
            if (!c) {
                waiter.edit.state = false;
                return;
            }
            waiter.edit.state = null;
            waiterService.save(obj, id).then(function (res){
                angular.extend(waiter.obj, res, {person: waiter.obj.person});
                if (!id) delete waiter.obj.table;
                waiter.edit.state = false;
            }, function (res){
                waiter.edit.state = true;
                if (res.data && res.data.non_field_errors) dialogService.show(gettext(res.data.non_field_errors[0]), false);
            });
        };

        $scope.addUsers = function (t){
            var i, u = [];
            for (i = 0; i < $scope.tables.list[t].length; i++) u.push($scope.tables.list[t][i].obj.person.id);
            usersModalService.setAndOpen(null, 0, u.join(',')).result.then(function (res) { for (i = 0; i < res.length; i++) $scope.showEdit(waiterService.add(t, {table: t+1, person: res[i]})) });
        };
    });