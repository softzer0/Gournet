app
    .factory('orderListService', function ($timeout, $filter, USER, APIService){
        var service = APIService.init(15), orders = [], after = null, ti;

        var fields = ['created', 'made', 'requested', 'delivered', 'finished'];
        function load(result){
            for (var i = 0; i < result.length; i++) {
                for (var a = 0; a < fields.length; a++) if (result[i][fields[a]]) {
                    var date = parseFloat(Date.parse(result[i][fields[a]]) / 1000 + parseFloat('0.000'+result[i][fields[a]].substr(-4, 3)));
                    if (after < date) after = date;
                }
                var d = false;
                for (var k = 0; k < orders.length; k++) {
                    if (orders[k].id === result[i].id) {
                        if (orders[k].made != null || result[i].delivered != null || result[i].finished != null) orders.splice(k, 1); else orders[k].to_remove = true;
                        d = true;
                        break;
                    }
                }
                if (!d && result[i].made == null && result[i].delivered == null && result[i].finished == null) {
                    orders.push(result[i]);
                    if (result[i].request_type === 0) result[i].to_remove = true;
                }
            }
        }

        return {
            load: load,
            query: function (){
                (function tick() {
                    if (ti !== undefined) $timeout.cancel(ti);
                    service.query({after: after}, function (result) {
                        load(result);
                        ti = $timeout(tick, 10000);
                    }, function () { ti = $timeout(tick, 10000) });
                })();
            },
            orders: orders
        }
    })

    .controller('OrdersCtrl', function ($scope, $timeout, APIService, orderListService, orderErrorService, dialogService){
        $scope.loadOrders = orderListService.query;
        $scope.orders = orderListService.orders;

        $scope.openPopover = function (obj){
            if (!obj.opened && !obj.to_remove) {
                $scope.target = obj;
                $timeout(function (){
                    obj.opened = true;
                });
            } else $timeout(function (){ obj.opened = false });

            var service = APIService.init(15);
            $scope.doAction = function (){
                dialogService.show(gettext("Are you sure?")).then(function (){
                    service.update({object_id: $scope.target.id, made: true}, function (result){ orderListService.load([result]) }, function (res) {
                        if (res.data && res.data.data) orderListService.load(res.data.data);
                        orderErrorService(res);
                    });
                });
            };
        };

        $scope.remove = function (i) { $scope.orders.splice(i, 1) };
    });