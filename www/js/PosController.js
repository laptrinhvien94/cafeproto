angular.module('SunoPosCafe.posController', ['toaster', 'ion-datetime-picker', 'btford.socket-io', "cfp.hotkeys"])
  .controller('PosCtrl', ["$location", "$ionicPosition", "$ionicSideMenuDelegate", "$ionicHistory", "$timeout", "$interval", "$q", "$scope", "$http", "$rootScope", "AuthFactory", "$state", "$ionicPopover", "$ionicPopup", "$ionicModal", "LSFactory", "$ionicScrollDelegate", "toaster", "printer", "$filter", "hotkeys", "Auth", "utils", "SunoPouchDB", PosCtrl])
  .run(function ($ionicPickerI18n) {
      $ionicPickerI18n.weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      $ionicPickerI18n.months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
      $ionicPickerI18n.ok = "Chọn";
      $ionicPickerI18n.cancel = "Hủy";
  });

function PosCtrl($location, $ionicPosition, $ionicSideMenuDelegate, $ionicHistory, $timeout, $interval, $q, $scope, $http, $rootScope, AuthFactory, $state, $ionicPopover, $ionicPopup, $ionicModal, LSFactory, $ionicScrollDelegate, toaster, printer, $filter, hotkeys, Auth, utils, SunoPouchDB) {
    // check platform
    // $scope.timerRunning = true;
    $scope.offline = null;
    $scope.isUseKeyboard = false;
    $scope.isIPad = ionic.Platform.isIPad();
    $scope.isIOS = ionic.Platform.isIOS();
    $scope.isAndroid = ionic.Platform.isAndroid();
    $scope.isWindowsPhone = ionic.Platform.isWindowsPhone();
    //$scope.isUsingOfflineMode = false; //Cờ kiểm tra xem có sử dụng chế độ Offline hay không?
    $scope.isLoggedIn = false; //Cờ kiểm tra đã đăng nhập hay chưa?
    $scope.selectedCategory = ''; //Tên để hiển thị nhóm hàng khi chọn vào category chưa có item.
    $scope.isInTable = true; //Cờ kiểm tra view (Bàn-phòng/Menu), mặc định mới vào sơ đồ bàn.
    $scope.onSearchField = false; //Mới vô thì ko focus vào ô tìm kiếm hàng hóa.
    $scope.appendedCSSClass = ''; //Tên của responsive class CSS bàn/phòng.
    $scope.isUngroupItem = false; //Cờ kiểm tra hàng hóa tách món.
    $scope.isSync = false; //Cờ kiểm tra bật đồng bộ hay không?
    $scope.tablesSetting = null; //Cấu hình bàn phòng
    $scope.removeSetting = null; //Cấu hình hủy món
    $scope.hourService = null; //Cấu hình dịch vụ tính giờ
    $scope.blockCounter = null; //Cấu hình tính giờ theo block
    $scope.BarItemSetting = null; //Cấu hình cho bar
    $scope.printSetting = null; //Cấu hình in

    //DB Local
    var DBSettings = SunoPouchDB.getPouchDBInstance('setting', null); //DB cho các cấu hình thiết lập và SunoGlobal.
    var DBTables = null; //DB cho sơ đồ phòng bàn

    //Socket
    var socket = null; //socket instance
    var manager = null; //manager instance
    var isSocketConnected = false; //Cờ kiểm tra client có đang được kết nối socket với server Node hay không?
    var isSocketInitialized = true; //Cờ kiểm tra xem client có phải vừa được khởi động app hay không?

    //Suno Prototype
    SunoGlobal.printer.ordering = 'asc';
    var $SunoSaleOrderCafe = null; //Lưu SunoSaleOrder instance.
    var $SunoRequest = new SunoRequest(); //SunoRequest instance.
    var $SunoProduct = new SunoProduct(); //SunoProduct instance.
    var $SunoCustomer = new SunoCustomer(); //SunoCustomer instance.

    //Tạo key để định danh client's device trong đồng bộ.
    var deviceID = localStorage.getItem('deviceID'); //ID của device.
    if (deviceID == null) {
        deviceID = uuid.v1();
        localStorage.setItem('deviceID', deviceID);
    }

    //cafe version.
    var version = localStorage.getItem('version'); //Version của Suno Cafe.
    if (version == null) {
        version = '2.0';
        localStorage.setItem('version', version);
    }

    //Tạo timestamp để đồng bộ
    var genTimestamp = function () {
        return new Date().getTime();
    }

    //suggestItems
    $scope.suggestproducts = [];
    $scope.key = null;

    //$scope.getSearchResult = function (key) {
    //    if (!key) {
    //        return;
    //    }
    //    var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        $scope.suggestproducts = angular.copy(data.items);
    //        $scope.ItemSearchIsSelected = null;
    //    }, function (status) { console.log(status) }, true, 'SearchProductItem');
    //}

    //$scope.getSearchResult = function (key) {
    //    if (!key) {
    //        $scope.suglist = false;
    //        return;
    //    }
    //    var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
    //    var method = 'GET';
    //    var data = null;
    //    $SunoRequest.makeRestful(url, method, data)
    //        .then(function (data) {
    //            $scope.searchList = data.items;
    //            $scope.suglist = true;
    //            $scope.ItemSearchIsSelected = null;
    //            $ionicScrollDelegate.$getByHandle('search-product-result').scrollTop();
    //        })
    //        .catch(function (e) {
    //            console.log(e);
    //        });
    //}

    $scope.getSearchResult = function (key) {
        if (!key) {
            //$scope.suglist = false;
            return;
        }
        var storeID = $scope.currentStore.storeID;
        var limit = 1000;
        var pageNo = 1;
        $SunoProduct.searchProductItems(storeID, key, limit, pageNo)
            .then(function (data) {
                $scope.suggestproducts = angular.copy(data.items);
                $scope.ItemSearchIsSelected = null;
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    if ($scope.isAndroid || $scope.isIOS || $scope.isWindowsPhone) {
        $scope.isWebView = false;
    } else
        $scope.isWebView = true;
    // $scope.isWebView = jQuery('body').hasClass('platform-browser');

    // console.log('isWebView :'+ $scope.isWebView);

    $ionicSideMenuDelegate.canDragContent(false);


    //Hàm kiểm tra kết nối internet.
    var checkingInternetConnection = function () {
        //return new Promise(function (resolve, reject) {
        //    var url = Api.ping;
        //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
        //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
        //        $scope.isOnline = true;
        //        resolve(true);
        //    }, function (status) {
        //        $scope.isOnline = false;
        //        reject(false);
        //    }, true, 'Ping', false);
        //});
        var url = Api.ping;
        var method = 'GET';
        var data = null;
        return $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.isOnline = true;
                $scope.$apply();
                return true;
            })
            .catch(function (e) {
                $scope.isOnline = false;
                $scope.$apply();
                return false;
            });
    }

    var notiPopupInstance = null;
    //Hàm hiển thị thông báo cho Client theo dạng single instance.
    var showNotification = function (title, content, callback) {
        if (notiPopupInstance == null) {
            notiPopupInstance = $ionicPopup.alert({
                title: title,
                template: content
            });
            notiPopupInstance.then(function (response) {
                if (callback !== null && typeof callback === 'function') {
                    callback();
                }
                notiPopupInstance = null;
            });
        }
        return notiPopupInstance;
    }

    //Hàm hiển thị thông báo cho Client theo dạng stack.
    var showStackNotification = function (title, content, callback) {
        var stackNoti = $ionicPopup.alert({
            title: title,
            template: content
        });
        stackNoti.then(function (response) {
            if (callback !== null && typeof callback === 'function') {
                callback();
            }
        });
    }

    $scope.isOnline = true;

    $scope.$watch('isOnline', function (n, o) {
        if (n != null && o != null && n != o) {
            if (n) {
                toaster.pop({
                    type: 'success',
                    title: 'Thông báo',
                    body: 'Kết nối internet ổn định',
                    timeout: 5000
                });
            }
            else {
                if (SunoGlobal.saleSetting.allowOfflineCache) {
                    toaster.pop({
                        type: 'warning',
                        title: 'Thông báo',
                        body: 'Đã mất kết nối internet. Bạn đang ở chế độ Offline.',
                        timeout: 5000
                    });
                }
                else {
                    toaster.pop({
                        type: 'warning',
                        title: 'Thông báo',
                        body: 'Đã mất kết nối internet.',
                        timeout: 5000
                    });
                }
            }
        }
    });

    //function audit(actionId, shortContent, embededContent) {
    //    var log = {
    //        "auditTrailModel":
    //          {
    //              "userId": SunoGlobal.userProfile.userId,
    //              "featureId": 23,
    //              "actionId": actionId,
    //              "shortContent": shortContent,
    //              "embededContent": embededContent,
    //              "storeId": $scope.currentStore.storeID,
    //              "companyId": SunoGlobal.companyInfo.companyId,
    //          },
    //        "extConfig": {
    //            db: DBSettings,
    //            token: $scope.token
    //        }
    //    }
    //    var url = Api.auditTrailRecord;
    //    asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', log, function (data, status) {
    //        if (data) {
    //            // console.log(data);
    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'auditTrailRecord');
    //}

    var audit = function (actionId, shortContent, embededContent) {
        var data = {
            "auditTrailModel":
            {
                "userId": SunoGlobal.userProfile.userId,
                "featureId": 23,
                "actionId": actionId,
                "shortContent": shortContent,
                "embededContent": embededContent,
                "storeId": $scope.currentStore.storeID,
                "companyId": SunoGlobal.companyInfo.companyId,
            }
        }
        var url = Api.auditTrailRecord;
        var method = 'POST';
        $SunoRequest.makeRestful(url, method, data);
    }

    $scope.openLink = function (url) {
        if (window.cordova) {
            cordova.InAppBrowser.open(url, '_system');
        }
    }

    //$scope.getSyncSetting = function () {
    //    var deferred = $q.defer();
    //    var url = Api.getKeyValue + 'isSync';
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', null, function (data, status) {
    //        if (data) {
    //            if (data.value != "") {
    //                var rs = JSON.parse(data.value);
    //            }
    //            $scope.isSync = rs;
    //            console.log('isSync:', rs);
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        console.log(error);
    //        error.where = "getSyncSetting";
    //        deferred.reject(error);
    //    }, true, 'isSync');
    //    return deferred.promise;
    //}

    //$scope.getCompanyInfo = function () {
    //    var deferred = $q.defer();
    //    var url = Api.getCompanyInfo;
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', null, function (data, status) {
    //        if (data) {
    //            $scope.companyInfo = data;
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        console.log(error);
    //        error.where = "getCompanyInfo";
    //        deferred.reject(error);
    //    }, true, 'getCompanyInfo');
    //    return deferred.promise;
    //}

    var getCompanyInfo = function () {
        var url = Api.getCompanyInfo;
        var method = 'GET';
        var data = null;
        return $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.companyInfo = data;
                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                console.log(e);
                return e;
            });
    }
    var getBootLoader = function () {
        var url = Api.bootloader;
        var method = 'POST';
        var data = null;
        return $SunoRequest.makeRestful(url, method, data);
    }

    var getAuthBootLoader = function () {
        var url = Api.authBootloader;
        var method = 'POST';
        var data = null;
        return $SunoRequest.makeRestful(url, method, data);
    }

    //// Lấy mẫu in đã lưu
    //$scope.getPrintTemplate = function () {
    //    var deferred = $q.defer();
    //    var url = Api.printTemplate;
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', null, function (data, status) {
    //        if (data) {
    //            printer.initializeTemplates(data);
    //            deferred.resolve();
    //        }
    //    }, function (e) {
    //        e.where = "getPrintTemplate"
    //        deferred.reject(e);
    //        printer.initializeTemplates();
    //        console.log(e);
    //    }, true, 'getPrintTemplates');
    //    return deferred.promise;
    //}
    var getPrintTemplate = function () {
        var url = Api.printTemplate;
        var method = 'GET';
        var data = null;
        return $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                printer.initializeTemplates(data);
                return null;
            })
            .catch(function (e) {
                console.log(e);
                printer.initializeTemplates();
                return e;
            });
    }

    //$scope.getProductItems = function (cid, categoryName) {
    //    if (categoryName && categoryName != '') {
    //        $scope.selectedCategory = ' thuộc nhóm ' + categoryName.toUpperCase();
    //    }
    //    else {
    //        $scope.selectedCategory = '';
    //    }
    //    $scope.buttonProductListStatus = 0;
    //    $scope.currentCategory = cid;
    //    var deferred = $q.defer();
    //    $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
    //    var limit = 1000;
    //    var pageIndex = 1;
    //    var url = Api.productitems + 'categoryId=' + cid + '&limit=' + limit + '&pageIndex=' + pageIndex + '&storeId=' + $scope.currentStore.storeID;
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', null, function (data, status) {
    //        if (data) {
    //            $scope.productItemList = data.items;
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        console.log(error)
    //        error.where = "getProductItems";
    //        deferred.reject(error);
    //    }, true, 'getProductItems');
    //    return deferred.promise;
    //}

    //$scope.getProductItems = function (cid, categoryName) {
    //    if (categoryName && categoryName != '') {
    //        $scope.selectedCategory = ' thuộc nhóm ' + categoryName.toUpperCase();
    //    }
    //    else {
    //        $scope.selectedCategory = '';
    //    }
    //    $scope.buttonProductListStatus = 0;
    //    $scope.currentCategory = cid;
    //    $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
    //    var limit = 1000;
    //    var pageIndex = 1;
    //    var url = Api.productitems + 'categoryId=' + cid + '&limit=' + limit + '&pageIndex=' + pageIndex + '&storeId=' + $scope.currentStore.storeID;
    //    var method = 'GET';
    //    var data = null;
    //    return $SunoRequest.makeRestful(url, method, data)
    //        .then(function (data) {
    //            $scope.productItemList = data.items;
    //            return null;
    //        })
    //        .catch(function (e) {
    //            console.log(e);
    //            return e;
    //        });
    //}

    $scope.getProductItems = function (cid, categoryName) {
        if (categoryName && categoryName != '') {
            $scope.selectedCategory = ' thuộc nhóm ' + categoryName.toUpperCase();
        }
        else {
            $scope.selectedCategory = '';
        }
        $scope.buttonProductListStatus = 0;
        $scope.currentCategory = cid;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var limit = 1000;
        var pageIndex = 1;
        var storeID = $scope.currentStore.storeID;
        if (cid != '') {
            return $SunoProduct.getProductItemsByCategory(storeID, cid, limit, pageIndex)
                .then(function (data) {
                    $scope.productItemList = data.items;
                    $scope.$apply();
                    return null;
                })
                .catch(function (e) {
                    console.log(e);
                    return e;
                });
        }
        else {
            return $SunoProduct.getProductItems(storeID, limit, pageIndex)
                .then(function (data) {
                    $scope.productItemList = data.items;
                    $scope.$apply();
                    return null;
                })
                .catch(function (e) {
                    console.log(e);
                    return e;
                });
        }
    }

    //$scope.getNewProductItems = function () {
    //    $scope.buttonProductListStatus = 1;
    //    $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
    //    var url = Api.getNewProduct + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            $scope.productItemList = data.items;
    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'getNewProductItems');
    //}

    $scope.getNewProductItems = function () {
        $scope.buttonProductListStatus = 1;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var url = Api.getNewProduct + $scope.currentStore.storeID;
        var method = 'GET';
        var data = null;
        $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.productItemList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }
    
    //$scope.getBestSellingProductItems = function () {
    //    $scope.buttonProductListStatus = 2;
    //    $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
    //    var url = Api.getBestSelling + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            $scope.productItemList = data.items;
    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'getBestSellingProductItem');
    //}

    $scope.getBestSellingProductItems = function () {
        $scope.buttonProductListStatus = 2;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var url = Api.getBestSelling + $scope.currentStore.storeID;
        var method = 'GET';
        var data = null;
        $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.productItemList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }


    //// Lấy danh sách categories
    //$scope.getAllCategories = function () {
    //    var deferred = $q.defer();
    //    var url = Api.categories;
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', null, function (data, status) {
    //        if (data) {
    //            $scope.categories = data.categories;
    //            $scope.categories = buildTree($scope.categories);
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        console.log(error);
    //        error.where = "getAllCategories"
    //        deferred.reject(error);
    //    }, true, 'getAllCategories');
    //    return deferred.promise;
    //}

    //var getAllCategories = function () {
    //    var url = Api.categories;
    //    var method = 'GET';
    //    var data = null;
    //    return $SunoRequest.makeRestful(url, method, data)
    //        .then(function (data) {
    //            console.log(data);
    //            $scope.categories = data.categories;
    //            $scope.categories = buildTree($scope.categories);
    //            return null;
    //        })
    //        .catch(function (e) {
    //            console.log(e);
    //            return e;
    //        });
    //}
    var getAllCategories = function () {
        return $SunoProduct.getCategories()
            .then(function (categories) {
                $scope.categories = categories;
                $scope.categories = buildTree($scope.categories);
                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                console.log(e);
                return e;
            })
    }


    // Tìm sản phẩm
    $scope.suglist = false;
    //$scope.get_search_rs = function (key) {
    //    if (!key) {
    //        $scope.suglist = false;
    //        return;
    //    }
    //    var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        $scope.searchList = data.items;
    //        $scope.suglist = true;
    //        $scope.ItemSearchIsSelected = null;
    //        $ionicScrollDelegate.$getByHandle('search-product-result').scrollTop();
    //    }, function (status) { console.log(status) }, true, 'SearchProductItem');
    //}


    $scope.openCreateTablesModal = function () {
        if ($scope.popoverSettings) $scope.popoverSettings.hide();
        $ionicModal.fromTemplateUrl('create-tables.html', {
            scope: $scope,
            animation: 'slide-in-up',
            backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalCreateTables = modal;
            $scope.modalCreateTables.show();
        });
    }

    $scope.createInitTableZone = function (z, q, u) {
        if (!q) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.tableMap.length,
            zone: z ? z : '',
            quantity: q,
            unit: u ? 'Phòng' : 'Bàn',
            unit2: u,
            isUpdating: false
        }
        $scope.modalCreateTables.zone = null;
        $scope.modalCreateTables.quantity = null;
        $scope.tableMap.push(t);
        // $scope.createTable();
    }

    $scope.createTable = function () {

        if (!$scope.tablesSetting) $scope.tablesSetting = [];
        $scope.count = 1;
        var tableTAW = {
            tableUuid: uuid.v1(),
            tableId: 0,
            tableIdInZone: 0,
            tableName: 'Mang về',
            tableZone: {},
            tableStatus: 0,
            tableOrder: [{
                saleOrder: {
                    //revision: 0,
                    orderDetails: []
                }
            }]
        }
        angular.copy(saleOrder, tableTAW.tableOrder[0].saleOrder);
        $scope.tables.push(tableTAW);
        if ($scope.tableMap && $scope.tableMap.length > 0) {
            for (var i = 0; i < $scope.tableMap.length; i++) {
                if ($scope.tableMap[i].hasOwnProperty('unit2')) {
                    delete $scope.tableMap[i].unit2;
                }
                if ($scope.tableMap[i].hasOwnProperty('isUpdating')) {
                    delete $scope.tableMap[i].isUpdating;
                }
                for (var j = 0; j < $scope.tableMap[i].quantity; j++) {
                    var count = j + 1;
                    var t = {
                        tableUuid: uuid.v1(),
                        tableId: $scope.count++,
                        tableIdInZone: count,
                        tableName: $scope.tableMap[i].unit + ' ' + count + ' - ' + $scope.tableMap[i].zone,
                        tableZone: $scope.tableMap[i],
                        tableStatus: 0,
                        tableOrder: [{
                            saleOrder: {
                                orderDetails: []
                            }
                        }]
                    }
                    angular.copy(saleOrder, t.tableOrder[0].saleOrder);
                    $scope.tables.push(t);
                }
            }
        }
        $scope.tablesSetting.push({
            storeId: $scope.currentStore.storeID,
            tables: $scope.tables,
            zone: $scope.tableMap
        });

        //var data = {
        //    "key": "tableSetting",
        //    "value": JSON.stringify($scope.tablesSetting),
        //    "extConfig": {
        //        db: DBSettings,
        //        token: $scope.token
        //    }
        //}

        //var url = Api.postKeyValue;
        //console.log(data.value);
        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
        //    if (data) {
        //        ////debugger;
        //        //($scope.tables.length > 1) ? $scope.leftviewStatus = false : $scope.leftviewStatus = true;
        //        $scope.tableIsSelected = $scope.tables[0];
        //        $scope.orderIndexIsSelected = 0;
        //        $scope.modalCreateTables.hide();

        //        if (!$scope.isSync) {
        //            $scope.updateSyncSetting(true);
        //        } else {
        //            $scope.endSession();
        //        }

        //        toaster.pop('success', "", 'Đã lưu sơ đồ bàn thành công!');
        //    }
        //}, function (error) {
        //    console.log(error)
        //}, true, 'setKeyValue');
        var url = Api.postKeyValue;
        var method = 'POST';
        var data = {
            "key": "tableSetting",
            "value": JSON.stringify($scope.tablesSetting),
        };

        $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.tableIsSelected = $scope.tables[0];
                $scope.orderIndexIsSelected = 0;
                $scope.modalCreateTables.hide();

                if (!$scope.isSync) {
                    $scope.updateSyncSetting(true);
                    $scope.$apply();
                } else {
                    $scope.endSession();
                }
                toaster.pop('success', "", 'Đã lưu sơ đồ bàn thành công!');
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    $scope.showEditTable = false;
    $scope.editTableZone = function (index) {
        console.log($scope.newTableMapTemp[index]);
        $scope.newTableMapTemp[index].isUpdating = true;
        $scope.newTableMapTemp[index].unit2 = $scope.newTableMapTemp[index].unit == 'Phòng' ? true : false;
        //$scope.showEditTable = true;
        //$scope.selectedZone = $scope.tableMap[index];
        //($scope.selectedZone.unit == 'Bàn') ? $scope.selectedZone.toogle = false: $scope.selectedZone.toogle = true;
    }

    $scope.removeTableZone = function (index) {
        $scope.tableMap.splice(index, 1);
    }

    $scope.saveChangeZone = function () {
        $scope.selectedZone.toogle ? $scope.selectedZone.unit = 'Phòng' : $scope.selectedZone.unit = 'Bàn';
        $scope.showEditTable = false;
    }

    $scope.checkInitTable = function () {
        //var permissionIndex = $scope.userSession.permissions.indexOf("POSIM_Manage");
        var isManager = SunoGlobal.permissions.indexOf("POSIM_Manage") > -1;
        if (isManager) {
            $scope.openCreateTablesModal();
        } else {
            var tableTAW = {
                tableUuid: uuid.v1(),
                tableId: 0,
                tableIdInZone: 0,
                tableName: 'Mang về',
                tableZone: {},
                tableStatus: 0,
                tableOrder: [{
                    saleOrder: {
                        //revision: 0,
                        orderDetails: []
                    },
                    promotion: {
                        isPromotion: false,
                        isCallApi: false,
                        promotionOnItem: [],
                        promotionOnBill: []
                    }
                }]
            }
            angular.copy(saleOrder, tableTAW.tableOrder[0].saleOrder);
            $scope.tables.push(tableTAW);
        }
    }

    //$scope.getSettings = function () {
    //    var deferred = $q.defer();
    //    var url = Api.getMultiKeyValue;
    //    asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', { 'keys': ['isSync', 'tableSetting', 'removeItemSetting', 'hourServiceSetting', 'BarItemSetting', 'printSetting'] }, function (data, status) {
    //        if (data) {
    //            var isSyncSetting = data.values.find(function (s) { return s.name == 'isSync' });
    //            if (!isSyncSetting) isSyncSetting = { value: "" };
    //            if (isSyncSetting) {
    //                if (isSyncSetting.value != "") {
    //                    var ss = JSON.parse(isSyncSetting.value);
    //                }
    //                $scope.isSync = ss;
    //                //console.log('isSync:', rs);
    //            }

    //            var tableSetting = data.values.find(function (s) { return s.name == 'tableSetting' });
    //            if (tableSetting) {
    //                if (tableSetting.value != "") {
    //                    var ts = JSON.parse(tableSetting.value);
    //                    //console.log(ts);
    //                }
    //                $scope.tablesSetting = ts;
    //            }

    //            var removeItemSetting = data.values.find(function (s) { return s.name == 'removeItemSetting' });
    //            if (removeItemSetting) {
    //                if (removeItemSetting.value) {
    //                    var rs = JSON.parse(removeItemSetting.value);
    //                } else {
    //                    var rs = 2;
    //                }
    //                $scope.removeSetting = rs;
    //                //console.log('removeItemSetting:', rs);
    //            }
    //            else {
    //                $scope.removeSetting = 2;
    //            }

    //            var hourServiceSetting = data.values.find(function (s) { return s.name == 'hourServiceSetting' });
    //            if (!hourServiceSetting) hourServiceSetting = { value: "" };
    //            if (hourServiceSetting) {
    //                if (hourServiceSetting.value) {
    //                    var hss = JSON.parse(hourServiceSetting.value);
    //                } else {
    //                    var hss = null;
    //                }
    //                if (hss != null) {
    //                    $scope.hourService = hss;
    //                } else {
    //                    $scope.hourService = {
    //                        isUse: false,
    //                        optionSelected: "1"
    //                    }
    //                }

    //                if ($scope.hourService && $scope.hourService.isUse) {
    //                    switch ($scope.hourService.optionSelected) {
    //                        case "1":
    //                            $scope.blockCounter = 15;
    //                            break;
    //                        case "2":
    //                            $scope.blockCounter = 30;
    //                            break;
    //                        case "3":
    //                            $scope.blockCounter = 60;
    //                            break;
    //                        case "0":
    //                            $scope.blockCounter = $scope.hourService.customOption;
    //                            break;
    //                    }
    //                }
    //                //console.log('hourServiceSetting:', rs);
    //            }

    //            var BarItemSetting = data.values.find(function (s) { return s.name == 'BarItemSetting' });
    //            if (!BarItemSetting) BarItemSetting = { value: "" };
    //            if (BarItemSetting) {
    //                if (BarItemSetting.value) {
    //                    $scope.BarItemSetting = JSON.parse(BarItemSetting.value);
    //                } else {
    //                    $scope.BarItemSetting = null;
    //                }
    //                //console.log('BarItemSetting:', data);
    //            }

    //            var printSetting = data.values.find(function (s) { return s.name == 'printSetting' });
    //            if (printSetting) {
    //                if (printSetting.value != "") {
    //                    var ps = JSON.parse(printSetting.value);
    //                    $scope.printSetting = ps;
    //                    $scope.isUngroupItem = $scope.printSetting.unGroupItem;
    //                } //else {
    //                //    $scope.printSetting = {
    //                //        'printSubmitOrder': false,
    //                //        'printNoticeKitchen': false,
    //                //        'prePrint': false,
    //                //        'unGroupItem': false,
    //                //        'noticeByStamps': false
    //                //    };
    //                //}
    //                //console.log('printSetting:', rs);
    //            }
    //            else {
    //                $scope.printSetting = {
    //                    'printSubmitOrder': false,
    //                    'printNoticeKitchen': false,
    //                    'prePrint': false,
    //                    'unGroupItem': false,
    //                    'noticeByStamps': false
    //                };
    //            }
    //            deferred.resolve(data);
    //        }
    //    }, function (error) {
    //        console.log(error);
    //        error.where = "getSettings";
    //        deferred.reject(error);
    //    }, true, 'getSettings');

    //    return deferred.promise;
    //}

    var getSettings = function () {
        var isSyncSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'isSync' });
        if (!isSyncSetting) isSyncSetting = { value: "" };
        if (isSyncSetting) {
            if (isSyncSetting.value != "") {
                var ss = JSON.parse(isSyncSetting.value);
            }
            $scope.isSync = ss;
            //console.log('isSync:', rs);
        }

        var tableSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'tableSetting' });
        if (tableSetting) {
            if (tableSetting.value != "") {
                var ts = JSON.parse(tableSetting.value);
                //console.log(ts);
            }
            $scope.tablesSetting = ts;
        }

        var removeItemSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'removeItemSetting' });
        if (removeItemSetting) {
            if (removeItemSetting.value) {
                var rs = JSON.parse(removeItemSetting.value);
            } else {
                var rs = 2;
            }
            $scope.removeSetting = rs;
            //console.log('removeItemSetting:', rs);
        }
        else {
            $scope.removeSetting = 2;
        }

        var hourServiceSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'hourServiceSetting' });
        if (!hourServiceSetting) hourServiceSetting = { value: "" };
        if (hourServiceSetting) {
            if (hourServiceSetting.value) {
                var hss = JSON.parse(hourServiceSetting.value);
            } else {
                var hss = null;
            }
            if (hss != null) {
                $scope.hourService = hss;
            } else {
                $scope.hourService = {
                    isUse: false,
                    optionSelected: "1"
                }
            }

            if ($scope.hourService && $scope.hourService.isUse) {
                switch ($scope.hourService.optionSelected) {
                    case "1":
                        $scope.blockCounter = 15;
                        break;
                    case "2":
                        $scope.blockCounter = 30;
                        break;
                    case "3":
                        $scope.blockCounter = 60;
                        break;
                    case "0":
                        $scope.blockCounter = $scope.hourService.customOption;
                        break;
                }
            }
            //console.log('hourServiceSetting:', rs);
        }

        var BarItemSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'BarItemSetting' });
        if (!BarItemSetting) BarItemSetting = { value: "" };
        if (BarItemSetting) {
            if (BarItemSetting.value) {
                $scope.BarItemSetting = JSON.parse(BarItemSetting.value);
            } else {
                $scope.BarItemSetting = null;
            }
            //console.log('BarItemSetting:', data);
        }

        var printSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'printSetting' });
        if (printSetting) {
            if (printSetting.value != "") {
                var ps = JSON.parse(printSetting.value);
                $scope.printSetting = ps;
                $scope.isUngroupItem = $scope.printSetting.unGroupItem;
            } //else {
            //    $scope.printSetting = {
            //        'printSubmitOrder': false,
            //        'printNoticeKitchen': false,
            //        'prePrint': false,
            //        'unGroupItem': false,
            //        'noticeByStamps': false
            //    };
            //}
            //console.log('printSetting:', rs);
        }
        else {
            $scope.printSetting = {
                'printSubmitOrder': false,
                'printNoticeKitchen': false,
                'prePrint': false,
                'unGroupItem': false,
                'noticeByStamps': false
            };
        }
    }

    var template = '<ion-popover-view><ion-header-bar> <h1 class="title">My Popover Title</h1> </ion-header-bar> <ion-content> <p ng-repeat="i in tables">{{tableName}}</p> </ion-content></ion-popover-view>';

    $scope.modelToSearch = null;
    $scope.popover = $ionicPopover.fromTemplate(template, {
        scope: $scope
    });

    $scope.openPopover = function ($event) {
        $scope.popover.show($event);
    };

    $scope.openPopover = function ($event) {
        $scope.popover.show($event);
    };


    $scope.quantityTablePerRow = null;
    $scope.quantityItemPerRow = null;

    var validateUsagePackage = function (SunoGlobal) {
        var dateTxt = SunoGlobal.usageInfo.overallExpiryDateText;
        var dateArr = dateTxt.split('/');
        var expiredDateNum = new Date(dateArr[2], dateArr[1] - 1, dateArr[0]).getTime();
        var nowDateNum = new Date().getTime();
        if (expiredDateNum > nowDateNum) return true;
        return false;   
    }

    var findFisrtElement = function (array, startIndex) {
        var prefix = startIndex == 0 ? 'p2-' : 'p1-';
        for (var x = startIndex; x < array.length; x++) {
            var id = startIndex == 0 ? $scope.productItemList[x].itemId : $scope.tables[x].tableUuid;
            var eID = prefix + id;
            var e = document.getElementById(eID);
            if (e) {
                return e.offsetWidth;
            }
        }
        return -1;
    }

    var buildHotKeyIndex = function () {
        //Build Index để dùng phím tắt cho sơ đồ bàn và thực đơn.
        $timeout(function () {
            if (window.location.hash == '#/') {
                //Kiểm tra sơ đồ bàn để tránh trường hợp đăng nhập 2 tabs và logout 1 bên. bên kia refresh lại thì báo lỗi.
                if ($scope.tables && $scope.tables[1]) {
                    //var id = 'p1-' + $scope.tables[1].tableUuid;
                    //var widthOfOneTable = document.getElementById(id).offsetWidth;
                    var widthOfOneTable = findFisrtElement($scope.tables, 1);
                    var widthOfOneRow = document.getElementById('buildHotKeyIndex').offsetWidth;
                    //console.log(widthOfOneTable);
                    //console.log(widthOfOneRow);
                    $scope.quantityTablePerRow = Math.floor(widthOfOneRow / widthOfOneTable);
                }
                if ($scope.productItemList && $scope.productItemList[0]) {
                    //var id = 'p2-' + $scope.productItemList[0].itemId;
                    //var widthOfOneItem = document.getElementById(id).offsetWidth;
                    var widthOfOneItem = findFisrtElement($scope.productItemList, 0);
                    var widthOfOneRowItem = document.getElementById('buildHotKeyIndexInItemList').offsetWidth;
                    $scope.quantityItemPerRow = Math.floor(widthOfOneRowItem / widthOfOneItem);
                }
            }
        }, 200);
    };

    window.addEventListener('resize', function (e) {
        buildHotKeyIndex();
        //$scope.$apply();
    })

    //$q.when(Promise.all([Auth.getToken(), Auth.getUser(), Auth.getSetting(), Auth.getStoreList(), DBSettings.$getDocByID({ _id: 'currentStore' }), Auth.getBootloader(), Auth.getSessionId()]))
    $q.when(Auth.getSunoGlobal())
    .then(function (data) {
        //Nếu check dưới DB Local chưa có SunoGlobal mà đã vào route pos thì đẩy ra màn hình đăng nhập.
        if (data.docs.length > 0) {
            //Gán lại accessToken cho SunoGlobal trường hợp vào luôn route pos thì SunoGlobal ko có accessToken để lấy BootLoader và AuthBootloader.
            //Nếu mà vào từ route Login thì SunoGlobal đã được gán lại ở route Login.
            if (SunoGlobal.token.accessToken == '' && SunoGlobal.token.refreshToken == '') {
                for (var prop in data.docs[0].SunoGlobal) {
                    SunoGlobal[prop] = data.docs[0].SunoGlobal[prop];
                }
            }
            $scope.isLoggedIn = true;
            return Promise.all([getBootLoader(), getAuthBootLoader(), DBSettings.$getDocByID({ _id: 'currentStore' })]);
        }
        else {
            $state.go('login', {}, {
                reload: true
            });
            throw { errorCode: 1, errorMsg: "Chưa đăng nhập." };
        }
    })
    .then(function (data) {
        //Chỗ này để validate response khi get BootLoader và AuthBootLoader.
        //Nếu có lỗi xảy ra thì thông báo lên cho người dùng biết để refresh lại.
        if (data[0] && data[1]) {
            //Validate thời hạn sử dụng
            if (!validateUsagePackage(data[1])) {
                var popUp = $ionicPopup.alert({
                    title: 'Thông báo',
                    template: '<p style="text-align:center;">Tài khoản của bạn đã hết hạn.</p>'
                });
                popUp.then(function () {
                    $state.go('login', {}, {
                        reload: true
                    });
                });
                throw { errorCode: 2, errorMsg: "Hết hạn sử dụng" };
            }
            //$scope.token = data[0].docs[0].token;
            //$scope.userSession = data[1].docs[0].user; 
            //$scope.settings = data[2].docs[0].setting;
            //$scope.storesList = data[3].docs[0].store;
            //$scope.authBootloader = data[5].docs[0].bootloader;
            //SunoGlobal.userProfile.sessionId = data[6].docs[0].session;
            //$scope.saleList = $scope.authBootloader.users.userProfiles;
            //console.log(data);
            //Gán lại giá trị từ API response cho SunoGlobal
            SunoGlobal.stores = data[0].allStores;
            SunoGlobal.featureActivations = data[0].featureActivations;
            SunoGlobal.companyInfo.companyCode = data[1].companyCode;
            SunoGlobal.companyInfo.companyPhone = data[1].companyPhone;
            SunoGlobal.companyInfo.companyAddress = data[1].companyAddress;
            SunoGlobal.companyInfo.companyTaxCode = data[1].companyTaxCode;
            SunoGlobal.companyInfo.industry = data[1].industry;
            SunoGlobal.storeIdsGranted = data[1].storeIdsGranted;
            SunoGlobal.usageInfo = data[1].usageInfo;
            SunoGlobal.rolesGranted = data[1].rolesGranted;
            SunoGlobal.users = data[1].users.userProfiles;

            SunoGlobal.saleSetting.cogsCalculationMethod = data[0].saleSetting.cogsCalculationMethod;
            SunoGlobal.saleSetting.isAllowDebtPayment = data[0].saleSetting.allowDebtPayment;
            SunoGlobal.saleSetting.isAllowPriceModified = data[0].saleSetting.allowPriceModified;
            SunoGlobal.saleSetting.isAllowQuantityAsDecimal = data[0].saleSetting.allowQuantityAsDecimal;
            SunoGlobal.saleSetting.isApplyCustomerPricingPolicy = data[0].saleSetting.applyCustomerPricingPolicy;
            SunoGlobal.saleSetting.isApplyEarningPoint = data[0].saleSetting.applyEarningPoint;
            SunoGlobal.saleSetting.isApplyPromotion = data[0].saleSetting.applyPromotion;
            SunoGlobal.saleSetting.isPrintMaterials = data[0].saleSetting.isPrintMaterials;
            SunoGlobal.saleSetting.isProductReturnDay = data[0].saleSetting.allowProductReturnDay;
            SunoGlobal.saleSetting.productReturnDay = data[0].saleSetting.productReturnDay;
            SunoGlobal.saleSetting.saleReportSetting = data[0].saleSetting.saleReportSetting;
            SunoGlobal.saleSetting.allowOfflineCache = data[0].saleSetting.allowOfflineCache;
            SunoGlobal.saleSetting.allowTaxModified = data[0].saleSetting.allowTaxModified;
            SunoGlobal.saleSetting.applyCustomerCare = data[0].saleSetting.applyCustomerCare;
            SunoGlobal.saleSetting.bankTransferPaymentMethod = data[0].saleSetting.bankTransferPaymentMethod;
            SunoGlobal.saleSetting.cardPaymentMethod = data[0].saleSetting.cardPaymentMethod;
            SunoGlobal.saleSetting.cashPaymentMethod = data[0].saleSetting.cashPaymentMethod;
            SunoGlobal.saleSetting.currencyNote = data[0].saleSetting.currencyNote;
            SunoGlobal.saleSetting.customerEmailConfiguration = data[0].saleSetting.customerEmailConfiguration;
            SunoGlobal.saleSetting.isHasSampleData = data[0].saleSetting.isHasSampleData;
            SunoGlobal.saleSetting.longtimeInventories = data[0].saleSetting.longtimeInventories;
            SunoGlobal.saleSetting.receiptVoucherMethod = data[0].saleSetting.receiptVoucherMethod;
            SunoGlobal.saleSetting.showInventoryTotal = data[0].saleSetting.showInventoryTotal;
            SunoGlobal.saleSetting.storeChangeAutoApproval = data[0].saleSetting.storeChangeAutoApproval;
            SunoGlobal.saleSetting.weeklyReportEmail = data[0].saleSetting.weeklyReportEmail;

            //Gán lại giá trị cho các biến.
            $scope.storesList = data[0].allStores;
            $scope.userSession = {
                companyId: SunoGlobal.companyInfo.companyId,
                companyName: SunoGlobal.companyInfo.companyName,
                email: SunoGlobal.userProfile.email,
                userId: SunoGlobal.userProfile.userId,
                displayName: SunoGlobal.userProfile.fullName,
                permissions: SunoGlobal.permissions,
                isAdmin: SunoGlobal.userProfile.isAdmin,
                sesssionId: SunoGlobal.userProfile.sessionId,
                authSessionId: SunoGlobal.userProfile.authSessionId
            };
            $scope.settings = {
                saleSetting: data[0].saleSetting
            };

            $scope.authBootloader = {
                rolesGranted: data[1].rolesGranted,
                users: data[1].users
            };
            if (data[2].docs.length > 0) {

                //Nếu Store dưới DB Local vẫn còn ds stores của cửa hàng thì gán lại cho currentStore, nếu ko còn thì gán lại store đầu tiên
                //var storeIndex = findIndex($scope.storesList, 'storeID', localCurrentStore.storeID);
                var storeIndex = SunoGlobal.stores.findIndex(function (s) { return s.storeID == data[2].docs[0].currentStore.storeID });
                if (storeIndex != -1) {
                    $scope.currentStore = data[2].docs[0].currentStore;
                }
                else {
                    //Gán lại phần tử cuối cùng do mảng allStores bị ngược.
                    $scope.currentStore = SunoGlobal.stores[SunoGlobal.stores.length - 1];
                    DBSettings.$addDoc({ _id: 'currentStore', currentStore: angular.copy($scope.currentStore), _rev: data[2].docs[0]._rev });
                }
            }
            else {
                $scope.currentStore = SunoGlobal.stores[SunoGlobal.stores.length - 1];
                DBSettings.$addDoc({ _id: 'currentStore', currentStore: angular.copy($scope.currentStore) });
            }
            
            //$scope.isMultiplePrice = $scope.settings.saleSetting.applyCustomerPricingPolicy;
            $scope.isMultiplePrice = SunoGlobal.saleSetting.isApplyCustomerPricingPolicy;

            $scope.showCategories = true;
            //debugger;
            //$scope.permissionIndex = $scope.userSession.permissions.indexOf("POSIM_Manage");
            $scope.permissionIndex = SunoGlobal.permissions.indexOf("POSIM_Manage");
            $scope.isManager = SunoGlobal.permissions.indexOf("POSIM_Manage") > -1;
            //$scope.userInfo = {};
            //angular.copy($scope.userSession, $scope.userInfo);
            //$scope.userInfo = angular.copy($scope.userSession);
            //delete $scope.userInfo.permissions;
        } else {
            throw { errorCode: 3, errorMsg: "Get Bootloader và AuthBootLoader không thành công." };
        }

        //Suno Prototype
        $SunoSaleOrderCafe = new SunoSaleOrderCafe($scope.currentStore.storeID);
        $SunoSaleOrderCafe.initOrder();
        /*
        //"selectedItem.unitPrice",
        //"selectedItem.discountIsPercent",
        //"selectedItem.discount",
        //"selectedItem.discountInPercent",
        // 5 -"tableIsSelected.tableOrder",
        // 6 -"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.IsDiscountPercent",
        // 7 -"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.DiscountInPercent",
        // 8 -"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.discount",
        // 9 -"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].quantity",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].newOrderCount",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].discount",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.customer",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.subFee",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.SubFeeInPercent",
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.IsSubFeePercent"
        $scope.$watchGroup(watchExpressions, function (newValue, oldValue) {
            if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {

                repricingOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, $scope.isMultiplePrice);
            }

            // Tính toán số tiền giảm giá mỗi khi thay đổi phương thức giảm giá cho item trong đơn hàng
            if ($scope.selectedItem) {
                // console.log($scope.selectedItem.discount,$scope.selectedItem.discountIsPercent,$scope.selectedItem.discountInPercent);
                if ($scope.selectedItem.discountIsPercent) {
                    if ($scope.selectedItem.discountInPercent > 100) $scope.selectedItem.discountInPercent = 100;
                    $scope.selectedItem.discount = ($scope.selectedItem.unitPrice * $scope.selectedItem.discountInPercent) / 100;
                }
            }
            if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.IsSubFeePercent) {
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent = 0;
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent > 100) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent = 100;
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee = ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent * $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subTotal) / 100;

            }
            if ($scope.selectedItem && !$scope.selectedItem.discountIsPercent) {
                if ($scope.selectedItem.discount > $scope.selectedItem.unitPrice) $scope.selectedItem.discount = $scope.selectedItem.unitPrice;
            }
            // Tính giá bán cuối sau khi trừ giảm giá
            if ($scope.selectedItem && $scope.selectedItem.discount > 0) {
                $scope.selectedItem.sellPrice = $scope.selectedItem.unitPrice - $scope.selectedItem.discount;
            }
            if ($scope.selectedItem && $scope.selectedItem.discount == 0) $scope.selectedItem.sellPrice = $scope.selectedItem.unitPrice;


            if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.IsDiscountPercent) {
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.DiscountInPercent > 100) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.DiscountInPercent = 100;
            }



            // Tính toán lại đơn hàng hiện tại, bổ sung thông tin thu ngân, người bán hàng vào đơn hàng.
            if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
                calculateTotal($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);

                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].amount = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total;
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.cashier = SunoGlobal.userProfile.userId;
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.seller) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.seller = $scope.userInfo;
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.tableName) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.tableName = $scope.tableIsSelected.tableName;
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy = SunoGlobal.userProfile.userId;
                    var sellerIndex = findIndex($scope.authBootloader.users.userProfiles, 'userId', SunoGlobal.userProfile.userId);
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdByName = $scope.authBootloader.users.userProfiles[sellerIndex].displayName;
                }
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid = uuid.v1();
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.storeId) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.storeId = $scope.currentStore.storeID;
            }

            if ($scope.tables && $scope.tables.length > 0 && $scope.currentStore.storeID) {
                //console.log('fired');
                //Mỗi khi có thay đổi trên hóa đơn thì cập nhật lại bàn đó dưới DB Local
                utils.debounce(updateSelectedTableToDB, 300, false)();
                //updateSelectedTableToDB();
                ////LSFactory.set($scope.currentStore.storeID, {
                ////    tables: $scope.tables,
                ////    zone: $scope.tableMap
                ////});
            }
        });

        $scope.watchCallback = function (newValue, oldValue) {
            //console.log(newValue);
            if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                calculateTotal($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].amount = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total;
            }

            if ($scope.tables && $scope.tables.length > 0 && $scope.currentStore.storeID) {
                //Mỗi khi có thay đổi trên hóa đơn thì cập nhật lại bàn đó dưới DB Local
                //console.log('fired');
                utils.debounce(updateSelectedTableToDB, 300, false)();
                ////LSFactory.set($scope.currentStore.storeID, {
                ////    tables: $scope.tables,
                ////    zone: $scope.tableMap
                ////});
            }
        }
        //"tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails"
        $scope.$watchCollection("tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails", $scope.watchCallback);

        $scope.$watch("offline", function (n) {
            if (n)
                if (n.action == "submit-order")
                    toaster.pop('error', "", 'Kết nối internet không ổn định hoặc đã mất kết nối internet, vui lòng lưu đơn hàng sau khi có internet trở lại!');
                else {
                    toaster.pop('error', "", 'Kết nối internet không ổn định hoặc đã mất kết nối internet, thao tác hiện không thể thực hiện được, vui lòng thử lại sau!');
                }
            $scope.offline = null;
        });

        $scope.$watchCollection("receiptVoucher", function (n) {
            if ($scope.tableIsSelected && $scope.receiptVoucher.length > 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.receiptVoucher = $scope.receiptVoucher;
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].balance = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total - $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].amount;
            }
        });

        $scope.$watch("receiptVoucher[0].amount", function (n) {
            if ($scope.tableIsSelected && $scope.receiptVoucher.length > 0 && $scope.receiptVoucher[0].amount > ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total - $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.amountPaid)) {
                $scope.receiptVoucher[0].amount = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total - $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.amountPaid;
            }
        });
        */
        // Load dữ liệu về categories, product items, print template, thông tin công ty, các cấu hình đồng bộ, hàng hóa theo giờ,...
        return Promise.all([getAllCategories(), $scope.getProductItems(''), getPrintTemplate(), getCompanyInfo(), getSettings(), { localCurrentStore: $scope.currentStore }])
    })
    .then(function (loadedData) {
        //Đặt tên cho DB bằng companyId và storeId để có unique name.
        var DBTableName = SunoGlobal.companyInfo.companyId + "_" + $scope.currentStore.storeID;
        return Promise.all([SunoPouchDB.getPouchDBInstance('table', DBTableName), loadedData[5]]);
    })
    .then(function (data) {
        DBTables = data[0];
        $scope.tables = [];
        $scope.tableMap = [];
        //Thêm mảng tạm để phục hồi khi cần.
        $scope.tableMapTemp = [];
        $scope.tablesTemp = [];
        var tableSetting = $scope.tablesSetting;
        return Promise.all([
            DBTables.$queryDoc({
                selector: {
                    'store': { $eq: $scope.currentStore.storeID },
                    'tableId': { $gte: null }
                },
                sort: [{ tableId: 'asc' }]
                //fields: ['_id', 'table']
            }),
            //DBSettings.$getDocByID({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
            DBSettings.$getDocByID({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
            data[1],
        ]);
    })
    .then(function (data) {
        //Kiểm tra trong DB Local đã có có sơ đồ phòng bàn chưa.
        //- Nếu có thì đọc lên vì trong sơ đồ phòng bàn ở DB Local có thông tin bàn đang dùng và trống.
        //- Nếu chưa có => POS Cafe mới chạy lần đầu cần thực hiện lưu thông tin sơ đồ phòng bàn vào DB Local hoặc mở Modal khởi tạo phòng bàn.
        if (data[0].docs.length > 0 && data[1].docs[0] && data[1].docs[0].zones.length > 0) {
            var pDBTable = data[0].docs;
            var pDBZone = data[1].docs[0].zones;
            $scope.tables = pDBTable;
            $scope.tableMap = pDBZone;
            $scope.tablesTemp = angular.copy(pDBTable);
            $scope.tableMapTemp = angular.copy(data[2].localCurrentStore.zone);
            if (!$scope.tablesSetting) $scope.tablesSetting = [];

            //Gán lại giá trị từ Orders cho SunoSaleOrderCafe (Nạp lại $SunoSaleOrderCafe.saleOrders)
            //Lúc tắt app mở lại
            $scope.tables.forEach(function (t) {
                t.tableOrder.forEach(function (order) {
                    $SunoSaleOrderCafe.calculateOrder(order.saleOrder, order.saleOrder);
                });
            });

        } else {
            if ($scope.tablesSetting) {
                var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
                if (storeIndex != null) {
                    $scope.tables = $scope.tablesSetting[storeIndex].tables;
                    $scope.tableMap = $scope.tablesSetting[storeIndex].zone;
                    $scope.tablesTemp = angular.copy($scope.tablesSetting[storeIndex].tables);
                    $scope.tableMapTemp = angular.copy($scope.tablesSetting[storeIndex].zone);
                    //Lưu xuống DB Local
                    var array = prepareTables();
                    Promise.all([
                        DBTables.$manipulateBatchDoc(array),
                        //Trường hợp này sửa lỗi lúc kết ca thì chưa xóa zones ở các máy đc server broadcast về.
                        DBSettings.$getDocByID({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID, zones: angular.copy($scope.tableMap) })
                    ])
                    .then(function (data) {
                        //console.log(data[0]);
                        var zones = { _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID, zones: angular.copy($scope.tableMap) };
                        if (data[1].docs.length > 0) {
                            zones._rev = data[1].docs[0]._rev;
                        }
                        return DBSettings.$addDoc(zones);
                        //return Promise.all([
                        //    DBTables.$getAllDocs(),
                        //    DBSettings.$addDoc(zones)
                        //]);
                        //console.log('Lưu DB', data);
                    })
                    .then(function (data) {
                        //log for debug.
                        //console.log(data);
                    })
                    .catch(function (error) {
                        console.log(error);
                    })
                } else {
                    $scope.checkInitTable();
                }
            } else {
                $scope.checkInitTable();
            }
        }


        //Check table quantity to determine CSS class.
        if ($scope.tables.length < 11) {
            $scope.appendedCSSClass = 'responsive-0x';
        }
        else if ($scope.tables.length < 21) {
            $scope.appendedCSSClass = 'responsive-1x';
        }
        else if ($scope.tables.length < 31) {
            $scope.appendedCSSClass = 'responsive-2x';
        }
        else if ($scope.tables.length < 41) {
            $scope.appendedCSSClass = 'responsive-3x';
        }
        else if ($scope.tables.length < 51) {
            $scope.appendedCSSClass = 'responsive-4x';
        }
        else if ($scope.tables.length < 61) {
            $scope.appendedCSSClass = 'responsive-5x';
        }
        else if ($scope.tables.length >= 61) {
            $scope.appendedCSSClass = '';
        }

        ////Checking internet connection.
        //$interval(function () {
        //    checkingInternetConnection();
        //}, 8000);

        //Mặc định chọn bàn Mang về là bàn được chọn đầu tiên.
        $scope.tableIsSelected = $scope.tables[0];
        $scope.orderIndexIsSelected = 0;

        //($scope.tables.length > 1) ? $scope.leftviewStatus = false : $scope.leftviewStatus = true;
        //$scope.getSyncSetting().then(function () {
        buildHotKeyIndex();
        //Thiết lập kết nối Socket nếu có bật đồng bộ.
        if ($scope.isSync) {
            manager = new io.Manager(socketUrl, {
                reconnection: true,
                timeout: 20000,
                reconnectionattempts: 'infinity',
                reconnectiondelay: 1000,
                autoconnect: false,
                query: {
                    room: SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID,
                    transport: ['websocket']
                }
            });
            socket = manager.socket('/');
            socket.connect();
            //console.log(manager);
            //socket = io.connect(socketUrl, { query: 'room=' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID });
            // socket.heartbeatTimeout = 2000; 
            socket.on('initShift', function (msg) {
                console.log('initShift', msg);
                if (msg.storeId == $scope.currentStore.storeID) {
                    //debugger;
                    // console.log('-- Đã nhận tín hiệu từ socket --');
                    // console.log(msg.tables);
                    //Kiểm tra xem DB Local đã lưu shiftId hay chưa?
                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    .then(function (data) {
                        $scope.shiftId = null;
                        if (data.docs.length > 0) {
                            $scope.shiftId = data.docs[0].shiftId;
                        }

                        //Nếu shift Client hiện tại ko trùng với shift Server gửi về thì cập nhật lại hoặc thêm mới.
                        if ($scope.shiftId != msg.shiftId) {
                            $scope.shiftId = msg.shiftId;
                            if (data.docs.length > 0) {
                                data.docs[0].shiftId = msg.shiftId;
                                return DBSettings.$addDoc(angular.copy(data.docs[0]));
                            }
                            else {
                                return DBSettings.$addDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID, shiftId: msg.shiftId });
                            }
                            //.catch(function (error) { console.log(error); });
                            //LSFactory.set('shiftId', msg.shiftId);
                        }
                        return null;
                        //Đoạn này phải chạy tuần tự vì có trường hợp lỗi giữa add shiftId và remove shiftId gây reload nhiều lần.
                    })
                    .then(function (data) {
                        //debugger;
                        var tempTables = angular.copy($scope.tables);
                        $scope.unNoticeTable = filterHasNoticeOrder($scope.tables);
                        // angular.copy($scope.tables,$scope.copyTables);
                        // var filterHasNoticeOrder($scope.copyTables);

                        //Cập nhật lại sơ đồ bàn mới từ Server.
                        $scope.tables = msg.tables;
                        var saleOrdersTemp = angular.copy($SunoSaleOrderCafe.saleOrders);
                        //saleOrdersTemp.forEach(function (order) { $SunoSaleOrderCafe.deleteOrder(order.saleOrderUuid); });
                        $SunoSaleOrderCafe.saleOrders = [];
                        $scope.tables.forEach(function (t) {
                            t.tableOrder.forEach(function (order) {
                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                    $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, order.saleOrder);
                                }
                                else {
                                    $SunoSaleOrderCafe.calculateOrder(order.saleOrder, order.saleOrder);
                                }
                            });
                        });

                        //console.log($scope.tables[3].tableOrder[0].saleOrder === $SunoSaleOrderCafe.saleOrder);

                        if (msg.tables && $scope.tables.length > 0) socketAction.process($scope.tables, $scope.unNoticeTable);
                        // console.log(msg);
                        if ($scope.tables) {
                            //debugger;
                            //Hiển thị thông báo cho client
                            var alteredOrder = [];
                            var lostOrder = [];
                            //Lặp để thiết lập nội dung thông báo
                            //debugger;
                            if (msg.msg) {
                                //Thông báo order đã thay đổi phải lặp trên ds phòng bàn mới để lấy sharedWith.
                                if (msg.msg.alteredOrder.length > 0) {
                                    $scope.tables.forEach(function (t) {
                                        t.tableOrder.forEach(function (order) {
                                            var orderLog = msg.msg.alteredOrder.find(function (log) { return log.orderID == order.saleOrder.saleOrderUuid });
                                            if (orderLog) {
                                                switch (orderLog.type) {
                                                    //Client liên quan là client cùng tài khoản với client thực hiện action
                                                    //hoặc client đã tham gia vào hoạt động chỉnh sửa, thay đổi trên đơn hàng đó (Trường hợp này chỉ xảy ra đối với các tài khoản có quyền quản lý và chủ cửa hàng)
                                                    case 1: {//Gửi cho tất cả client liên quan
                                                        if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0) {
                                                            alteredOrder.push(orderLog.tableName);
                                                        }
                                                        break;
                                                    }
                                                    case 2: {//Chỉ gửi cho client đã thực hiện action
                                                        if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0 && msg.msg.deviceID == deviceID) {
                                                            alteredOrder.push(orderLog.tableName);
                                                        }
                                                        break;
                                                    }
                                                    case 3: {//Chỉ gửi các client liên quan khác ngoại trừ client thực hiện action.
                                                        if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0 && msg.msg.deviceID != deviceID) {
                                                            alteredOrder.push(orderLog.tableName);
                                                        }
                                                        break;
                                                    }
                                                    default:
                                                        break;
                                                }
                                            }
                                        });
                                    });
                                }

                                //Thông báo order đã lạc lặp trên ds phòng bàn cũ.
                                if (msg.msg.lostOrder.length > 0) {
                                    tempTables.forEach(function (t) {
                                        t.tableOrder.forEach(function (order) {
                                            var orderLog = msg.msg.lostOrder.find(function (log) { return log.orderID == order.saleOrder.saleOrderUuid });
                                            //Thông báo về cho chỉ client đã thực hiện Init.
                                            if (orderLog && msg.msg.deviceID == deviceID && order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0) {
                                                lostOrder.push({ fromTable: orderLog.tableName, toTable: orderLog.orderPlaceNow ? orderLog.orderPlaceNow.tableName : null, action: orderLog.action });
                                            }
                                        });
                                    });
                                }
                            }

                            var msgForAlteredOrder = '';
                            var msgForLostOrder = '';
                            if (alteredOrder.length > 0 || lostOrder.length > 0) {
                                if (alteredOrder.length > 0) {
                                    msgForAlteredOrder = '<p style="text-align: center;">Đơn hàng của bạn tại các bàn <b>';
                                    msgForAlteredOrder += alteredOrder.join('</b>, <b>');
                                    msgForAlteredOrder += '</b> đã được thay đổi ở 1 thiết bị khác.</p>';
                                }
                                if (lostOrder.length > 0) {
                                    msgForLostOrder = '<p style="text-align: center;">Đơn hàng của bạn tại ';
                                    var orderNotiArr = [];
                                    lostOrder.forEach(function (order) {
                                        var txt = 'bàn <b>' + order.fromTable + '</b> đã ' + (order.action == 'G' ? 'được ghép vào' : order.action == 'CB' ? 'được chuyển sang' : 'được thao tác sang') + (order.toTable != null ? ' bàn <b>' + order.toTable + '</b>' : ' một bàn khác.');
                                        orderNotiArr.push(txt);
                                    });
                                    msgForLostOrder += orderNotiArr.join(',');
                                    msgForLostOrder += '.</p>';
                                    //msgForLostOrder += '</b> đã được đổi bàn hoặc ghép hóa đơn ở 1 thiết bị khác.</p>';
                                    msgForLostOrder += '<p style="text-align: center;">Hệ thống sẽ tạo đơn hàng <b style="color: red;">LƯU TẠM</b> để đối soát. Bạn có thể dùng như đơn hàng bình thường hoặc xóa nếu không cần thiết.</p>';
                                }
                                var msgContent = msgForAlteredOrder + msgForLostOrder + '<p style="text-align: center;">Vui lòng kiểm tra và cập nhật lại số lượng, nếu có sai lệch.<p/>';
                                if (notiPopupInstance) {
                                    showNotification.close();
                                }
                                $timeout(function () {
                                    showNotification('Thông báo', msgContent);
                                }, 100);
                            }

                            //Cập nhật lại tableStatus
                            for (var i = 0; i < $scope.tables.length; i++) {
                                var tableStatus = tableIsActive($scope.tables[i]);
                                if (tableStatus == true) {
                                    $scope.tables[i].tableStatus = 1;
                                }
                            }

                            DBTables.$queryDoc({
                                selector: {
                                    'store': { $eq: $scope.currentStore.storeID }
                                }
                            })
                            .then(function (data) {
                                if (data.docs.length > 0) {
                                    for (var x = 0; x < data.docs.length; x++) {
                                        _id = data.docs[x]._id;
                                        _rev = data.docs[x]._rev;
                                        data.docs[x] = JSON.parse(JSON.stringify($scope.tables[x]));
                                        data.docs[x]._id = _id;
                                        data.docs[x]._rev = _rev;
                                        data.docs[x].store = $scope.currentStore.storeID;
                                    }
                                    return DBTables.$manipulateBatchDoc(data.docs);
                                }
                                return null;
                            })
                            .then(function (data) {
                                //debugger;
                                if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                    var tableIndex = findIndex($scope.tables, 'tableUuid', $scope.tableIsSelected.tableUuid);
                                    $scope.tableIsSelected = $scope.tables[tableIndex];
                                }
                                $scope.$apply();
                                return null;
                            })
                            .catch(function (error) {
                                console.log(error);
                                //Nếu lỗi match shift nhưng số lượng bàn khác nhau
                                return DBTables.$queryDoc({
                                    selector: {
                                        'store': { $eq: $scope.currentStore.storeID }
                                    }
                                })
                            })
                            .then(function (data) {
                                if (data) {
                                    data.docs.forEach(function (d) { d._deleted = true; });
                                    return DBTables.$manipulateBatchDoc(data.docs);
                                }
                                return null;
                            })
                            .then(function (data) {
                                if (data) {
                                    window.location.reload(true);
                                }
                            });
                        }

                        if (!$scope.tables) {
                            Promise.all([
                                DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
                                DBTables.$queryDoc({
                                    selector: {
                                        'store': { $eq: $scope.currentStore.storeID }
                                        //'tableId': { $gte: null }
                                    },
                                    //sort: [{ tableId: 'asc' }]
                                })
                            ])
                            .then(function (data) {
                                console.log(data);
                                data[1].docs.forEach(function (d) { d._deleted = true; });
                                return DBTables.$manipulateBatchDoc(data[1].docs);
                            })
                            .then(function (data) {
                                window.location.reload(true);
                            })
                            .catch(function (error) {
                                console.log(error);
                            })
                            //window.localStorage.removeItem('shiftId');
                            //window.localStorage.removeItem($scope.currentStore.storeID);
                            //window.location.reload(true);
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    });
                    //$scope.shiftId = LSFactory.get('shiftId');

                }
                // console.log($scope.tables);
            });

            socket.on('connect', function () {
                isSocketConnected = true;
                console.log('Socket is connected');
                if (!isSocketInitialized) { //Nếu không phải khởi động app thì trường hợp này là vừa bị mất kết nối socket và kết nối lại.
                    $timeout(function () {
                        if (isSocketConnected) {
                            //Nếu đã có kết nối socket và có bật đồng bộ.
                            if (socket && $scope.isSync) {
                                //socket = manager.socket('/');
                                socket.connect();
                                //Gửi hết thông tin đơn hàng với logs chưa đồng bộ lên cho server.
                                var unsyncOrder = filterOrderWithUnsyncLogs($scope.tables);
                                //data = angular.copy(unsyncOrder);
                                //unsyncOrder = filterInitOrder(data);
                                var initData = {
                                    "companyId": SunoGlobal.companyInfo.companyId,
                                    "storeId": $scope.currentStore.storeID,
                                    "clientId": SunoGlobal.userProfile.sessionId,
                                    "shiftId": null, //LSFactory.get('shiftId'),
                                    "startDate": "",
                                    "finishDate": "",
                                    "tables": angular.copy(unsyncOrder),
                                    "zone": $scope.tableMap,
                                    "info": {
                                        action: "reconnect",
                                        deviceID: deviceID,
                                        timestamp: genTimestamp(),
                                        author: SunoGlobal.userProfile.userId,
                                        isUngroupItem: $scope.isUngroupItem
                                    }
                                };

                                DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                .then(function (data) {
                                    debugger;
                                    var shiftId = null;
                                    if (data.docs.length > 0) {
                                        shiftId = data.docs[0].shiftId;
                                    }
                                    //debugger;
                                    initData.shiftId = shiftId;
                                    initData = angular.toJson(initData);
                                    initData = JSON.parse(initData);
                                    console.log('reconnectData', initData);
                                    socket.emit('reconnectServer', initData);
                                })
                                .catch(function (error) {
                                    console.log(error);
                                });
                            }
                        }
                    }, 1000);
                }
                else {
                    isSocketInitialized = false;
                }
            });

            socket.on('disconnect', function (rs) {
                console.log('Socket is disconnected', rs);
                isSocketConnected = false;
            });

            socket.on('reconnecting', function (num) {
                console.log('Socket is reconnecting', num);
            });

            socket.on('error', function (e) {
                console.log('Error occured', e);
            })

            socket.on('reconnect', function (num) {
                console.log('Socket is reconnected', num);
            });

            socket.on('ping', function () {
                //console.log('Socket is pinging');
            });

            socket.on('connect_timeout', function (timeout) {
                console.log('Socket connection is timeout', timeout);
            });

            socket.on('connect_error', function (e) {
                //console.log('Socket connection is error', e);
            });

            socket.on('reconnect_error', function (e) {
                //console.log('Socket reconnecting error', e);
            });

            //GroupBy cho hàng hóa bình thường.
            var groupBy = function (arrLog) {
                var result = arrLog.reduce(function (arr, item) {
                    var index = arr.findIndex(function (i) { return i.itemID == item.itemID });
                    if (index == -1) {
                        //Chưa có
                        var quantity = item.action == "BB" ? item.quantity : -item.quantity;
                        var logs = [{
                            action: item.action,
                            timestamp: item.timestamp,
                            quantity: item.quantity,
                            deviceID: item.deviceID,
                        }]
                        arr.push({
                            itemID: item.itemID,
                            itemName: item.itemName,
                            totalQuantity: quantity,
                            logs: logs
                        });
                    }
                    else {
                        //Có
                        var indexLog = arr[index].logs.findIndex(function (i) { return i.timestamp == item.timestamp });
                        //Distinct value
                        if (indexLog == -1) {
                            arr[index].logs.push({
                                action: item.action,
                                timestamp: item.timestamp,
                                quantity: item.quantity,
                                deviceID: item.deviceID
                            });
                            //Cập nhật lại total
                            var quantity = item.action == "BB" ? item.quantity : -item.quantity;
                            arr[index].totalQuantity += quantity;
                        }
                    }
                    return arr;
                }, []);
                return result;
            };

            //GroupBy cho hàng hóa tách món kiểu trà sữa, hàng combo.
            var groupByUngroupItem = function (arrLog) {
                var result = arrLog.reduce(function (arr, item) {
                    var index = arr.findIndex(function (i) { return i.detailID == item.detailID });
                    if (index == -1) {
                        //Chưa có
                        var quantity = item.action == "BB" ? item.quantity : item.action == "H" ? -item.quantity : 0;
                        var logs = [{
                            action: item.action,
                            timestamp: item.timestamp,
                            quantity: item.quantity,
                            deviceID: item.deviceID,
                        }]
                        arr.push({
                            itemID: item.itemID,
                            itemName: item.itemName,
                            totalQuantity: quantity,
                            detailID: item.detailID,
                            logs: logs
                        });
                    }
                    else {
                        //Có
                        var indexLog = arr[index].logs.findIndex(function (i) { return i.timestamp == item.timestamp });
                        //Distinct value
                        if (indexLog == -1) {
                            arr[index].logs.push({
                                action: item.action,
                                timestamp: item.timestamp,
                                quantity: item.quantity,
                                deviceID: item.deviceID
                            });
                            //Cập nhật lại total
                            var quantity = item.action == "BB" ? item.quantity : item.action == "H" ? -item.quantity : 0;
                            arr[index].totalQuantity += quantity;
                        }
                    }
                    return arr;
                }, []);
                return result;
            }

            socket.on('updateOrder', function (msg) {
                console.log('updateOrder', msg);
                //debugger;
                if (msg.storeId == $scope.currentStore.storeID) {
                    if (msg.info.action != 'splitOrder' && msg.info.action != 'stopTimer' && msg.info.action != 'renameOrder') {
                        //Cập nhật lại bàn vừa nhận từ Server gửi về
                        for (var x = 0; x < $scope.tables.length; x++) {
                            if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                if ($scope.tables[x].tableOrder.length > 0) {
                               
                                    var orderIndex = null;
                                    for (var y = 0; y < $scope.tables[x].tableOrder.length; y++) {
                                        if ($scope.tables[x].tableOrder[y].saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid) {
                                            orderIndex = y;
                                        }
                                    }
                                    //Nếu chưa có order này trong ds orders, trường hợp báo bếp mới.
                                    if (orderIndex == null && $scope.tables[x].tableOrder[0].saleOrder.orderDetails.length > 0) {
                                        $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                        ////Nếu ở bàn đang được chọn có order đang được chọn thì trỏ lại cho đúng.
                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                        } else {
                                            $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                        }
                                    }
                                    else if (orderIndex == null && $scope.tables[x].tableOrder[0].saleOrder.orderDetails.length == 0) {
                                        $scope.tables[x].tableOrder[0].saleOrder = msg.tables[0].tableOrder[0].saleOrder;

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                        }
                                        else {
                                            $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                        }

                                        //$SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                        //if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                        //    $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        //}
                                    }
                                    else {

                                        var z = angular.copy($scope.tables[x].tableOrder[orderIndex].saleOrder);
                                        //Merge sharedWith
                                        z.sharedWith = msg.tables[0].tableOrder[0].saleOrder.sharedWith;

                                        //Merge printed
                                        z.printed = msg.tables[0].tableOrder[0].saleOrder.printed;

                                        if (!msg.info.isUngroupItem) { //Cập nhật cho hàng hóa kiểu bình thường
                                            //Điều chỉnh data cho phù hợp
                                            //B1: Merge log giữa client và server có distinct
                                            //var orderServer = msg.tables[0].tableOrder[0].saleOrder.logs.filter(function (item) {
                                            //    return $scope.tables[x].tableOrder[orderIndex].saleOrder.logs.findIndex(function (i) {
                                            //        return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                            //    }) < 0;
                                            //});

                                            var orderClient = z.logs.filter(function (item) {
                                                return msg.tables[0].tableOrder[0].saleOrder.logs.findIndex(function (i) {
                                                    return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                }) < 0;
                                            });

                                            //z.logs = z.logs.concat(orderServer);
                                            orderServer = msg.tables[0].tableOrder[0].saleOrder.logs;
                                            z.logs = orderClient.concat(orderServer);

                                            //B2: Tính toán lại số lượng dựa trên logs
                                            var groupLog = groupBy(z.logs);

                                            //B3: Cập nhật lại số lượng item
                                            groupLog.forEach(function (log) {
                                                var index = z.orderDetails.findIndex(function (d) {
                                                    return d.itemId == log.itemID;
                                                });
                                                if (log.totalQuantity > 0 && index < 0) {
                                                    //Nếu số lượng trong log > 0 và item chưa có trong ds order của client thì thêm vào danh sách details
                                                    var itemDetail = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                    z.orderDetails.push(itemDetail);
                                                }
                                                else if (log.totalQuantity > 0 && index >= 0) {
                                                    //Nếu số lượng trong log > 0 và item đã có trong ds order của client thì cập nhật lại số lượng
                                                    var itemDetail = z.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                    itemDetail.quantity = log.totalQuantity;
                                                    //Cập nhật lại trạng thái của order chưa báo bếp.
                                                    //if (itemDetail.newOrderCount > 0) 
                                                    itemDetail.quantity += itemDetail.newOrderCount;
                                                    itemDetail.subTotal = itemDetail.quantity * itemDetail.sellPrice;
                                                    //$scope.watchCallback(null, null);
                                                }
                                                else if (log.totalQuantity <= 0 && index >= 0) {
                                                    //Nếu số lượng trong log <= 0 và item đã có trong ds order của client thì xóa item đó đi khỏi danh sách details
                                                    var itemDetailIndex = z.orderDetails.findIndex(function (d) { return d.itemId == log.itemID });
                                                    z.orderDetails.splice(itemDetailIndex, 1);
                                                }
                                                else if (log.totalQuantity <= 0 && index < 0) {
                                                    //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                }
                                            });

                                            //Cập nhật lại revision.
                                            z.revision = msg.tables[0].tableOrder[0].saleOrder.revision;

                                            $scope.tables[x].tableOrder[orderIndex].saleOrder = z;

                                            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, z);
                                            }
                                            else {
                                                $SunoSaleOrderCafe.calculateOrder(z, z);
                                            }
                                        }
                                        else { //Cập nhật cho hàng hóa tách món kiểu trà sữa,...

                                            if ($SunoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid) {
                                                $scope.pinItem = null;
                                            }

                                            //Điều chỉnh data cho phù hợp
                                            //B1: Merge log giữa client và server có distinct

                                            var orderClient = z.logs.filter(function (item) {
                                                return msg.tables[0].tableOrder[0].saleOrder.logs.findIndex(function (i) {
                                                    return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID && i.detailID == item.detailID;
                                                }) < 0;
                                            });

                                            //z.logs = z.logs.concat(orderServer);
                                            orderServer = msg.tables[0].tableOrder[0].saleOrder.logs;
                                            z.logs = orderClient.concat(orderServer);

                                            //B2: Tính toán lại số lượng dựa trên logs
                                            var groupLog = groupByUngroupItem(z.logs);

                                            //B3: Cập nhật lại số lượng item
                                            groupLog.forEach(function (log) {
                                                var index = z.orderDetails.findIndex(function (d) {
                                                    return d.itemId == log.itemID && d.detailID == log.detailID;
                                                });
                                                if (log.totalQuantity > 0 && index < 0) {
                                                    //Nếu số lượng trong log > 0 và item chưa có trong ds order của client thì thêm vào danh sách details
                                                    var itemDetail = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    //Nếu item chưa có là parent thì push vào như bình thường.
                                                    if (!itemDetail.isChild) {
                                                        z.orderDetails.push(itemDetail);
                                                    }
                                                    else { //Nếu item chưa có là child
                                                        //Kiếm parent của item đó.
                                                        var parentDetailIndex = z.orderDetails.findIndex(function (d) { return d.detailID == itemDetail.parentID });
                                                        //Push ngay bên dưới parent.
                                                        z.orderDetails.splice(parentDetailIndex + 1, 0, itemDetail);
                                                    }
                                                }
                                                else if (log.totalQuantity > 0 && index >= 0) {
                                                    //Nếu số lượng trong log > 0 và item đã có trong ds order của client thì cập nhật lại số lượng
                                                    var itemDetail = z.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    itemDetail.quantity = log.totalQuantity;
                                                    //Cập nhật lại trạng thái của order chưa báo bếp.
                                                    //if (itemDetail.newOrderCount > 0) 
                                                    itemDetail.quantity += itemDetail.newOrderCount;
                                                    itemDetail.subTotal = itemDetail.quantity * itemDetail.sellPrice;
                                                }
                                                else if (log.totalQuantity <= 0 && index >= 0) {
                                                    //Nếu số lượng trong log <= 0 và item đã có trong ds order của client thì xóa item đó đi khỏi danh sách details
                                                    var itemDetailIndex = z.orderDetails.findIndex(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    z.orderDetails.splice(itemDetailIndex, 1);
                                                }
                                                else if (log.totalQuantity <= 0 && index < 0) {
                                                    //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                }
                                            });

                                            //B4: Sắp xếp lại parent và child Item.
                                            var parentItemList = z.orderDetails.filter(function (d) { return !d.isChild });
                                            var addCount = 0;
                                            var length = parentItemList.length; //Gán lại để tránh thay đổi length gây ra sai khi push vào mảng.
                                            for (var i = 0; i < length; i++) {
                                                var pIndex = i + addCount;
                                                var childItemList = z.orderDetails.filter(function (d) { return d.parentID && d.parentID == parentItemList[pIndex].detailID });
                                                //Lặp ngược để push cho đúng vị trí khi thêm child cho parent.
                                                for (var y = childItemList.length - 1; y >= 0; y--) {
                                                    parentItemList.splice(pIndex + 1, 0, childItemList[y]);
                                                    addCount++;
                                                }
                                            }

                                            z.orderDetails = parentItemList;

                                            //Cập nhật lại revision.
                                            z.revision = msg.tables[0].tableOrder[0].saleOrder.revision;

                                            $scope.tables[x].tableOrder[orderIndex].saleOrder = z;
                                            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, z);
                                            }
                                            else {
                                                $SunoSaleOrderCafe.calculateOrder(z, z);
                                            }
                                        }
                                    }
                                    
                                }
                                else {
                                    $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                    if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                        $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                    }
                                    else {
                                        $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                    }
                                }

                                //Cập nhật lại trạng thái của bàn
                                var tableStatus = tableIsActive($scope.tables[x]);
                                $scope.tables[x].tableStatus = tableStatus ? 1 : 0;
                                $scope.$apply();

                                //Lưu vào DB Local
                                updateTableToDB(msg.tables[0]);
                                //DBTables.$queryDoc({
                                //    selector: {
                                //        'store': { $eq: $scope.currentStore.storeID },
                                //        'tableUuid': { $eq: msg.tables[0].tableUuid }
                                //    },
                                //    fields: ['_id', '_rev']
                                //})
                                //.then(function (data) {
                                //    var table = angular.copy(msg.tables[0]);
                                //    table._id = data.docs[0]._id;
                                //    table._rev = data.docs[0]._rev;
                                //    table.store = $scope.currentStore.storeID;
                                //    return DBTables.$addDoc(table);
                                //})
                                //.then(function (data) {
                                //    //console.log(data);
                                //})
                                //.catch(function (error) {
                                //    //console.log(error);
                                //    //Nếu bị conflict thì retry lại
                                //    DBTables.$queryDoc({
                                //        selector: {
                                //            'store': { $eq: $scope.currentStore.storeID },
                                //            'tableUuid': { $eq: msg.tables[0].tableUuid }
                                //        },
                                //        fields: ['_id', '_rev']
                                //    })
                                //    .then(function (data) {
                                //        var table = angular.copy(msg.tables[0]);
                                //        table._id = data.docs[0]._id;
                                //        table._rev = data.docs[0]._rev;
                                //        table.store = $scope.currentStore.storeID;
                                //        return DBTables.$addDoc(table);
                                //    })
                                //    .catch(function (e) {
                                //        console.log(e);
                                //    })
                                //});

                                break;
                            }
                        }
                    }
                        //Xử lý cho tách hóa đơn.
                    else if (msg.info.action == 'splitOrder') {
                        //Cập nhật lại bàn từ Server gửi về.
                        for (var x = 0; x < $scope.tables.length; x++) {
                            if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                //Lặp qua 2 order mới tách.
                                for (var y = 0; y < msg.tables[0].tableOrder.length; y++) {
                                    if ($SunoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[y].saleOrder.saleOrderUuid) {
                                        $scope.pinItem = null;
                                    }
                                    var orderIndex = -1;
                                    orderIndex = $scope.tables[x].tableOrder.findIndex(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[y].saleOrder.saleOrderUuid });

                                    //Trường hợp chưa có trong ds Orders của bàn, đây là Order mới tách
                                    if (orderIndex == -1) {
                                        $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[y]);
                                        $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[y].saleOrder, msg.tables[0].tableOrder[y].saleOrder);

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        }
                                    }
                                    else {
                                        $scope.tables[x].tableOrder[orderIndex] = msg.tables[0].tableOrder[y];

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[y].saleOrder);
                                        }
                                        else {
                                            $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[y].saleOrder, msg.tables[0].tableOrder[y].saleOrder);
                                        }
                                    }
                                }

                                //Cập nhật lại trạng thái của bàn
                                var tableStatus = tableIsActive($scope.tables[x]);
                                $scope.tables[x].tableStatus = tableStatus ? 1 : 0;
                                $scope.$apply();

                                //Lưu vào DB Local bàn đó sau khi đã xử lý xong.
                                updateTableToDB(msg.tables[0]);
                                //DBTables.$queryDoc({
                                //    selector: {
                                //        'store': { $eq: $scope.currentStore.storeID },
                                //        'tableUuid': { $eq: msg.tables[0].tableUuid }
                                //    },
                                //    fields: ['_id', '_rev']
                                //})
                                //.then(function (data) {
                                //    //console.log(data);
                                //    var table = JSON.parse(JSON.stringify(msg.tables[0]));
                                //    table._id = data.docs[0]._id;
                                //    table._rev = data.docs[0]._rev;
                                //    table.store = $scope.currentStore.storeID;
                                //    return DBTables.$addDoc(table);
                                //})
                                //.then(function (data) {
                                //    //console.log(data);
                                //})
                                //.catch(function (error) {
                                //    console.log(error);
                                //});
                                break;
                            }
                        }
                    }
                        //Xử lý cho ngừng tính giờ Item hoặc đổi tên
                    else if (msg.info.action == 'stopTimer' || msg.info.action == 'renameOrder') {
                        //Cập nhật lại bàn từ Server gửi về, vì chỉ gửi 1 bàn và 1 order nên ko cần lặp 2 vòng.
                        for (var x = 0; x < $scope.tables.length; x++) {
                            if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                if ($SunoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid) {
                                    $scope.pinItem = null;
                                }
                                var order = $scope.tables[x].tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid });

                                order.saleOrder = msg.tables[0].tableOrder[0].saleOrder;

                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                    $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                }
                                else {
                                    $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                                }
                                //Lưu vào DB Local
                                DBTables.$queryDoc({
                                    selector: {
                                        'store': { $eq: $scope.currentStore.storeID },
                                        'tableUuid': { $eq: msg.tables[0].tableUuid }
                                    },
                                    fields: ['_id', '_rev']
                                })
                                .then(function (data) {
                                    //console.log(data);
                                    var table = JSON.parse(JSON.stringify(msg.tables[0]));
                                    table._id = data.docs[0]._id;
                                    table._rev = data.docs[0]._rev;
                                    table.store = $scope.currentStore.storeID;
                                    return DBTables.$addDoc(table);
                                })
                                .then(function (data) {
                                    //console.log(data);
                                })
                                .catch(function (error) {
                                    console.log(error);
                                });

                                //Cập nhật lại trạng thái của bàn
                                var tableStatus = tableIsActive($scope.tables[x]);
                                $scope.tables[x].tableStatus = tableStatus ? 1 : 0;
                                $scope.$apply();

                                //Lưu vào DB
                                updateTableToDB(msg.tables[0]);

                                break;
                            }
                        }
                    }
                }
            });

            socket.on('completeOrder', function (msg) {
                console.log('completeOrder', msg);
                if (msg.storeId == $scope.currentStore.storeID) {
                    for (var x = 0; x < $scope.tables.length; x++) {

                        //Tìm bàn server gửi về
                        if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {

                            //Tìm order trong bàn đó
                            var orderIndex = $scope.tables[x].tableOrder.findIndex(function (t) { return t.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid });

                            //Nếu có order là trường hợp Thanh toán hoặc là xóa trắng đơn hàng đã báo bếp.
                            if (orderIndex != -1) {
                                debugger;
                                //Xóa ra khỏi ds orders của bàn đó và trong Prototype.
                                $scope.tables[x].tableOrder.splice(orderIndex, 1);
                                $SunoSaleOrderCafe.deleteOrder(msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid);

                                //Nếu đang chọn xem order đó thì refresh lại.
                                if ($scope.tableIsSelected.tableUuid == msg.tables[0].tableUuid && $scope.orderIndexIsSelected == orderIndex) {

                                    //Nếu bàn vẫn còn order sau khi đỡ xóa order kia thì trỏ về order sau cùng trong ds order.
                                    if ($scope.tableIsSelected.tableOrder.length > 0) {
                                        $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                                        $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                    }
                                    else {
                                        //$SunoSaleOrderCafe.createNewOrder();
                                        //$scope.tableIsSelected.tableOrder.push({ saleOrder: $SunoSaleOrderCafe.saleOrder });
                                        //$scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
                                        //$scope.tableIsSelected.tableOrder[0].saleOrder.tableName = $scope.tableIsSelected.tableName;
                                        //$scope.orderIndexIsSelected = 0;
                                        createFirstOrder();
                                    }
                                }

                                ////Cập nhật lại trạng thái của bàn
                                var tableStatus = tableIsActive($scope.tables[x]);
                                $scope.tables[x].tableStatus = tableStatus ? 1 : 0;


                                //Lưu vào DB Local
                                updateTableToDB(msg.tables[0]);
                                //DBTables.$queryDoc({
                                //    selector: {
                                //        'store': { $eq: $scope.currentStore.storeID },
                                //        'tableUuid': { $eq: $scope.tables[x].tableUuid }
                                //    },
                                //    fields: ['_id', '_rev']
                                //})
                                //.then(function (data) {
                                //    //console.log(data);
                                //    var table = JSON.parse(JSON.stringify($scope.tables[x]));
                                //    table._id = data.docs[0]._id;
                                //    table._rev = data.docs[0]._rev;
                                //    table.store = $scope.currentStore.storeID;
                                //    return DBTables.$addDoc(table);
                                //})
                                //.then(function (data) {
                                //    //console.log(data);
                                //})
                                //.catch(function (error) {
                                //    console.log(error);
                                //});

                                //Thông báo cho client về hóa đơn được thanh toán ở thiết bị khác.
                                if (msg.msg) {
                                    if ((SunoGlobal.userProfile.userId == msg.msg.author) //|| $scope.tables[x].tableOrder[orderIndex].saleOrder.sharedWith.find(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) > 0)
                                        && deviceID != msg.msg.deviceID) {
                                        var msgContent = '<p style="text-align: center;">Đơn hàng của bạn tại bàn <b>' + $scope.tables[x].tableName + '</b> đã được thanh toán ở một thiết bị khác.</p>';
                                        showStackNotification('Thông báo', msgContent, null);
                                    }
                                }
                                $scope.$apply();
                                break;
                            }
                                //Trường hợp xóa trắng đơn hàng chưa báo bếp nên ko tìm thấy Order.
                            else {
                                //Chưa làm gì hết
                            }
                        }
                    }
                }
            });

            socket.on('moveOrder', function (msg) {
                console.log('moveOrder', msg);
                if (msg.storeId == $scope.currentStore.storeID) {
                    //Cập nhật lại ở bàn cũ
                    var table = $scope.tables.find(function (t) { return t.tableUuid == msg.fromTableUuid });
                    if (table) {
                        //Cập nhật lại order cũ
                        var order = table.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.fromSaleOrderUuid });
                        if (order) {
                            var index = table.tableOrder.indexOf(order);
                            table.tableOrder.splice(index, 1);
                            $SunoSaleOrderCafe.deleteOrder(msg.fromSaleOrderUuid);

                            //Nếu bàn vẫn còn order sau khi đỡ xóa order kia thì trỏ về order sau cùng trong ds order.
                            if ($scope.tableIsSelected.tableOrder.length > 0) {
                                $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                                $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                            }
                            else {
                                createFirstOrder();
                            }

                            var tableStatus = tableIsActive(table);
                            table.tableStatus = tableStatus ? 1 : 0;

                            //Kiểm tra xem phải order của người dùng này và người dùng này có đang xem order này hay không?
                            var isViewing = order.saleOrder.createdBy == SunoGlobal.userProfile.userId && table.tableUuid == $scope.tableIsSelected.tableUuid && index == $scope.orderIndexIsSelected;
                            if (isViewing) {
                                //Thông báo
                                var action = msg.info.action == 'G' ? 'ghép' : 'chuyển';
                                var msgContent = '<p style="text-align:center;">Đơn hàng của bạn tại bàn <b>' + table.tableName + '</b> mà bạn vừa xem đã được ' + action + ' sang bàn <b>' + msg.tables[0].tableName + '</b> ở một thiết bị khác.</p>';
                                showStackNotification('Thông báo', msgContent, null);
                            }
                        }
                    }

                    //Cập nhật lại ở bàn mới
                    table = $scope.tables.find(function (t) { return t.tableUuid == msg.tables[0].tableUuid });
                    if (table) {
                        var order = table.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid; });
                        if (order) {
                            if ($SunoSaleOrderCafe.saleOrder.saleOrderUuid == order.saleOrder.saleOrderUuid) {
                                $scope.pinItem = null;
                            }
                            //Nếu order có sẵn là trường hợp ghép hóa đơn
                            order.saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                            } else {
                                $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                            }

                            table.tableStatus = 1;
                        }
                        else {
                            //Nếu order không có là trường hợp đổi bàn
                            table.tableOrder.push(msg.tables[0].tableOrder[0]);
                            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                $SunoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                            } else {
                                $SunoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, msg.tables[0].tableOrder[0].saleOrder);
                            }

                            table.tableStatus = 1;
                        }
                        //$scope.tables[$scope.tables.indexOf(table)].tableOrder = msg.tables[0].tableOrder;
                    }

                    $scope.$apply();

                    //Lưu DB Local
                    Promise.all([
                        DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID },
                                'tableUuid': { $eq: msg.fromTableUuid }
                            },
                            fields: ['_id', '_rev']
                        }),
                        DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID },
                                'tableUuid': { $eq: msg.tables[0].tableUuid }
                            },
                            fields: ['_id', '_rev']
                        })
                    ])
                    .then(function (data) {
                        var fromTable = $scope.tables.find(function (t) { return t.tableUuid == msg.fromTableUuid });
                        fromTable._id = data[0].docs[0]._id;
                        fromTable._rev = data[0].docs[0]._rev;
                        fromTable.store = $scope.currentStore.storeID;

                        var toTable = $scope.tables.find(function (t) { return t.tableUuid == msg.tables[0].tableUuid });
                        toTable._id = data[1].docs[0]._id;
                        toTable._rev = data[1].docs[0]._rev;
                        toTable.store = $scope.currentStore.storeID;

                        return DBTables.$manipulateBatchDoc([fromTable, toTable]);
                    })
                    .then(function (data) {
                        //log for debugging
                        //console.log(data);
                        return DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID }
                            }
                        });
                    })
                    .then(function (data) {
                        //Log check data.
                        //console.log(data);
                    })
                    .catch(function (error) {
                        console.log(error);
                    });
                }
            });

            socket.on('completeShift', function (msg) {
                console.log('completeShiftON', msg);
                if (msg.storeId == $scope.currentStore.storeID) {
                    //Xóa shift, xóa tables, xóa zones. Sau đó reload lại để cập nhật thông tin shift và data mới nhất từ Server.
                    Promise.all([
                        DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
                        DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID }
                                //'tableId': { $gte: null }
                            },
                            //sort: [{ tableId: 'asc' }]
                        }),
                        DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    ])
                    .then(function (data) {
                        //debugger;
                        console.log(data);
                        data[1].docs.forEach(function (d) { d._deleted = true; });
                        return DBTables.$manipulateBatchDoc(data[1].docs);
                    })
                    .then(function (data) {
                        window.location.reload(true);
                    })
                    .catch(function (error) {
                        console.log(error);
                    })
                }
            });

            socket.on('printHelper', function (msg) {
                if (msg.storeId == $scope.currentStore.storeID) {
                    // console.log('-- Đã nhận tín hiệu in hộ --');
                    if ($scope.isWebView && ($scope.printHelper && $scope.printHelper.cashier && msg.orderType == 'cashier') || ($scope.printHelper && $scope.printHelper.kitchen && msg.orderType == 'kitchen'))
                        // console.log(msg.orderType);
                        if (msg.orderType == 'kitchen') {
                            printOrderInBrowser(printer, msg.printOrder, 128, msg.printSetting);
                        } else if (msg.orderType == 'cashier') {
                            printOrderInBrowser(printer, msg.printOrder, 1, msg.printSetting);
                        }
                }
            });

            socket.on('exception', function (msg) {
                debugger;
                // console.log(msg);
                // console.log($scope.currentStore.storeID,msg.data.storeId);
                ////debugger;
                if (msg.data.storeId == $scope.currentStore.storeID) {
                    //Nếu bị lỗi shiftId không khớp thì xóa shiftId hiện tại ở DB Local và reload lại để cập nhật lại shiftId và data mới nhất từ Server.
                    if (msg.errorCode && msg.errorCode == 'invalidShift') {
                        DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                        .then(function (data) {
                            debugger;
                            if (notiPopupInstance) {
                                showNotification(null, null, null).close();
                            }
                            $timeout(function () {
                                showNotification('Thông báo', '<p style="text-align: center;">Quá trình nạp và cập nhật dữ liệu không thành công.</p><p style="text-align:center; font-weight: bold;">Ứng dụng sẽ được khởi động lại.</p>', function () { window.location.reload(true); });
                            }, 100);
                            //window.location.reload(true);
                        })
                        .catch(function (error) {
                            console.log(error);
                        });
                        //window.localStorage.removeItem('shiftId');
                        //window.location.reload(true);
                    }

                    if (msg.errorCode && (msg.errorCode == 'invalidStore' || msg.errorCode == 'unauthorizedClientId')) {
                        $scope.logout();
                    }

                    if (msg.errorCode && msg.errorCode == 'badRequest') {
                        Promise.all([
                                DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
                                DBTables.$queryDoc({
                                    selector: {
                                        'store': { $eq: $scope.currentStore.storeID }
                                    },
                                }),
                                DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                        ])
                        .then(function (data) {
                            //debugger;
                            console.log(data);
                            data[1].docs.forEach(function (d) { d._deleted = true; });
                            return DBTables.$manipulateBatchDoc(data[1].docs);
                        })
                        .then(function () {
                            $scope.logout();
                        });
                    }
                    //if (msg.errorCode && msg.errorCode == 'invalidStore') {
                    //    $scope.logout();
                    //}

                    //if (msg.errorCode && msg.errorCode == 'unauthorizedClientId') {
                    //    $scope.logout();
                    //}

                }
            });

            socket.on('getVersion', function (msg) {
                var data = {
                    info: {
                        action: "getVersion",
                        author: SunoGlobal.userProfile.userId,
                        deviceID: deviceID,
                        timestamp: genTimestamp(),
                    },
                    version: version
                }
                if(isSocketConnected)
                    socket.emit('version', data);
            });

            socket.on('notification', function (msg) {
                var title = msg.title;
                var content = msg.content;
                var type = msg.type; //alert 1 or mininoti 2
                var action = msg.action //reload or logout.
                var isForce = msg.isForce;
                if (type == 1) {
                    var pop = $ionicPopup.alert({
                        title: title,
                        content: content
                    });
                    pop.then(function (d) {
                        if (action == 'reload') {
                            window.location.reload(msg.isForce);
                        }
                        else if(action == 'logout') {
                            $scope.logout();
                        }
                    })
                }
                else if (type == 2) {
                    toaster.pop('info', title, content);
                }
            });

            var unsyncOrder = filterOrderWithUnsyncLogs($scope.tables);
            data = angular.copy(unsyncOrder);
            unsyncOrder = filterInitOrder(data);
            //console.log(SunoGlobal)
            var initData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": null, //LSFactory.get('shiftId'),
                "startDate": "",
                "finishDate": "",
                "tables": angular.copy(unsyncOrder),
                "zone": $scope.tableMap,
                "info": {
                    action: "init",
                    author: SunoGlobal.userProfile.userId,
                    deviceID: deviceID,
                    timestamp: genTimestamp(),
                    isUngroupItem: $scope.isUngroupItem
                }
            };

            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            .then(function (data) {
                ////debugger;
                var shiftId = null;
                if (data.docs.length > 0) {
                    shiftId = data.docs[0].shiftId;
                }
                //debugger;
                initData.shiftId = shiftId;
                initData = angular.toJson(initData);
                initData = JSON.parse(initData);
                if (isSocketConnected) {
                    console.log('initData', initData);
                    socket.emit('initShift', initData);
                }
            })
            .catch(function (error) {
                console.log(error);
            })


            // console.log('gọi init: ' + LSFactory.get('shiftId') );
        }
        //// Nếu truy cập bằng máy tính thì kiểm tra thiết lập in hộ
        //if ($scope.isWebView && window.localStorage.getItem('printHelper')) $scope.printHelper = JSON.parse(window.localStorage.getItem('printHelper'));
        //// Nếu truy cập bằng phiên bản app cho android hoặc ios thì load thông tin máy in
        //if ($scope.isIPad || $scope.isIOS || $scope.isAndroid) {
        //    if (window.localStorage.getItem('printDevice'))
        //        $scope.printDevice = JSON.parse(window.localStorage.getItem('printDevice'));
        //}
        return Promise.all([DBSettings.$getDocByID({ _id: 'printHelper' }), DBSettings.$getDocByID({ _id: 'printDevice' })]);
        //});
    })
    .then(function (data) {
        if ($scope.isWebView && data[0].docs.length > 0)
            $scope.printHelper = data[0].docs[0].printHelper;
        if (($scope.isIPad || $scope.isIOS || $scope.isAndroid) && data[1].docs.length > 0) {
            //if (data[1].docs.length > 0) 
            $scope.printDevice = JSON.parse(data[1].docs[0].printDevice);
        }
    })
    .catch(function (e) {
        //debugger;
        console.log(e);
        if (e.constructor.name == 'ProgressEvent') {
            var popUp = $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Quá trình tải thông tin hệ thống không thành công.</p><p style="text-align:center;">Vui lòng kiểm tra kết nối Internet và thử lại</p>'
            });

            popUp.then(function (data) {
                window.location.reload(true);
            });
        }
        if (e == 'Vui lòng đăng nhập.') {
            var popUp = $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Quá trình tải thông tin hệ thống không thành công.</p><p style="text-align:center;">Vui lòng đăng nhập lại.</p>'
            });

            popUp.then(function (data) {
                $scope.logout();
            });
        }
        //if (e.error == 'invalid_token' && e.error_description == 'expired') {
        //    //Lấy lại access Token mới
        //    //debugger; //Reload 2 lần lúc chạy.
        //    refreshToken()
        //    .then(function (data) {
        //        //debugger;
        //        $scope.token.token = data.accessToken;
        //        $scope.token.refreshToken = data.refreshToken;
        //        return DBSettings.$getDocByID({ _id: 'token' })
        //    })
        //    .then(function (data) {
        //        data.docs[0].token.token = $scope.token.token;
        //        data.docs[0].token.refreshToken = $scope.token.refreshToken;
        //        //Lưu vào DB Local
        //        return DBSettings.$addDoc(data.docs[0]);
        //    })
        //    .then(function (data) {
        //        //debugger;
        //        //Reload để cập nhật lại.
        //        console.log(data);
        //        window.location.reload(true);
        //    })
        //    .catch(function (e) {
        //        console.log(e);
        //    })
        //}
        //$state.go('login');
    });


    var prepareTables = function () {
        var tables = angular.copy($scope.tables);
        var array = [];
        tables.forEach(function (t) {
            var table = JSON.parse(JSON.stringify(t));
            table._id = t.tableId.toString() + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID;
            //table._id = t.tableName;
            table.store = $scope.currentStore.storeID;
            array.push(table);
        });
        return array;
    }

    //var watchExpressions = [
    //  "selectedItem.unitPrice",
    //  "selectedItem.discountIsPercent",
    //  "selectedItem.discount",
    //  "selectedItem.discountInPercent",
    //  "tableIsSelected.tableOrder",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.IsDiscountPercent",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.DiscountInPercent",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.discount",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].quantity",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].newOrderCount",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.orderDetails[tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.lastInputedIndex].discount",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.customer",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.subFee",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.SubFeeInPercent",
    //  "tableIsSelected.tableOrder[orderIndexIsSelected].saleOrder.IsSubFeePercent"
    //];

    $ionicPopover.fromTemplateUrl('store-list.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverStoreList = popover;
    });

    $scope.openPopOverStoreList = function (e) {
        $scope.popoverStoreList.show(e);
    }

    $scope.changeCurrentStore = function (s) {
        //window.localStorage.setItem('currentStore', JSON.stringify(s));
        DBSettings.$getDocByID({ _id: 'currentStore' })
        .then(function (data) {
            if (data.docs.length > 0) {
                return DBSettings.$addDoc({ _id: data.docs[0]._id, _rev: data.docs[0]._rev, currentStore: s });
            }
            else {
                return DBSettings.$addDoc({ _id: 'currentStore', currentStore: s });
            }
        })
        .then(function (data) {
            //console.log(data);
            //log for debugging;
            window.location.reload(true);
        })
        .catch(function (error) {
            console.log(error);
        })
    }

    $ionicPopover.fromTemplateUrl('settings.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverSettings = popover;
    });

    $scope.openPopoverSettings = function (e) {
        $scope.popoverSettings.show(e);
    }

    $scope.calcolor = function (i) {
        return i % 5;
    }

    //Hàm chuyển giao diện và các xử lý liên quan khi chuyển giao diện.
    $scope.switchLayout = function () {
        //Khi đang ở bàn thì chuyển món, đồng thời tạo order nếu chưa có order
        if ($scope.isInTable) {
            //Chuyển giao diện
            $scope.isInTable = false;
            //Xử lý thêm order mới nếu trống.
            if ($scope.tableIsSelected.tableOrder.length == 0) {
                createFirstOrder();
            }
            else {
                //Trỏ lại mặc định là order thứ 1.
                $scope.orderIndexIsSelected = 0;
                $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[0].saleOrder.saleOrderUuid);
            }
            if (SunoGlobal.printer.ordering != 'desc') {
                $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            }
        }
        //Khi đang ở món thì chuyển sang bàn
        else {
            $scope.isInTable = true;
        }
        $scope.pinItem = null;
        //Build lại index cho đúng với từng context
        buildHotKeyIndex();
        //Cấu hình lại
        $scope.showOption = false;
    }

    //Hàm tạo 1 order mới đầu tiên cho bàn
    var createFirstOrder = function () {
        //Tạo order mới.
        $SunoSaleOrderCafe.createNewOrder();
        $scope.tableIsSelected.tableOrder.push({ saleOrder: $SunoSaleOrderCafe.saleOrder });
        $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        $scope.tableIsSelected.tableOrder[0].saleOrder.tableName = $scope.tableIsSelected.tableName;
        //Trỏ lại cho đúng với Prototype.
        $scope.orderIndexIsSelected = 0;
        //$SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
    }

    $scope.showList = function () {
        $scope.showCategories = !$scope.showCategories;
        buildHotKeyIndex();
    }

    $scope.buttonStatus = null;
    $scope.currentZone = {};
    $scope.filterTables = function (k, z) {
        buildHotKeyIndex();
        $ionicScrollDelegate.$getByHandle('tables').scrollTop();
        switch (k) {
            case 'status':
                $scope.buttonStatus = z;
                $scope.currentZone = {
                    tableStatus: z
                };
                $scope.isInTable = true;
                break;
            case 'zone':
                // console.log(z);
                var filterObject = {
                    id: z.id,
                    quantity: z.quantity,
                    unit: z.unit,
                    zone: z.zone
                }
                $scope.buttonStatus = z;
                $scope.currentZone = {
                    tableZone: filterObject
                };
                break;

            default:
                $scope.buttonStatus = null;
                $scope.currentZone = {};
        }
    }

    $scope.openTable = function (t) {
        //Trỏ lại table đó.
        $scope.tableIsSelected = t;
        $scope.pinItem = null;
        //if ($scope.tableIsSelected.tableOrder.length == 0) {
        //    //$scope.tableIsSelected.tableOrder = [{
        //    //    saleOrder: {
        //    //    }
        //    //}]
        //    //angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[0].saleOrder)
        //    ////$scope.tableIsSelected.tableOrder.push({ saleOrder: angular.copy(saleOrder) });
        //    //$scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        //    $SunoSaleOrderCafe.createNewOrder();
        //    $scope.tableIsSelected.tableOrder.push({ saleOrder: $SunoSaleOrderCafe.saleOrder });
        //    $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        //    $scope.tableIsSelected.tableOrder[0].saleOrder.tableName = $scope.tableIsSelected.tableName;
        //}
        //else {
        //    //Trỏ lại saleOrder current trong Prototype.
        //    $SunoSaleOrderCafe.selectOrder(t.tableOrder[0].saleOrder.saleOrderUuid);
        //}
        //$scope.orderIndexIsSelected = 0;
        //$scope.showOption = false;
        //$scope.buttonStatus = null;
        $scope.switchLayout();
        //$scope.isInTable = false;
        //$ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
    }

    $scope.openTableTakeAway = function () {
        $scope.tableIsSelected = $scope.tables[0];
        $scope.pinItem = null;
        //$scope.orderIndexIsSelected = 0;

        //if ($scope.tableIsSelected.tableOrder.length == 0) {
        //    //$scope.tableIsSelected.tableOrder = [{
        //    //    saleOrder: {
        //    //    }
        //    //}];
        //    //angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        //    //$scope.tableIsSelected.tableOrder.push({ saleOrder: angular.copy(saleOrder) });
        //    //$scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        //    $SunoSaleOrderCafe.createNewOrder();
        //    $scope.tableIsSelected.tableOrder.push({ saleOrder: $SunoSaleOrderCafe.saleOrder });
        //    $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        //    $scope.tableIsSelected.tableOrder[0].saleOrder.tableName = $scope.tableIsSelected.tableName;
        //}
        //else {
        //    //Trỏ lại saleOrder current trong Prototype.
        //    $SunoSaleOrderCafe.selectOrder($scope.tables[0].tableOrder[0].saleOrder.saleOrderUuid);
        //}
        $scope.switchLayout();
    }

    $scope.changeOrder = function (index, orderID) {
        if ($scope.orderIndexIsSelected == index) {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed.length > 0) {
                $scope.openModalPrintedList();
            }
        } else {
            $SunoSaleOrderCafe.selectOrder(orderID);
            $scope.orderIndexIsSelected = index;
            $scope.pinItem = null;
            if (SunoGlobal.printer.ordering != 'desc') {
                $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            }
        }
    }

    $ionicPopover.fromTemplateUrl('table-action.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverTableAction = popover;
    });

    $scope.tableAction = function (e) {
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.popoverTableAction.show(e);
        }
    }

    // Doi ban  
    $scope.openModalSwitchTable = function () {
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        var isExistingUnnoticedItem = false;
        for (var x = 0; x < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length; x++) {
            var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[x];
            if (item.newOrderCount > 0) {
                isExistingUnnoticedItem = true;
                break;
            }
        }
        if (isExistingUnnoticedItem) {
            return toaster.pop({
                type: 'warning',
                title: '',
                body: 'Có món chưa báo bếp, vui lòng báo bếp hoặc xóa món ra khỏi đơn hàng trước khi chuyển bàn',
                timeout: 5000
            });
        }
        checkingInternetConnection()
        .then(function (data) {
            $scope.popoverTableAction.hide();
            $ionicModal.fromTemplateUrl('switch-tables.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function (modal) {
                $scope.modalSwitchTable = modal;
                $scope.modalSwitchTable.show();
            });
        })
        .catch(function (e) {
            toaster.pop({
                type: 'error',
                title: 'Thông báo',
                body: 'Đã mất kết nối internet. Các thao tác liên quan đến đổi bàn, ghép hóa đơn có thể khiến dữ liệu đồng bộ bị sai lệch. Vui lòng kết nối internet hoặc sử dụng thiết bị khác có kết nối internet ổn định để thực hiện thao tác này.',
                timeout: 10000
            });
        });
    }

    $scope.closeModalSwitchTable = function () {
        $scope.modalSwitchTable.hide();
    }

    $scope.changeTable = function (t) {
        // lưu data bàn trước khi đổi
        var newTable = angular.copy(t);
        var oldTable = angular.copy($scope.tableIsSelected);
        var oldOrderId = oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid;

        // Kiểm tra nếu bàn mới chưa có order nào thì khởi tạo order
        if (t.tableOrder.length == 0) {
            //t.tableOrder = [{
            //    saleOrder: {}
            //}];
            //angular.copy(saleOrder, t.tableOrder[0].saleOrder);

            t.tableOrder.push({ saleOrder: null });
            //Ko cần cập nhật sharedwith vì chuyển bàn thì dữ liệu đã có sẵn trc đó.
        }

        // chuyển dữ liệu từ bàn cũ sang bàn mới
        //angular.copy(oldTable.tableOrder[$scope.orderIndexIsSelected], t.tableOrder[0]);
        t.tableOrder[0].saleOrder = $SunoSaleOrderCafe.saleOrder;

        // Chuyển status cho bàn mới thành active
        t.tableStatus = 1;

        // xóa order cũ tại bàn cũ
        //angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);

        // Chuyển deactive bàn cũ nếu bàn cũ không còn hóa đơn
        var isActived = tableIsActive($scope.tableIsSelected);
        if (!isActived) {
            $scope.tableIsSelected.tableStatus = 0;
        }

        //đổi bàn được chọn sang bàn mới và trỏ lại trong saleOrder prototype.
        $SunoSaleOrderCafe.selectOrder(t.tableOrder[0].saleOrder.saleOrderUuid);
        $scope.tableIsSelected = t;
        $scope.orderIndexIsSelected = 0;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.tableName = $scope.tableIsSelected.tableName;
        $scope.modalSwitchTable.hide();
        toaster.pop('success', "", 'Đã chuyển đơn hàng từ [' + oldTable.tableName + '] sang [' + newTable.tableName + ']');
        var timestamp = genTimestamp();
        if ($scope.isSync) {
            //var currentTable = {};
            var currentTable = angular.copy($scope.tableIsSelected);

            var currentTableOrder = [];
            currentTableOrder.push(currentTable);
            currentTableOrder[0].tableOrder = [];
            currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": null, //LSFactory.get('shiftId'),
                "startDate": "",
                "finishDate": "",
                "fromTableUuid": oldTable.tableUuid,
                "fromSaleOrderUuid": oldOrderId,
                "tables": angular.copy(currentTableOrder),
                "zone": $scope.tableMap,
                "info": {
                    author: SunoGlobal.userProfile.userId,
                    timestamp: timestamp,
                    deviceID: deviceID,
                    action: "CB",
                    isUngroupItem: $scope.isUngroupItem
                }
            };

            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            .then(function (data) {
                var shiftId = null;
                if (data.docs.length > 0) {
                    shiftId = data.docs[0].shiftId;
                }
                updateData.shiftId = shiftId;
                updateData = angular.toJson(updateData);
                updateData = JSON.parse(updateData);
                console.log('moveData-changeTable', updateData);
                socket.emit('moveOrder', updateData);
            })
            .catch(function (error) {
                console.log(error);
            });
        }
    }

    // Ghep ban
    $scope.checkPairOrder = function (t) {
        if (t.tableId == $scope.tableIsSelected.tableId && t.tableOrder.length > 1 || t.tableId != $scope.tableIsSelected.tableId) {
            return true;
        }
        return false;
    }

    $scope.checkCurrentOrder = function (index) {
        if ($scope.currentTablePair.tableId == $scope.tableIsSelected.tableId && index == $scope.orderIndexIsSelected) {
            return false;
        }
        return true;
    }

    $scope.openModalPairOrder = function () {
        var cantPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        if (cantPrint == false) {
            return toaster.pop('warning', "", 'Vui lòng hoàn tất gọi món (Thông báo cho bếp) trước khi thực hiện ghép hoá đơn!');
        }
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        checkingInternetConnection()
        .then(function (data) {
            if (cantPrint == true && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
                $ionicModal.fromTemplateUrl('pairing-order.html', {
                    scope: $scope,
                    animation: 'slide-in-up'
                }).then(function (modal) {
                    $scope.modalPairOrder = modal;
                    $scope.popoverTableAction.hide();
                    $scope.modalPairOrder.show();
                    $scope.selecteOrder = true;
                });
            }
        })
        .catch(function (e) {
            toaster.pop({
                type: 'error',
                title: 'Thông báo',
                body: 'Đã mất kết nối internet. Các thao tác liên quan đến đổi bàn, ghép hóa đơn có thể khiến dữ liệu đồng bộ bị sai lệch. Vui lòng kết nối internet hoặc sử dụng thiết bị khác có kết nối internet ổn định để thực hiện thao tác này.',
                timeout: 10000
            });
        });
    }

    $scope.closeModalPairOrder = function () {
        $scope.modalPairOrder.hide();
    }

    $scope.pairingOrder = function (t) {
        $scope.newTable = t;
        $scope.oldTable = $scope.tableIsSelected;

        $scope.currentTablePair = t;
        if (t.tableOrder.length > 1) {
            $scope.selecteOrder = false;
        } else {
            $scope.Pair(t.tableOrder[0], 0);
        }
    }

    $scope.Pair = function (o, index) {
        //var oldTable = {};
        var oldTable = angular.copy($scope.tableIsSelected);
        var oldOrderId = oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid;
        //Thêm logs cho table mới được ghép.
        var logs = []
        var timestamp = genTimestamp();
        for (var i = 0; i < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length; i++) {
            var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[i];
            if (!$scope.isUngroupItem) {
                logs.push(new Log(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, false));
                var itemIndex = findIndex(o.saleOrder.orderDetails, 'itemId', item.itemId);
                if (itemIndex != null) {
                    o.saleOrder.orderDetails[itemIndex].quantity += parseFloat(item.quantity);
                } else {
                    //item.quantity = 1;
                    o.saleOrder.orderDetails.push(item);
                }
            }
            else {
                logs.push(new UngroupLog(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, item.detailID, false));
                o.saleOrder.orderDetails.push(item);
            }
        }
        //Thêm printed của order cũ sang order mới.
        o.saleOrder.printed = o.saleOrder.printed.concat(oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed);
        //Thêm logs cho order mới.
        o.saleOrder.logs = o.saleOrder.logs.concat(logs);

        angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);

        var tableStatus = tableIsActive($scope.tableIsSelected);
        if (tableStatus == false) {
            $scope.tableIsSelected.tableStatus = 0;
        }

        toaster.pop('success', "", 'Đã chuyển đơn hàng từ [' + $scope.oldTable.tableName + '] sang [' + $scope.newTable.tableName + ']');
        $scope.tableIsSelected = $scope.newTable;
        $scope.orderIndexIsSelected = index;

        if ($scope.isSync) {
            //var currentTable = {};
            var currentTable = angular.copy($scope.tableIsSelected);

            var currentTables = [];
            currentTables.push(currentTable);
            currentTables[0].tableOrder = [];
            currentTables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": null,//LSFactory.get('shiftId'),
                "startDate": "",
                "finishDate": "",
                "fromTableUuid": oldTable.tableUuid,
                "fromSaleOrderUuid": oldOrderId,
                "tables": angular.copy(currentTables),
                "zone": $scope.tableMap,
                "info": {
                    author: SunoGlobal.userProfile.userId,
                    timestamp: timestamp,
                    deviceID: deviceID,
                    action: "G",
                    isUngroupItem: $scope.isUngroupItem
                }
            }
            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            .then(function (data) {
                var shiftId = null;
                if (data.docs.length > 0) {
                    shiftId = data.docs[0].shiftId;
                }

                updateData.shiftId = shiftId;
                updateData = angular.toJson(updateData);
                updateData = JSON.parse(updateData);
                console.log('moveData-pairOrder', updateData);
                socket.emit('moveOrder', updateData);
            })
            .catch(function (error) {
                console.log(error);
            });
        }

        $scope.modalPairOrder.hide();
    }

    // Tach hoa don
    $scope.openModalSplitOrder = function () {
        var cantPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        if (cantPrint == false) {
            return toaster.pop('warning', "", 'Vui lòng hoàn tất gọi món (Thông báo cho bếp) trước khi thực hiện tách hoá đơn!');
        }
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        if (cantPrint == true && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.popoverTableAction.hide();

            $ionicModal.fromTemplateUrl('split-order.html', {
                scope: $scope,
                animation: 'slide-in-up',
                backdropClickToClose: false
            }).then(function (modal) {
                $scope.modalSplitOrder = modal;
                $scope.modalSplitOrder.fOrder = {};
                angular.copy($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected], $scope.modalSplitOrder.fOrder);

                $scope.modalSplitOrder.show();
            });
        }
    }

    $scope.closeModalSplitOrder = function () {
        //$scope.modalSplitOrder.hide();
        $scope.cancelSplit();
    }

    $scope.pickToSplitOrder = function (t) {
        //console.log($scope.modalSplitOrder.fOrder.saleOrder.orderDetails);
        //console.log(t);
        //t.quantity -= 1;

        var quantity = 1;
        if ($scope.isUngroupItem) {
            quantity = t.quantity;
        }
        t.quantity -= quantity;
        if (!$scope.splitOrder) {
            $scope.splitOrder = {
                saleOrder: angular.copy(saleOrder)
            };
            if (!$scope.splitOrder.saleOrder.saleOrderUuid) $scope.splitOrder.saleOrder.saleOrderUuid = uuid.v1();
            if (!$scope.splitOrder.saleOrder.createdBy) $scope.splitOrder.saleOrder.createdBy = SunoGlobal.userProfile.userId;
            if (!$scope.splitOrder.saleOrder.storeId) $scope.splitOrder.saleOrder.storeId = $scope.currentStore.storeID;
        }
        var itemIndex = findIndex($scope.splitOrder.saleOrder.orderDetails, 'itemId', t.itemId);
        if (itemIndex != null && !$scope.isUngroupItem) {
            $scope.splitOrder.saleOrder.orderDetails[itemIndex].quantity++;
        } else {
            if (!$scope.isUngroupItem) {
                var temp = angular.copy(t);
                //angular.copy(t, temp);
                temp.quantity = quantity;
                $scope.splitOrder.saleOrder.orderDetails.push(temp);
            }
            else if ($scope.isUngroupItem) {
                if (!t.isChild) {
                    //Push parent
                    var pQuantity = quantity;
                    var parentTemp = angular.copy(t);
                    parentTemp.quantity = pQuantity;
                    $scope.splitOrder.saleOrder.orderDetails.push(parentTemp);
                    //Kiếm child
                    var itemChildList = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == t.detailID; });
                    //Trừ số lượng của child.
                    //Push vào ds bên tay phải
                    itemChildList.forEach(function (item) {
                        var cQuantity = item.quantity;
                        item.quantity -= cQuantity;
                        var childTemp = angular.copy(item);
                        childTemp.quantity = cQuantity;
                        $scope.splitOrder.saleOrder.orderDetails.push(childTemp);
                    });
                }
                else {
                    //Kiếm parent
                    var parentItem = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.find(function (d) { return d.detailID == t.parentID });
                    //Kiếm sibling của parent
                    var itemChildList = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == parentItem.detailID; });
                    //Trừ số lượng của parent và siblings
                    //Push vào ds bên tay phải.
                    var pQuantity = parentItem.quantity;
                    parentItem.quantity -= pQuantity;
                    var parentTemp = angular.copy(parentItem);
                    parentTemp.quantity = pQuantity;
                    $scope.splitOrder.saleOrder.orderDetails.push(parentTemp);
                    itemChildList.forEach(function (item) {
                        var cQuantity = item.quantity;
                        //Do đã cập nhật ở trên rồi nên sẽ bị quantity về 0 nếu item trùng với t truyền vào.
                        if (item.detailID == t.detailID) {
                            cQuantity = quantity;
                        } else {
                            item.quantity -= cQuantity;
                        }
                        var childTemp = angular.copy(item);
                        childTemp.quantity = cQuantity;
                        $scope.splitOrder.saleOrder.orderDetails.push(angular.copy(childTemp));
                    });
                }
            }

        }
    }

    $scope.backToOrder = function (i) {
        var quantity = 1;
        if ($scope.isUngroupItem) {
            quantity = i.quantity;
        }
        i.quantity -= quantity;
        var itemIndex = findIndex($scope.modalSplitOrder.fOrder.saleOrder.orderDetails, 'itemId', i.itemId);
        if (itemIndex != null) {
            if (!$scope.isUngroupItem) {
                $scope.modalSplitOrder.fOrder.saleOrder.orderDetails[itemIndex].quantity++;
            } else {
                if (i.isChild) { //Nếu là child
                    //console.log(angular.copy($scope.splitOrder.saleOrder.orderDetails));
                    debugger;
                    //kiếm parent.
                    var pItem = $scope.splitOrder.saleOrder.orderDetails.find(function (d) { return d.detailID == i.parentID; });
                    var parentItem = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.find(function (d) { return d.detailID == i.parentID; });
                    //update quantity cho parent.
                    parentItem.quantity = $scope.splitOrder.saleOrder.orderDetails[$scope.splitOrder.saleOrder.orderDetails.indexOf(pItem)].quantity;
                    //kiếm siblings.
                    //update quantity cho self và siblings.
                    var itemChildList = $scope.splitOrder.saleOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == pItem.detailID; });
                    var length = itemChildList.length;
                    for (var x = 0; x < itemChildList.length; x++) {
                        var cItem = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.find(function (d) { return itemChildList[x].detailID == d.detailID; });
                        var cQuantity = itemChildList[x].quantity;
                        if (cItem.detailID == i.detailID) {
                            cQuantity = quantity;
                        }
                        cItem.quantity = cQuantity;
                        var index = $scope.splitOrder.saleOrder.orderDetails.indexOf(itemChildList[x]);
                        $scope.splitOrder.saleOrder.orderDetails.splice(index, 1);
                    }
                    //splice ra khỏi mảng
                    $scope.splitOrder.saleOrder.orderDetails.splice($scope.splitOrder.saleOrder.orderDetails.indexOf(pItem), 1);
                }
                else { //Nếu là parent.
                    //update quantity cho self.
                    var parentItem = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.find(function (d) { return d.detailID == i.detailID });
                    var pItem = $scope.splitOrder.saleOrder.orderDetails.find(function (d) { return d.detailID == i.detailID });
                    parentItem.quantity = quantity;
                    //Splice ra khỏi mảng
                    $scope.splitOrder.saleOrder.orderDetails.splice($scope.splitOrder.saleOrder.orderDetails.indexOf(pItem), 1);
                    //kiếm child.
                    //update quantity cho child.
                    var itemChildList = $scope.splitOrder.saleOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == i.detailID; });
                    var length = itemChildList.length;
                    for (var x = 0; x < itemChildList.length; x++) {
                        var cItem = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.find(function (d) { return itemChildList[x].detailID == d.detailID; });
                        var cQuantity = itemChildList[x].quantity;
                        cItem.quantity = cQuantity;
                        var index = $scope.splitOrder.saleOrder.orderDetails.indexOf(itemChildList[x]);
                        $scope.splitOrder.saleOrder.orderDetails.splice(index, 1);
                    }
                }
            }

        } else {
            $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.push(i);
        }
    }

    $scope.cancelSplit = function () {
        $scope.splitOrder = null;
        $scope.modalSplitOrder.fOrder = null;
        $scope.modalSplitOrder.hide();
    }

    $scope.Split = function () {
        if (!$scope.splitOrder) return;
        //Validate lúc bấm nút tách hóa đơn.
        var index = $scope.splitOrder.saleOrder.orderDetails.findIndex(function (d) { return d.quantity > 0 });
        if ($scope.splitOrder.saleOrder.orderDetails.length == 0 || index < 0) return;
        index = $scope.modalSplitOrder.fOrder.saleOrder.orderDetails.findIndex(function (d) { return d.quantity > 0 });
        if (index < 0) return toaster.pop('error', '', 'Hóa đơn hiện đang thao tác và hóa đơn sẽ tách giống nhau. Tách hóa đơn không thành công. Vui lòng kiểm tra và thử lại.');
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] = removeItemZero($scope.modalSplitOrder.fOrder);
        $scope.modalSplitOrder.fOrder = null;
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length] = removeItemZero($scope.splitOrder);
        //Thêm logs cho order cũ và mới.
        var logs = [];
        var timestamp = genTimestamp();
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.orderDetails.forEach(function (item) {
            if (!$scope.isUngroupItem) {
                logs.push(new Log(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, true));
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                    new Log(item.itemId, item.itemName, "H", item.quantity, timestamp, deviceID, true));
            }
            else {
                logs.push(new UngroupLog(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, item.detailID, true));
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                    new UngroupLog(item.itemId, item.itemName, "H", item.quantity, timestamp, deviceID, item.detailID, true));
            }
        });
        //Thêm tên và thời gian cho Order mới tách.
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.createdByName = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdByName;
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.startTime = new Date();
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.logs = logs;
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.printed = [];
        $scope.splitOrder = null;
        toaster.pop('success', "", 'Đã tách hoá đơn [' + $scope.tableIsSelected.tableName + ']');

        if ($scope.isSync && isSocketConnected) {
            var currentTableOrder = [];
            currentTableOrder.push($scope.tableIsSelected);
            // var ownerOrder = filterOwnerOrder(currentTableOrder,SunoGlobal.userProfile.userId);
            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": null, //LSFactory.get('shiftId'),
                "startDate": "",
                "finishDate": "",
                "tables": angular.copy(currentTableOrder),
                "zone": $scope.tableMap,
                "info": {
                    author: SunoGlobal.userProfile.userId,
                    deviceID: deviceID,
                    action: "splitOrder",
                    timestamp: timestamp,
                    isUngroupItem: $scope.isUngroupItem
                }
            }
            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            .then(function (data) {
                var shiftId = null;
                if (data.docs.length > 0) {
                    shiftId = data.docs[0].shiftId;
                }
                updateData.shiftId = shiftId;
                updateData = angular.toJson(updateData);
                updateData = JSON.parse(updateData);
                if (isSocketConnected) {
                    console.log('updateData-splitOrder', updateData);
                    socket.emit('updateOrder', updateData);
                }
            })
            .catch(function (error) {
                console.log(error);
            })
        }


        $scope.modalSplitOrder.hide();
    }

    $scope.createNewOrder = function () {
        $scope.pinItem = null;
        //var temp = {};
        //temp.saleOrder = {};
        //angular.copy(saleOrder, temp.saleOrder);
        //var temp = {
        //    saleOrder: angular.copy(saleOrder)
        //};
        //temp.saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        //$scope.tableIsSelected.tableOrder.push(temp);
        //$scope.changeOrder($scope.tableIsSelected.tableOrder.length - 1);

        $SunoSaleOrderCafe.createNewOrder();
        var saleOrder = { saleOrder: $SunoSaleOrderCafe.saleOrder };
        $scope.tableIsSelected.tableOrder.push(saleOrder);
        $SunoSaleOrderCafe.saleOrder.tableName = $scope.tableIsSelected.tableName;
        $SunoSaleOrderCafe.saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.indexOf(saleOrder);
    }

    $scope.cancelOrder = function () {
        $scope.pinItem = null;
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0) {
            if ($scope.tableIsSelected.tableOrder.length > 1) {
                console.log(angular.copy($SunoSaleOrderCafe.saleOrders));
                $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);
                $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                $SunoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                console.log(angular.copy($SunoSaleOrderCafe.saleOrders));
                var isActived = tableIsActive($scope.tableIsSelected);
                if (!isActived) {
                    $scope.tableIsSelected.tableStatus = 0;
                }
            } else {
                var isActived = tableIsActive($scope.tableIsSelected);
                if (!isActived) {
                    $scope.tableIsSelected.tableStatus = 0;
                }
                $scope.orderIndexIsSelected = 0;
            }
        } else {
            toaster.pop('warning', "", 'Không thể xoá đơn hàng đang có hàng hoá');
        }
    }

    // chiều in
    var printDimetion = true;
    // var unGroupProduct = true;

    $scope.pickProduct = function (item) {
        console.log('Is it the same reference', $SunoSaleOrderCafe.saleOrder === $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        console.log($SunoSaleOrderCafe.saleOrder);
        if (!item || !item.itemId) return;

        //Validate thông tin
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]
          && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != null
          && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
          && $scope.permissionIndex == -1
          ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (item.isSerial) {
            return toaster.pop('warning', "", 'Xin vui lòng sử dụng Suno POS để bán hàng theo IMEI/SERIAL. Liên hệ 08.71.088.188 để được hỗ trợ.');
        }

        if (item.qtyAvailable <= 0 && item.isUntrackedItemSale === false && item.isInventoryTracked === true) {
            return toaster.pop('warning', "", 'Vui lòng nhập kho hàng [' + item.itemName + '], hoặc cấu hình cho phép bán âm hàng hóa này.');
        }

        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {

            var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);

            if (itemIndex != null && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[itemIndex].startTime) {
                return toaster.pop('warning', "", 'Hàng hóa này được tính giá theo giờ sử dụng và đã có trong đơn hàng!');
            }
        }

        //Tạo đơn hàng nếu trống.
        //Trường hợp bàn mang về khi search và chọn thì tự động thêm món vào Order của bàn mang về hoặc trường hợp xóa trắng đơn hàng sau đó thêm hàng hóa vào lại.
        if ($scope.tableIsSelected.tableOrder.length == 0) {
            //$scope.tableIsSelected.tableOrder = [{
            //    saleOrder: {}
            //}]
            //angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[0].saleOrder);
            //$scope.tableIsSelected.tableOrder.push({ saleOrder: angular.copy(saleOrder) });
            createFirstOrder();
        }

        //if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0 && !$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.startTime)
        //    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.startTime = new Date();

        //Thêm item vào danh sách details, thêm newOrderCount và lastInputedIndex.
        if ($scope.isUngroupItem) {
            //Xử lý cho hàng hóa tách món.
            var thisItem = angular.copy(item);
            thisItem.quantity = 1;
            thisItem.newOrderCount = 1;
            thisItem.detailID = uuid.v1();

            //Hàng hóa tính giờ
            if ($scope.hourService.isUse && !$scope.hourService.allProduct && $scope.hourService.itemArr.length > 0) {
                var itemIndexArr = findIndex($scope.hourService.itemArr, 'itemId', item.itemId);
                if (itemIndexArr != null) {
                    thisItem.isServiceItem = true;
                    $scope.startCounter(thisItem);
                }
            }
            if ($scope.pinItem) {
                thisItem.isChild = '—';
                var detailIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex;
                if (detailIndex !== undefined || detailIndex !== null) {
                    thisItem.parentID = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[detailIndex].detailID;
                }

                var itemDetail = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.filter(function (d) {
                    return d.isChild && d.parentID == $scope.pinItem.detailID;
                }).find(function (d) {
                    return d.itemId == item.itemId;
                });

                //Nếu không có trong ds child của item được pin thì thêm vào. 
                if (!itemDetail) {
                    //Thêm item vào vị trí $scope.selectedItemIndex + 1.
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.splice($scope.selectedItemIndex + 1, 0, thisItem);
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = $scope.selectedItemIndex;
                }
                else { //Nếu có rồi thì tăng thêm số lượng.
                    itemDetail.quantity++;
                    itemDetail.newOrderCount++;
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = $scope.selectedItemIndex;
                }
            } else {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.push(thisItem);
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length - 1;
                $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            }
            var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
            $SunoSaleOrderCafe.deleteOrder(saleOrder.saleOrderUuid);
            $SunoSaleOrderCafe.calculateOrder(saleOrder, saleOrder);
        } else {
            //Xử lý cho hàng hóa bình thường

            //var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);
            //if (itemIndex != null) {
            //    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[itemIndex].quantity++;
            //    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[itemIndex].newOrderCount++;
            //    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
            //} else {
            //    item.quantity = 1;
            //    item.newOrderCount = 1;
            //    var thisItem = angular.copy(item);
            //    thisItem.quantity = 1;
            //    thisItem.newOrderCount = 1;
            //    if ($scope.hourService.isUse && !$scope.hourService.allProduct) {
            //        var itemIndexArr = findIndex($scope.hourService.itemArr, 'itemId', item.itemId);
            //        if (itemIndexArr != null) {
            //            thisItem.isServiceItem = true;
            //            $scope.startCounter(thisItem);
            //        }
            //    }
            //    if (printDimetion) {
            //        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.push(thisItem);
            //        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length - 1;
            //        $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            //    } else {
            //        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.unshift(thisItem);
            //        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = 0;
            //    }
            //}

            var thisItem = angular.copy(item);
            var itemIndex = $SunoSaleOrderCafe.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == thisItem.itemId; });
            $SunoSaleOrderCafe.addItem(thisItem, function () { $scope.$apply(); });
            if (itemIndex > -1) {
                $SunoSaleOrderCafe.saleOrder.orderDetails[itemIndex].newOrderCount++;
                $SunoSaleOrderCafe.saleOrder.orderDetails[itemIndex].lastInputedIndex = itemIndex;
            }
            else {
                var insertedItem = $SunoSaleOrderCafe.saleOrder.orderDetails.find(function (d) { return d.itemId == thisItem.itemId; });
                insertedItem.newOrderCount = 1;
                if ($scope.hourService.isUse && !$scope.hourService.allProduct) {
                    var itemIndexArr = findIndex($scope.hourService.itemArr, 'itemId', thisItem.itemId);
                    if (itemIndexArr != null) {
                        insertedItem.isServiceItem = true;
                        $scope.startCounter(insertedItem);
                    }
                }
                //Nếu khi thêm món mới mà món mới đưa vào cuối danh sách thì cuộn thanh cuộn xuống
                if (SunoGlobal.printer.ordering != 'desc') {
                    $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
                    insertedItem.lastInputedIndex = $SunoSaleOrderCafe.saleOrder.orderDetails.length - 1;
                } else {
                    insertedItem.lastInputedIndex = 0;
                }
            }
        }

        //Thêm shared with và bật đèn vàng cho bàn.
        $scope.tableIsSelected.tableStatus = 1;
        var sWIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.sharedWith.findIndex(function (sw) { return sw.deviceID == deviceID && sw.userID == SunoGlobal.userProfile.userId });
        if (sWIndex < 0) {
            $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        }

        $scope.key = null;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = true;
        if ($scope.isInTable) {
            $scope.openTable($scope.tableIsSelected);
        }

        updateSelectedTableToDB();
    }

    $scope.printOrderBarKitchenInMobile = function (printDevice, saleOrder, BarItemSetting, setting) {

        var barOrder = angular.copy(saleOrder);
        barOrder.orderDetails = [];
        var kitchenOder = angular.copy(saleOrder);
        kitchenOder.orderDetails = [];
        for (var i = 0; i < saleOrder.orderDetails.length; i++) {
            var itemIndex = findIndex(BarItemSetting, 'itemId', saleOrder.orderDetails[i].itemId);
            if (itemIndex != null) {
                barOrder.orderDetails.push(saleOrder.orderDetails[i]);
            } else {
                kitchenOder.orderDetails.push(saleOrder.orderDetails[i]);
            }
        }

        if (kitchenOder.orderDetails.length > 0 && barOrder.orderDetails.length > 0) {
            kitchenOder = prepairOrderMobile(kitchenOder, setting);
            barOrder = prepairOrderMobile(barOrder, setting);

            $scope.printInMobile(kitchenOder, "BB", printDevice.kitchenPrinter).then(
              function (success) {
                  setTimeout(function () {
                      //                     window.Suno.printer_disconnect(var data = {ip: printDevice.kitchenPrinter});
                      $scope.printInMobile(barOrder, "BB", printDevice.barPrinter).then(function (success) {

                      });
                  }, 3000);
              }
            );
        } else if (barOrder.orderDetails.length > 0) {
            printOrderInMobile(printDevice.barPrinter, barOrder, "BB", setting);
        } else if (kitchenOder.orderDetails.length > 0) {
            printOrderInMobile(printDevice.kitchenPrinter, kitchenOder, "BB", setting);
        }

    }

    $scope.printInMobile = function (saleOrder, type, printer) {
        //Print
        var deferred = $q.defer();
        var template = initPrintTemplate(saleOrder, type);

        data = {
            printer_type: parseInt(printer.printer), // 0: Error; 1:Bixolon; 2: Fujitsu
            ip: printer.ip,
            texts: template,
            feed: 30
        };

        window.Suno.printer_print(
          data, function (message) {
              console.log("IN THÀNH CÔNG");
              deferred.resolve();
          }, function (message) {
              console.log("CÓ LỖI XẢY RA");
              message.where = "printInMobile";
              deferred.reject(message);
          });
        return deferred.promise;
    }

    $scope.noticeToTheKitchen = function () {
        //Nếu có món trong order mới cho báo bếp
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {

            //Validate quyền thực hiện
            if ($scope.tableIsSelected
              && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
              && $scope.permissionIndex == -1
              ) {
                return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
            }

            //Reset giá trị
            $scope.pinItem = null;
            $scope.showOption = false;

            // Kiem tra co mon trong hoa don can bao bep hay ko, neu hoa don ko co cap nhat mon moi thi ko bao bep nua
            var canPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
            if (canPrint) {

                // Co mon can bao bep 
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = false;
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed = [];
                }

                //Xử lý thông tin cho order để chuẩn bị in.
                // Chi in nhung mon moi order
                var currentOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected];
                var printOrder = angular.copy(currentOrder);
                for (var i = 0; i < printOrder.saleOrder.orderDetails.length; i++) {
                    printOrder.saleOrder.orderDetails[i].quantity = printOrder.saleOrder.orderDetails[i].newOrderCount;
                }
                printOrder = removeItemZeroForPrint(printOrder);
                //Mảng chứa các món mới báo bếp cho đồng bộ.
                var untrackedItem = [];
                for (var i = 0; i < printOrder.saleOrder.orderDetails.length; i++) {
                    var obj = {
                        itemID: printOrder.saleOrder.orderDetails[i].itemId,
                        itemName: printOrder.saleOrder.orderDetails[i].itemName,
                        quantity: printOrder.saleOrder.orderDetails[i].quantity,
                    }
                    if ($scope.isUngroupItem) {
                        obj.detailID = printOrder.saleOrder.orderDetails[i].detailID;
                    }
                    untrackedItem.push(obj);
                }
                printOrder.saleOrder.printedCount = currentOrder.saleOrder.printed.length + 1;
                if (printOrder.saleOrder.printed) delete printOrder.saleOrder.printed;
                if (printOrder.saleOrder.logs) delete printOrder.saleOrder.logs;
                if (printOrder.saleOrder.sharedWith) delete printOrder.saleOrder.sharedWith;
                currentOrder.saleOrder.printed.push(printOrder);
                var printTemp = angular.copy(printOrder);
                printTemp.saleOrder.timestamp = genTimestamp();

                var setting = {
                    companyInfo: $scope.companyInfo.companyInfo,
                    allUsers: $scope.authBootloader.users,
                    store: $scope.currentStore
                }

                if ($scope.printSetting.printNoticeKitchen == false) {
                    // Neu cho phep in bao bep o thiet lap in 
                    if ($scope.isWebView) {
                        if ($scope.isUngroupItem && $scope.printSetting.noticeByStamps) {
                            printOrder.saleOrder = prepProcessStamps(printOrder.saleOrder);
                            printOrderInBrowser(printer, printOrder.saleOrder, 256, setting);
                        }
                        else {
                            if ($scope.printSetting.unGroupBarKitchen)
                                printOrderBarKitchen(printer, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInBrowser(printer, printOrder.saleOrder, 128, setting);
                        }
                    } else {
                        if ($scope.isIOS && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                            if ($scope.printSetting.unGroupBarKitchen)
                                $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                        } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                            if ($scope.printSetting.unGroupBarKitchen)
                                $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                        }
                    }
                }

                var pOrderIndex = currentOrder.saleOrder.printed.indexOf(printOrder);
                currentOrder.saleOrder.printed[pOrderIndex] = printTemp;
                //printOrder.saleOrder.printed = printTemp;
                for (var i = 0; i < currentOrder.saleOrder.orderDetails.length; i++) {
                    currentOrder.saleOrder.orderDetails[i].newOrderCount = 0;
                    currentOrder.saleOrder.orderDetails[i].comment = '';
                }
                //Cập nhật xuống DB Local.
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: $scope.tableIsSelected.tableUuid }
                    },
                    fields: ['_id', '_rev']
                })
                .then(function (data) {
                    if (data.docs.length > 0) {
                        var table = angular.copy($scope.tableIsSelected);
                        table._id = data.docs[0]._id;
                        table._rev = data.docs[0]._rev;
                        table.store = $scope.currentStore.storeID;
                        return DBTables.$addDoc(table);
                    }
                    return null;
                })
                .then(function (data) {
                    //log for debug.
                    //console.log(data);
                })
                .catch(function (e) {
                    console.log(e);
                })

                toaster.pop('success', "", 'Đã gửi đơn hàng xuống bếp!');

                if ($scope.isSync) {
                    // var currentTableOrder = [];
                    // currentTableOrder.push($scope.tableIsSelected);
                    // var ownerOrder = filterOwnerOrder(currentTableOrder,SunoGlobal.userProfile.userId);
                    //var currentTable = {};
                    var currentTable = angular.copy($scope.tableIsSelected);
                    var currentTableOrder = [];
                    currentTableOrder.push(currentTable);
                    currentTableOrder[0].tableOrder = [];
                    currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    var timestamp = genTimestamp();
                    //console.log($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    for (var x = 0; x < untrackedItem.length; x++) {
                        if (!$scope.isUngroupItem) {
                            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                                new Log(untrackedItem[x].itemID, untrackedItem[x].itemName, "BB", untrackedItem[x].quantity, timestamp, deviceID, false));
                        }
                        else {
                            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                                new UngroupLog(untrackedItem[x].itemID, untrackedItem[x].itemName, "BB", untrackedItem[x].quantity, timestamp, deviceID, untrackedItem[x].detailID, false));
                        }
                    }
                    //$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].logs.push(new Log());
                    //for (var x = 0; x < currentTableOrder.length; x++) {
                    //    for (var y = 0; y < currentTableOrder[x].tableOrder.length; y++) {
                    //        currentTableOrder[x].tableOrder[y].saleOrder.revision++;
                    //    }
                    //}
                    //console.log($scope.tables);
                    var updateData = {
                        "companyId": SunoGlobal.companyInfo.companyId,
                        "storeId": $scope.currentStore.storeID,
                        "clientId": SunoGlobal.userProfile.sessionId,
                        "shiftId": null,//LSFactory.get('shiftId'),
                        "startDate": "",
                        "finishDate": "",
                        "tables": angular.copy(currentTableOrder),
                        "zone": $scope.tableMap,
                        "info": {
                            author: SunoGlobal.userProfile.userId,
                            deviceID: deviceID,
                            timestamp: timestamp,
                            action: 'BB',
                            isUngroupItem: $scope.isUngroupItem
                        }
                    }
                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    .then(function (data) {
                        var shiftId = null;
                        if (data.docs.length > 0) {
                            shiftId = data.docs[0].shiftId;
                        }
                        updateData.shiftId = shiftId;
                        updateData = angular.toJson(updateData);
                        updateData = JSON.parse(updateData);
                        if (isSocketConnected) {
                            console.log('updateData', updateData);
                            socket.emit('updateOrder', updateData);
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    });

                    if ($scope.printSetting.printNoticeKitchen == false && !$scope.isWebView && (!$scope.printDevice || !$scope.printDevice.kitchenPrinter.status)) {
                        // nếu không phải trên trình duyệt + cho phép in bếp + cho phép in hộ thì mới gửi lệnh in hộ lên socket
                        DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                        .then(function (data) {
                            var shiftId = null;
                            if (data.docs.length > 0) {
                                shiftId = data.docs[0].shiftId;
                            }
                            var printHelperData = {
                                "companyId": SunoGlobal.companyInfo.companyId,
                                "storeId": $scope.currentStore.storeID,
                                "clientId": SunoGlobal.userProfile.sessionId,
                                "shiftId": shiftId,//LSFactory.get('shiftId'),
                                "printOrder": printOrder.saleOrder,
                                "printSetting": setting,
                                "orderType": "kitchen"
                            }

                            printHelperData = angular.toJson(printHelperData);
                            printHelperData = JSON.parse(printHelperData);
                            if (isSocketConnected) {
                                socket.emit('printHelper', printHelperData);
                            }
                        })
                        .catch(function (error) {
                            console.log(error);
                        });
                    }
                }
            }
        }
    }

    $scope.rePrint = function (o) {
        var setting = {
            companyInfo: $scope.companyInfo.companyInfo,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        var printOrder = angular.copy(o);
        // if($scope.isWebView){
        //   // console.log('In bếp từ trình duyệt');
        //   printOrderInBrowser(printer, o.saleOrder, 128, setting);
        // }else{            
        //   if($scope.isIOS && $scope.printDevice && $scope.printDevice.kitchenPrinter.status && angular.isDefined(window.Suno)){
        //      // console.log('in bep truc tiep tren IOS');
        //      // printOrderInMobile($scope.printDevice.kitchenPrinter.ip,o.saleOrder,"BB",setting);
        //   }else if($scope.isAndroid){
        //     // console.log('in bep Android');
        //     // printOrderInMobile($scope.printDevice.kitchenPrinter.ip,o.saleOrder,"BB",setting);
        //   }
        // }


        if ($scope.printSetting.printNoticeKitchen == false) {
            // Neu cho phep in bao bep o thiet lap in 
            if ($scope.isWebView) {
                if ($scope.isUngroupItem && $scope.printSetting.noticeByStamps) {
                    printOrder.saleOrder = prepProcessStamps(printOrder.saleOrder);
                    printOrderInBrowser(printer, printOrder.saleOrder, 256, setting);
                }
                else {
                    if ($scope.printSetting.unGroupBarKitchen)
                        printOrderBarKitchen(printer, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInBrowser(printer, printOrder.saleOrder, 128, setting);
                }
            } else {
                if ($scope.isIOS && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                    if ($scope.printSetting.unGroupBarKitchen)
                        $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                    if ($scope.printSetting.unGroupBarKitchen)
                        $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                }
            }
        }

        toaster.pop('primary', "", 'Đã gửi đơn hàng xuống bếp!');
        $scope.modalPrintedList.hide();
    }

    $scope.closeRePrintList = function () {
        $scope.modalPrintedList.hide();
    }

    $scope.showChangeQuantity = false;

    $scope.openChangeQuantity = function (op) {
        $scope.selectedItem.changeQuantity = 1
        $scope.showChangeQuantity = true;
        $scope.showChangeQuantityOption = op;
    }

    $scope.closeChangeQuantity = function () {
        $scope.showChangeQuantity = false;
    }

    $scope.removeItem = function (q) {
        $scope.showChangeQuantityOption = 1;
        $scope.submitChangeQuantity(q);
    }

    $scope.submitChangeQuantity = function (quantity) {
        debugger;
        if (!quantity) {
            return toaster.pop('warning', "", 'Vui lòng nhập số lượng thay đổi');
        } else {
            if ($scope.showChangeQuantityOption == 2) {
                // console.log('tăng ' + quantity);
                toaster.pop('success', "", 'Tăng ' + quantity + ' [' + $scope.selectedItem.itemName + '] trong hoá đơn');
                $scope.changeQuantity(quantity, $scope.selectedItem);
                $scope.selectedItem.changeQuantity = null;
                $scope.hideItemOption();
            } else if ($scope.showChangeQuantityOption == 1) {
                // console.log('giảm ' + quantity);
                $scope.checkRemoveItem(-quantity, $scope.selectedItem);
                $scope.selectedItem.changeQuantity = null;
                $scope.hideItemOption();
            } else if ($scope.showChangeQuantityOption == 3) {
                toaster.pop('success', "", 'Cập nhật lại số lượng của [' + $scope.selectedItem.itemName + '] thành '+ quantity +' trong hoá đơn');
                var index = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex;
                var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[index];
                if (item.quantity > quantity) {
                    //Nếu sl cũ > mới -> giảm
                    $scope.checkRemoveItem(quantity - item.quantity, $scope.selectedItem);
                }
                else {
                    //Nếu sl cũ < mới -> tăng
                    $scope.changeQuantity(quantity - item.quantity, $scope.selectedItem);
                }
                $scope.selectedItem.changeQuantity = null;
                $scope.hideItemOption();
            }
            $scope.showChangeQuantity = false;
        }

    }

    $scope.fastRemoveItem = function (quantity, item, $event) {
        // console.log($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
        $scope.pinItem = null;
        $scope.selectedItem = item;
        if ($scope.selectedItem.quantity > 1) {
            $scope.checkRemoveItem(-quantity, $scope.selectedItem);
            $scope.selectedItem.changeQuantity = null;
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    }


    $scope.changeQuantity = function (num, item, $event) {
        var qtyBeforeChange = item.quantity;
        var checkItem = angular.copy(item);

        // Kiểm tra quyền thao tác trên hóa đơn
        var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        if (saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (num) {
            //Thêm sharedWith
            var sWIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.sharedWith.findIndex(function (log) { return log.deviceID == deviceID && log.userID == SunoGlobal.userProfile.userId });
            if (sWIndex < 0) {
                $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
            }

            $scope.pinItem = null;
            //Tính toán lại số lượng
            if (num > 0) {
                item.newOrderCount = parseFloat(num) + parseFloat(item.newOrderCount);
                item.newOrderCount = (item.newOrderCount === parseInt(item.newOrderCount, 10)) ? item.newOrderCount : parseFloat(item.newOrderCount).toFixed(2);
                item.quantity = parseFloat(num) + parseFloat(item.quantity);
                item.quantity = (item.quantity === parseInt(item.quantity, 10)) ? item.quantity : parseFloat(item.quantity).toFixed(2);
            } else if (num < 0) {
                if (item.quantity < -num) num = -item.quantity;
                item.quantity = parseFloat(num) + parseFloat(item.quantity);
                item.quantity = (item.quantity === parseInt(item.quantity, 10)) ? item.quantity : parseFloat(item.quantity).toFixed(2);
                if (item.newOrderCount > 0 && item.newOrderCount >= -num) {
                    item.newOrderCount = parseFloat(num) + parseFloat(item.newOrderCount);
                    item.newOrderCount = (item.newOrderCount === parseInt(item.newOrderCount, 10)) ? item.newOrderCount : parseFloat(item.newOrderCount).toFixed(2);
                } else {
                    if (item.newOrderCount > 0 && item.newOrderCount < -num) item.newOrderCount = 0;
                }
            }

            //console.log($scope.tables[3].tableOrder[0].saleOrder === $SunoSaleOrderCafe.saleOrder);
            //Tính toán lại tiền
            $SunoSaleOrderCafe.changeQuantityOnItem(item);
            //calculateTotal($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);

            //Tính toán cho hàng tách món
            var childItems = [];
            if (num < 0 && qtyBeforeChange == -num) {
                if ($scope.isUngroupItem) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.forEach(function (d) {
                        if (d.isChild && d.parentID == item.detailID) {
                            childItems.push({
                                itemID: d.itemId,
                                itemName: d.itemName,
                                detailID: d.detailID,
                                quantity: d.quantity
                            });
                            d.quantity = 0;
                            $SunoSaleOrderCafe.changeQuantityOnItem(d);
                        }
                    });
                }
            }

            //Cập nhật lastInputedIndex
            var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);
            if (item.quantity > 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
            } else {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = 0;
                $scope.showOption = false;
            }

            //Cập nhật lại trạng thái và xóa các item số lượng = 0;
            removeItemZero($SunoSaleOrderCafe);
            //$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] = removeItemZero($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            removeUnNotice($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);

            var isActived = tableIsActive($scope.tableIsSelected);
            if (!isActived) {
                $scope.tableIsSelected.tableStatus = 0;
            }

            //Lưu xuống DB Local
            updateSelectedTableToDB();

            //Đồng bộ đơn hàng.
            if (num < 0 && $scope.isSync) {
                // var currentTableOrder = [];
                // currentTableOrder.push($scope.tableIsSelected);
                // var ownerOrder = filterOwnerOrder(currentTableOrder,SunoGlobal.userProfile.userId);
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0 && $scope.isSync) {
                    var currentTable = {};
                    angular.copy($scope.tableIsSelected, currentTable);

                    var timestamp = genTimestamp();
                    var currentTableOrder = [];
                    currentTableOrder.push(currentTable);
                    currentTableOrder[0].tableOrder = [];
                    currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    if (!$scope.isUngroupItem) {
                        currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                            new Log(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, false));
                    } else {
                        currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                            new UngroupLog(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, item.detailID, false));
                        //Thêm logs của các child items bị xóa do xóa item chính.
                        childItems.forEach(function (i) {
                            currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                                new UngroupLog(i.itemID, i.itemName, "H", i.quantity, timestamp, deviceID, i.detailID, false));
                        });
                    }

                    var completeOrder = {
                        "companyId": SunoGlobal.companyInfo.companyId,
                        "storeId": $scope.currentStore.storeID,
                        "clientId": SunoGlobal.userProfile.sessionId,
                        "shiftId": null, //LSFactory.get('shiftId'),
                        "startDate": "",
                        "finishDate": "",
                        "tables": angular.copy(currentTableOrder),
                        "zone": $scope.tableMap,
                        "info": {
                            action: "clearItem",
                            deviceID: deviceID,
                            timestamp: timestamp,
                            author: SunoGlobal.userProfile.userId,
                            isUngroupItem: $scope.isUngroupItem
                        }
                    };
                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    .then(function (data) {
                        var shiftId = null;
                        if (data.docs.length > 0) {
                            shiftId = data.docs[0].shiftId;
                        }
                        completeOrder.shiftId = shiftId;
                        completeOrder = angular.toJson(completeOrder);
                        completeOrder = JSON.parse(completeOrder);
                        if (isSocketConnected) {
                            console.log('completeData', completeOrder);
                            socket.emit('completeOrder', completeOrder);
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    });


                } else if (checkItem.newOrderCount < -num) {
                    var currentTable = {};
                    angular.copy($scope.tableIsSelected, currentTable);

                    var timestamp = genTimestamp();
                    var currentTableOrder = [];
                    currentTableOrder.push(currentTable);
                    currentTableOrder[0].tableOrder = [];
                    currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    if (!$scope.isUngroupItem) {
                        currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                            new Log(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount , timestamp, deviceID, false));
                    } else {
                        currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                            new UngroupLog(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, item.detailID, false));
                        //Thêm logs của các child items bị xóa do xóa item chính.
                        childItems.forEach(function (i) {
                            currentTableOrder[0].tableOrder[0].saleOrder.logs.push(
                                new UngroupLog(i.itemID, i.itemName, "H", i.quantity, timestamp, deviceID, i.detailID, false));
                        });
                    }
                    var updateData = {
                        "companyId": SunoGlobal.companyInfo.companyId,
                        "storeId": $scope.currentStore.storeID,
                        "clientId": SunoGlobal.userProfile.sessionId,
                        "shiftId": null,//LSFactory.get('shiftId'),
                        "startDate": "",
                        "finishDate": "",
                        "tables": angular.copy(currentTableOrder),
                        "zone": $scope.tableMap,
                        "info": {
                            author: SunoGlobal.userProfile.userId,
                            deviceID: deviceID,
                            timestamp: timestamp,
                            action: "H",
                            isUngroupItem: $scope.isUngroupItem
                        }
                    }
                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    .then(function (data) {
                        var shiftId = null;
                        if (data.docs.length > 0) {
                            shiftId = data.docs[0].shiftId;
                        }
                        updateData.shiftId = shiftId;
                        updateData = angular.toJson(updateData);
                        updateData = JSON.parse(updateData);
                        if (isSocketConnected) {
                            console.log('updateData', updateData);
                            socket.emit('updateOrder', updateData);
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    })
                }
            }

        } else {
            return toaster.pop('warning', "", 'Vui lòng nhập số lượng thay đổi');
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
        //console.log($SunoSaleOrderCafe.saleOrder);
    }

    $scope.checkRemoveItem = function (num, item) {
        var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        // var removeSetting = $scope.removeSetting;
        if (saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        } else {
            switch ($scope.removeSetting) {
                case 1:
                    // Nếu cho phép huỷ món ko cần xác nhận
                    $scope.changeQuantity(num, item);
                    toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                    break;
                case 2:
                    // Được hủy món chưa in bếp, khi đã in bếp thì cần xác nhận quản lý/chủ cửa hàng
                    if (item.newOrderCount > 0 && item.newOrderCount >= -num) {
                        $scope.changeQuantity(num, item);
                        toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                    } else {
                        $scope.staff = {};
                        var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Quản lý');
                        if (findRoleIndex != null) {
                            $ionicPopup.show({
                                title: 'Xác nhận huỷ món',
                                subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                                scope: $scope,
                                buttons: [{
                                    text: 'Trở lại'
                                }, {
                                    text: '<b>Xác nhận</b>',
                                    type: 'button-positive',
                                    onTap: function (e) {
                                        $scope.changeQuantity(num, item);
                                        toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                                    }
                                }]
                            });
                        } else {
                            $ionicPopup.show({
                                template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                                title: 'Xác nhận huỷ món',
                                subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                                scope: $scope,
                                buttons: [{
                                    text: 'Trở lại'
                                }, {
                                    text: '<b>Xác nhận</b>',
                                    type: 'button-positive',
                                    onTap: function (e) {
                                        if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                            toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                            return false;
                                        } else {
                                            //d = {
                                            //    "username": $scope.staff.username,
                                            //    "password": $scope.staff.password,
                                            //    "extConfig": {
                                            //        db: DBSettings,
                                            //        token: $scope.token
                                            //    }
                                            //}
                                            //url = Api.getMemberPermission;
                                            //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
                                            //    if (data) {
                                            //        var permissionList = data.permissions;
                                            //        var permission = permissionList.indexOf("POSIM_Manage");
                                            //        if (permission != -1) {
                                            //            $scope.changeQuantity(num, item);
                                            //            toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                            //        } else {
                                            //            toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                            //        }
                                            //    }
                                            //}, function (e) {
                                            //    toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                            //}, true, 'check-login');
                                            var url = Api.getMemberPermission;
                                            var method = 'POST';
                                            var d = {
                                                "username": $scope.staff.username,
                                                "password": $scope.staff.password
                                            };
                                            $SunoRequest.makeRestful(url, method, d)
                                                .then(function (data) {
                                                    var permissionList = data.permissions;
                                                    var permission = permissionList.indexOf("POSIM_Manage");
                                                    if (permission != -1) {
                                                        $scope.changeQuantity(num, item);
                                                        toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                                    } else {
                                                        toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                                    }
                                                })
                                                .catch(function (e) {
                                                    toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                                });
                                        }
                                    }
                                }]
                            });
                        }
                    }
                    break;
                case 3:
                    // xác nhận khi huỷ món
                    $scope.staff = {};
                    var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Quản lý');
                    if (findRoleIndex != null) {
                        $ionicPopup.show({
                            // template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    $scope.changeQuantity(num, item);
                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                }
                            }]
                        });
                    } else {
                        $ionicPopup.show({
                            template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                        toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        return false;
                                    } else {
                                        //d = {
                                        //    "username": $scope.staff.username,
                                        //    "password": $scope.staff.password,
                                        //    "extConfig": {
                                        //        db: DBSettings,
                                        //        token: $scope.token
                                        //    }
                                        //}
                                        //url = Api.getMemberPermission;
                                        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
                                        //    if (data) {
                                        //        var permissionList = data.permissions;
                                        //        var permission = permissionList.indexOf("POSIM_Manage");
                                        //        if (permission != -1) {
                                        //            $scope.changeQuantity(num, item);
                                        //            toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                        //        } else {
                                        //            toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                        //        }
                                        //    }
                                        //}, function (e) {
                                        //    toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        //    }, true, 'check-login');

                                        var url = Api.getMemberPermission;
                                        var method = 'POST';
                                        var d = {
                                            "username": $scope.staff.username,
                                            "password": $scope.staff.password
                                        };
                                        $SunoRequest.makeRestful(url, method, d)
                                        .then(function (data) {
                                            var permissionList = data.permissions;
                                            var permission = permissionList.indexOf("POSIM_Manage");
                                            if (permission != -1) {
                                                $scope.changeQuantity(num, item);
                                                toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                            } else {
                                                toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                            }  
                                        })
                                        .catch(function (e) {
                                            toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                        });
                                    }
                                }
                            }]
                        });
                    }
                    break;
                case 4:
                    $scope.staff = {};
                    var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Chủ cửa hàng');
                    if (findRoleIndex != null) {
                        $ionicPopup.show({
                            // template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    $scope.changeQuantity(num, item);
                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                }
                            }]
                        });
                    } else {
                        $ionicPopup.show({
                            template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                        toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        return false;
                                    } else {
                                        //d = {
                                        //    "username": $scope.staff.username,
                                        //    "password": $scope.staff.password,
                                        //    "extConfig": {
                                        //        db: DBSettings,
                                        //        token: $scope.token
                                        //    }
                                        //}
                                        //url = Api.getMemberPermission;
                                        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
                                        //    if (data) {
                                        //        var permissionList = data.permissions;
                                        //        var permission = permissionList.indexOf("POSIM_Price_ReadBuyPrice");
                                        //        if (permission != -1) {
                                        //            $scope.changeQuantity(num, item);
                                        //            toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                        //        } else {
                                        //            toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                        //        }
                                        //    }
                                        //}, function (e) {
                                        //    toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        //    }, true, 'check-login');

                                        var url = Api.getMemberPermission;
                                        var method = 'POST';
                                        var d = {
                                            "username": $scope.staff.username,
                                            "password": $scope.staff.password
                                        };
                                        $SunoRequest.makeRestful(url, method, d)
                                            .then(function (data) {
                                                var permissionList = data.permissions;
                                                var permission = permissionList.indexOf("POSIM_Price_ReadBuyPrice");
                                                if (permission != -1) {
                                                    $scope.changeQuantity(num, item);
                                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                                } else {
                                                    toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                                }
                                            })
                                            .catch(function (e) {
                                                toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                            });
                                    }
                                }
                            }]
                        });
                    }
                    break;
            };
        }
    }

    $scope.changeItemPrice = function (price) {
        // console.log($scope.selectedItem,price);
        if (!price || price == 0) {
            return toaster.pop('warning', "", 'Vui lòng kiểm tra lại giá bán mới.');
        } else
            $scope.selectedItem.unitPrice = parseFloat(price);
    }

    $scope.showOption = false;

    $scope.openItemOption = function (i, itemIndex) {
        $scope.pinItem = null;
        $scope.selectedItem = i;
        $scope.showOption = true;
        $scope.showOrderDetails = false;
        $scope.selectedItemIndex = itemIndex;
        // var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', i.itemId);
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
        $ionicScrollDelegate.$getByHandle('orders-details').scrollTop();
    }

    $scope.pin = function (i, index, $event) {
        $scope.selectedItem = i;

        if ($scope.pinItem && $scope.pinItem.itemId == i.itemId && index == $scope.selectedItemIndex) {
            $scope.pinItem = null;
        } else {
            $scope.pinItem = i;
        }
        $scope.selectedItemIndex = index;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = index;

        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    }

    $scope.hideItemOption = function () {
        $scope.showOption = false;
    }

    $scope.showOrderDiscount = false;

    $scope.openOrderDiscount = function () {
        $scope.showOrderDiscount = !$scope.showOrderDiscount;
    }

    $scope.showOrderDetails = false;

    $scope.openOrderDetails = function () {
        debugger;
        $scope.pinItem = null;
        $scope.showOption = false;
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.showOrderDetails = !$scope.showOrderDetails;
        }
    }
    $scope.closeOrderDetails = function () {
        $scope.showOrderDetails = false;
        $ionicScrollDelegate.resize();
    }

    $ionicPopover.fromTemplateUrl('payment-method.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverPaymentMethod = popover;
    });

    $scope.openPopOverPaymentMethod = function (e) {
        if ($scope.receiptVoucher && $scope.receiptVoucher.length == 0) {
            $scope.popoverPaymentMethod.show(e);
        }
    }

    $scope.changePaymentMethod = function (id) {
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].paymentMethodId = id;
        $scope.popoverPaymentMethod.hide();
    }

    $scope.receiptVoucher = [];

    $scope.addPaymentMethod = function () {
        if ($scope.receiptVoucher.length == 0) {
            var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
            if (saleOrder.amountPaid < saleOrder.total) {
                $scope.receiptVoucher.push({
                    "paymentMethodId": saleOrder.payments[0].paymentMethodId == 1 ? 2 : 1,
                    "status": 0,
                    "amount": (parseFloat(saleOrder.amountPaid) < parseFloat(saleOrder.total)) ? saleOrder.total - saleOrder.amountPaid : 0
                });
            }
        }
    }

    $scope.removePaymentMethod = function () {
        $scope.receiptVoucher = [];
    }

    $scope.sugUserList = false;
    $scope.customerS = {
        key: null
    };
    $scope.search_user = function () {
        if (!$scope.customerS.key) {
            $scope.sugUserList = false;
            return;
        }
        //var url = Api.customers + $scope.customerS.key;
        //var data = { extConfig: { db: DBSettings, token: $scope.token } };
        //asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
        //    $scope.searchUserList = data.customers;
        //}, function (error) {
        //    // console.log(error);
        //    toaster.pop('error', "", error.responseStatus.message);
        //    }, true, 'search-user');

        //var url = Api.customers + $scope.customerS.key;
        //var method = 'GET';
        //var data = null;
        //$SunoRequest.makeRestful(url, method, data)
        //    .then(function (data) {
        //        $scope.searchUserList = data.customers;
        //    })
        //    .catch(function (e) {
        //        console.log(e);
        //        toaster.pop('error', "", error.responseStatus.message);
        //    });
        var limit = 1000;
        var pageNo = 1;
        $SunoCustomer.search($scope.customerS.key, limit, pageNo)
        .then(function (data) {
            console.log(data);
            $scope.searchUserList = data.items;
            $scope.$apply();
        })
        .catch(function (e) {
            console.log(e);
            toaster.pop('error', "", error.responseStatus.message);
        })
        $scope.sugUserList = true;
    }

    $scope.addCustomer = function (u) {
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.customer = u;

        $scope.sugUserList = false;
        $scope.customerS = {
            key: null
        };;
    }

    $scope.removeUser = function () {
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.customer = null;
    }

    $scope.openModalCreateCustomer = function () {
        $ionicModal.fromTemplateUrl('create-new-customer.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modalCreateCustomer = modal;
            $scope.customer = {};
            $scope.modalCreateCustomer.show();
        });
    }

    $scope.closeModalCreateCustomer = function () {
        $scope.modalCreateCustomer.hide();
    }

    $scope.closeModalCustomer = function () {
        $scope.modalCreateCustomer.hide();
    }

    $scope.saveCustomer = function (c) {
        //var url = Api.addCustomer;
        //var d = {
        //    customer: c,
        //    extConfig: {
        //        db: DBSettings,
        //        token: $scope.token
        //    }
        //}

        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
        //    if (data && data.customerId) {
        //        c.customerId = data.customerId;
        //        c.code = data.code;
        //        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.customer = c;
        //        toaster.pop('success', "", 'Đã thêm khách hàng mới thành công.');
        //        $scope.modalCreateCustomer.hide();
        //    }
        //}, function (error) {
        //    toaster.pop('error', "", error.responseStatus.message);
        //    }, true, 'save-customer');

        var url = Api.addCustomer;
        var method = 'GET';
        var d = {
            customer: c
        }
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                c.customerId = data.customerId;
                c.code = data.code;
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.customer = c;
                toaster.pop('success', "", 'Đã thêm khách hàng mới thành công.');
                $scope.modalCreateCustomer.hide();
                $scope.$apply();
            })
            .catch(function (e) {
                toaster.pop('error', "", error.responseStatus.message);
            });
    }

    $scope.submitOrder = function (isPrint) {
        // console.log($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);exit;
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && $scope.permissionIndex == -1) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            if ($scope.hourService.isUse) {
                var indexService = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'timer', true);
                if (indexService != null) {
                    return toaster.pop('warning', "", 'Bạn chưa hoàn tất tính giờ cho đơn hàng hiện tại');
                }
            }

            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = false;
            prepareOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);

            if (!SunoGlobal.saleSetting.isAllowDebtPayment) {
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.amountPaid < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total)
                    return toaster.pop('warning', "", 'Hệ thống được thiết lập không cho phép bán nợ! Vui lòng thiết lập cho phép bán nợ để có thể xử lý đơn hàng này!');
            }

            if ($scope.selectedItem) {
                $scope.selectedItem = null;
                $scope.hideItemOption();
            }

            var submitOrder = angular.copy($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
            
            if (submitOrder.hasOwnProperty('note')) {
                submitOrder.createdByName = submitOrder.note;
            }

            for (var i = 0; i < submitOrder.orderDetails.length; i++) {
                var item = submitOrder.orderDetails[i];
                if (item.discountIsPercent == true) {
                    item.discount = item.discountInPercent;
                }
            }

            var url = Api.submitOrder;
            var method = 'POST';
            var d = {
                saleOrder: submitOrder,
                currentStore: $scope.currentStore,
                user: $scope.userSession
            };
            $SunoRequest.makeRestful(url, method, d)
                .then(function (data) {
                    $scope.showOrderDetails = false;
                    if ($scope.receiptVoucher.length > 0 && $scope.receiptVoucher[0].amount > 0) {
                        var url = Api.receipt;
                        var method = 'POST';
                        var d1 = {
                            "saleOrderId": data.saleOrderId,
                            "storeId": $scope.currentStore.storeID,
                            "isUpdateAmountPaid": false,
                            "receiptVoucher": $scope.receiptVoucher[0]
                        };
                        $SunoRequest.makeRestful(url, method, d1)
                            .then(function (data) {
                                $scope.receiptVoucher = [];
                                $scope.$apply();
                            })
                            .catch(function (e) {
                                console.log(e);
                            });
                    }
                    // console.log('z = ' + isPrint);
                    if (isPrint == 1) {
                        // console.log('z2');
                        var printOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
                        printOrder.saleOrderCode = data.saleOrderCode;
                        var setting = {
                            companyInfo: $scope.companyInfo.companyInfo,
                            allUsers: $scope.authBootloader.users,
                            store: $scope.currentStore
                        }

                        if ($scope.isWebView) {
                            var rs = printOrderInBrowser(printer, printOrder, 1, setting);
                            if (rs) {
                                toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
                            } else {
                                toaster.pop('error', "", 'Đã lưu hóa đơn nhưng không in được, vui lòng kiểm tra lại mẫu in.');
                            }
                        } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
                            // console.log('in bep truc tiep tren IOS');
                            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);

                            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                            toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
                        } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
                            // console.log('in bep Android');
                            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                            toaster.pop('success', "", 'Đã lưu hoá đơn thành công.');
                        }

                    }

                    if ($scope.isSync) {
                        //debugger;
                        var currentTable = {};
                        angular.copy($scope.tableIsSelected, currentTable);

                        var currentTableOrder = [];
                        currentTableOrder.push(currentTable);
                        currentTableOrder[0].tableOrder = [];
                        currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                        var completeOrder = {
                            "companyId": SunoGlobal.companyInfo.companyId,
                            "storeId": $scope.currentStore.storeID,
                            "clientId": SunoGlobal.userProfile.sessionId,
                            "shiftId": null,//LSFactory.get('shiftId'),
                            "startDate": "",
                            "finishDate": "",
                            "tables": angular.copy(currentTableOrder),
                            "zone": $scope.tableMap,
                            "info": {
                                action: "done",
                                deviceID: deviceID,
                                timestamp: genTimestamp(),
                                author: SunoGlobal.userProfile.userId,
                                isUngroupItem: $scope.isUngroupItem
                            }
                        }
                        DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                            .then(function (data) {
                                //debugger;
                                var shiftId = null;
                                if (data.docs.length > 0) {
                                    shiftId = data.docs[0].shiftId;
                                }

                                completeOrder.shiftId = shiftId;

                                //debugger;
                                console.log('completeOrderData', completeOrder);
                                completeOrder = angular.toJson(completeOrder);
                                completeOrder = JSON.parse(completeOrder);
                                if (isSocketConnected) {
                                    socket.emit('completeOrder', completeOrder);
                                }
                            })
                            .catch(function (error) {
                                console.log(error);
                            })

                        if ($scope.printSetting.printSubmitOrder == false && !$scope.isWebView && (!$scope.printDevice || !$scope.printDevice.cashierPrinter.status)) {
                            // nếu không phải trên trình duyệt + cho phép in thanh toán + cho phép in hộ thì mới gửi lệnh in hộ lên socket

                            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                .then(function (data) {
                                    var shiftId = null;
                                    if (data.docs.length > 0) {
                                        shiftId = data.docs[0].shiftId;
                                    }
                                    var printHelperData = {
                                        "companyId": SunoGlobal.companyInfo.companyId,
                                        "storeId": $scope.currentStore.storeID,
                                        "clientId": SunoGlobal.userProfile.sessionId,
                                        "shiftId": shiftId, //LSFactory.get('shiftId'),
                                        "printOrder": printOrder,
                                        "printSetting": setting,
                                        "orderType": "cashier",
                                        "info": {
                                            action: "print",
                                            deviceID: deviceID,
                                            timestamp: genTimestamp(),
                                            author: SunoGlobal.userProfile.userId
                                        }
                                    }

                                    printHelperData = angular.toJson(printHelperData);
                                    printHelperData = JSON.parse(printHelperData);
                                    if (isSocketConnected) {
                                        socket.emit('printHelper', printHelperData);
                                    }
                                })
                                .catch(function (error) {
                                    console.log(error);
                                })
                        }
                    }
                    angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
                    var tableStatus = tableIsActive($scope.tableIsSelected);
                    if (tableStatus == false) {
                        $scope.tableIsSelected.tableStatus = 0;
                    }
                    $scope.cancelOrder();
                })
                .catch(function (e) {
                    toaster.pop('error', "", e.responseStatus.message);
                });

            //var d = {
            //    saleOrder: submitOrder,
            //    currentStore: $scope.currentStore,
            //    user: $scope.userSession,
            //    extConfig: {
            //        db: DBSettings,
            //        token: $scope.token
            //    }
            //};

            //var url = Api.submitOrder;
            //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
            //    if (data) {
            //        $scope.showOrderDetails = false;
            //        if ($scope.receiptVoucher.length > 0 && $scope.receiptVoucher[0].amount > 0) {
            //            var url = Api.receipt;
            //            var d = {
            //                "saleOrderId": data.saleOrderId,
            //                "storeId": $scope.currentStore.storeID,
            //                "isUpdateAmountPaid": false,
            //                "receiptVoucher": $scope.receiptVoucher[0],
            //                "extConfig": {
            //                    db: DBSettings,
            //                    token: $scope.token
            //                }
            //            }
            //            asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', d, function (data, status) {
            //                $scope.receiptVoucher = [];
            //            }, function (e) { console.log(e) }, true, 'createReceipt');
            //        }
            //        // console.log('z = ' + isPrint);
            //        if (isPrint == 1) {
            //            // console.log('z2');
            //            var printOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
            //            printOrder.saleOrderCode = data.saleOrderCode;
            //            var setting = {
            //                companyInfo: $scope.companyInfo.companyInfo,
            //                allUsers: $scope.authBootloader.users,
            //                store: $scope.currentStore
            //            }

            //            if ($scope.isWebView) {
            //                var rs = printOrderInBrowser(printer, printOrder, 1, setting);
            //                if (rs) {
            //                    toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
            //                } else {
            //                    toaster.pop('error', "", 'Đã lưu hóa đơn nhưng không in được, vui lòng kiểm tra lại mẫu in.');
            //                }
            //            } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
            //                // console.log('in bep truc tiep tren IOS');
            //                // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);

            //                printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
            //                toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
            //            } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
            //                // console.log('in bep Android');
            //                printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
            //                toaster.pop('success', "", 'Đã lưu hoá đơn thành công.');
            //            }

            //        }

            //        if ($scope.isSync) {
            //            //debugger;
            //            var currentTable = {};
            //            angular.copy($scope.tableIsSelected, currentTable);

            //            var currentTableOrder = [];
            //            currentTableOrder.push(currentTable);
            //            currentTableOrder[0].tableOrder = [];
            //            currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            //            var completeOrder = {
            //                "companyId": SunoGlobal.companyInfo.companyId,
            //                "storeId": $scope.currentStore.storeID,
            //                "clientId": SunoGlobal.userProfile.sessionId,
            //                "shiftId": null,//LSFactory.get('shiftId'),
            //                "startDate": "",
            //                "finishDate": "",
            //                "tables": angular.copy(currentTableOrder),
            //                "zone": $scope.tableMap,
            //                "info": {
            //                    action: "done",
            //                    deviceID: deviceID,
            //                    timestamp: genTimestamp(),
            //                    author: SunoGlobal.userProfile.userId,
            //                    isUngroupItem: $scope.isUngroupItem
            //                }
            //            }
            //            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            //            .then(function (data) {
            //                //debugger;
            //                var shiftId = null;
            //                if (data.docs.length > 0) {
            //                    shiftId = data.docs[0].shiftId;
            //                }

            //                completeOrder.shiftId = shiftId;

            //                //debugger;
            //                console.log('completeOrderData', completeOrder);
            //                completeOrder = angular.toJson(completeOrder);
            //                completeOrder = JSON.parse(completeOrder);
            //                if (isSocketConnected) {
            //                    socket.emit('completeOrder', completeOrder);
            //                }
            //            })
            //            .catch(function (error) {
            //                console.log(error);
            //            })

            //            if ($scope.printSetting.printSubmitOrder == false && !$scope.isWebView && (!$scope.printDevice || !$scope.printDevice.cashierPrinter.status)) {
            //                // nếu không phải trên trình duyệt + cho phép in thanh toán + cho phép in hộ thì mới gửi lệnh in hộ lên socket

            //                DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            //                .then(function (data) {
            //                    var shiftId = null;
            //                    if (data.docs.length > 0) {
            //                        shiftId = data.docs[0].shiftId;
            //                    }
            //                    var printHelperData = {
            //                        "companyId": SunoGlobal.companyInfo.companyId,
            //                        "storeId": $scope.currentStore.storeID,
            //                        "clientId": SunoGlobal.userProfile.sessionId,
            //                        "shiftId": shiftId, //LSFactory.get('shiftId'),
            //                        "printOrder": printOrder,
            //                        "printSetting": setting,
            //                        "orderType": "cashier",
            //                        "info": {
            //                            action: "print",
            //                            deviceID: deviceID,
            //                            timestamp: genTimestamp(),
            //                            author: SunoGlobal.userProfile.userId
            //                        }
            //                    }

            //                    printHelperData = angular.toJson(printHelperData);
            //                    printHelperData = JSON.parse(printHelperData);
            //                    if (isSocketConnected) {
            //                        socket.emit('printHelper', printHelperData);
            //                    }
            //                })
            //                .catch(function (error) {
            //                    console.log(error);
            //                })
            //            }
            //        }
            //        angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
            //        var tableStatus = tableIsActive($scope.tableIsSelected);
            //        if (tableStatus == false) {
            //            $scope.tableIsSelected.tableStatus = 0;
            //        }
            //        $scope.cancelOrder();
            //    }
            //}, function (e) {
            //    toaster.pop('error', "", e.responseStatus.message);
            //}, true, 'submit-order');
        }
    }

    $scope.prePrint = function () {
        var printOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        printOrder.saleOrderCode = '';
        var setting = {
            companyInfo: $scope.userSession,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        if ($scope.isWebView) {
            var rs = printOrderInBrowser(printer, printOrder, 1, setting);
            if (rs) {
                audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
                toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
            } else {
                toaster.pop('error', "", 'Vui lòng kiểm tra lại mẫu in.');
            }
        } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
            // console.log('in bep truc tiep tren IOS');
            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
            audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
            toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
        } else if ($scope.isAndroid) {
            // console.log('in bep Android');
            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
            audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
            toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
        }
    }


    $scope.openPopOverSaleList = function (e) {
        $ionicPopover.fromTemplateUrl('user-in-store-list.html', {
            scope: $scope
        }).then(function (popover) {
            $scope.popoverSaleList = popover;
            $scope.popoverSaleList.show(e);
        });
    }

    $scope.changeSale = function (s) {
        $scope.currentSale = s;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.seller = s;
        $scope.popoverSaleList.hide();
    }

    $scope.addSubFee = function () {
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.IsSubFeePercent = false;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent = 0;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee = 0;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeeName = 'Phụ thu';
    }

    $scope.removeSubFee = function () {
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee = null;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeeName = null;

        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.IsSubFeePercent = null;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.SubFeeInPercent = null;
        calculateTotal($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
    }

    $scope.openModalPrintedList = function () {
        $ionicModal.fromTemplateUrl('printed-list.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modalPrintedList = modal;
            $scope.modalPrintedList.show();
        });
    }

    $scope.closeModalPrintedList = function () {
        $scope.modalPrintedList.hide();
    }

    $scope.openEditTablesModal = function () {
        if ($scope.tableMap.length > 0) {
            if ($scope.popoverSettings) $scope.popoverSettings.hide();
            $scope.newTableMap = [];
            $scope.newTables = [];
            $scope.newTableMapTemp = [];
            $scope.newTableTemp = [];
            angular.copy($scope.tableMap, $scope.newTableMap);
            angular.copy($scope.tables, $scope.newTables);
            angular.copy($scope.tableMap, $scope.newTableMapTemp);
            angular.copy($scope.tables, $scope.newTableTemp);
            for (var x = 0; x < $scope.newTableMapTemp.length; x++) {
                $scope.newTableMap[x].unit2 = $scope.newTableMap[x].unit == 'Phòng' ? true : false;
                $scope.newTableMap[x].isUpdating = false;
                $scope.newTableMapTemp[x].unit2 = $scope.newTableMapTemp[x].unit == 'Phòng' ? true : false;
                $scope.newTableMapTemp[x].isUpdating = false;
            }

            $ionicModal.fromTemplateUrl('edit-tables.html', {
                scope: $scope,
                animation: 'slide-in-up',
                backdropClickToClose: false
            }).then(function (modal) {
                $scope.modalEditTables = modal;
                $scope.modalEditTables.show();
            });
        }
        else {
            $scope.modalCreateTables.show();
            if ($scope.popoverSettings) $scope.popoverSettings.hide();
        }
    }

    $scope.closeModalEditTables = function () {
        //$scope.modalEditTables.hide();
        $scope.updateTable();
    }

    //Kiểm tra đã lưu chưa và xác nhận ở màn hình Edit
    $scope.checkConfirmCloseEditModal = function () {
        if ($scope.newTableMap.length == $scope.tableMap.length) {
            var same = true;
            for (var x = 0; x < $scope.newTableMap.length; x++) {
                if ($scope.newTableMap[x].quantity != $scope.tableMap[x].quantity
                    || $scope.newTableMap[x].unit != $scope.tableMap[x].unit
                    || $scope.newTableMap[x].zone != $scope.tableMap[x].zone) {
                    same = false;
                }
            }
            if (same) {
                $scope.modalEditTables.hide();
                return;
            }
        }
    }

    //Kiểm tra đã lưu chưa và xác nhận ở màn hình Create
    $scope.checkConfirmCloseCreateModal = function () {
        //Trường hợp mảng tạm và mảng chỉnh bằng nhau.
        if ($scope.tableMap.length == $scope.tableMapTemp.length) {

        }
            //Trường hợp mảng tạm và mảng chính ko bằng nhau.
        else {
            console.log('Create - 2 arrays length are not same');
        }
    }

    $scope.editTableZoneEditTablesModal = function (index) {
        $scope.showEditTable = true;
        $scope.selectedZone = $scope.newTableMap[index];
        ($scope.selectedZone.unit == 'Bàn') ? $scope.selectedZone.toogle = false : $scope.selectedZone.toogle = true;
    }

    $scope.removeTableZoneEditTablesModal = function (index) {
        $scope.newTableMap.splice(index, 1);
        $scope.newTableMapTemp.splice(index, 1);
    }

    $scope.createTableZoneEditModal = function (z, q, u) {
        if (z == null
            || z.trim() == ''
            || q == null
            || !isValidTableQuantity(q)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        if (!q) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.newTableMap.length,
            zone: z ? z : '',
            quantity: q,
            unit: u ? 'Phòng' : 'Bàn',
            isUpdating: false,
            unit2: u
        }
        $scope.modalEditTables.zone = null;
        $scope.modalEditTables.quantity = null;
        $scope.newTableMap.push(t);
        $scope.newTableMapTemp.push(angular.copy(t));
    }

    $scope.updateTable = function () {
        if ($scope.newTableMap.length > 0) {
            if ($scope.newTableMap.length == $scope.tableMap.length) {
                var same = true;
                for (var x = 0; x < $scope.newTableMap.length; x++) {
                    if ($scope.newTableMap[x].quantity != $scope.tableMap[x].quantity
                        || $scope.newTableMap[x].unit != $scope.tableMap[x].unit
                        || $scope.newTableMap[x].zone != $scope.tableMap[x].zone) {
                        same = false;
                    }
                }
                if (same) {
                    $scope.modalEditTables.hide();
                    return;
                }
            }
            $scope.newTables = [];
            $scope.count = 1;
            var tableTAW = {
                tableUuid: uuid.v1(),
                tableId: 0,
                tableIdInZone: 0,
                tableName: 'Mang về',
                tableZone: {},
                tableStatus: 0,
                tableOrder: [{
                    saleOrder: {
                        //revision: 0,
                        orderDetails: []
                    }
                }]
            }
            angular.copy(saleOrder, tableTAW.tableOrder[0].saleOrder);
            $scope.newTables.push(tableTAW);

            for (var x = 0; x < $scope.newTableMap.length; x++) {
                if ($scope.newTableMap[x].hasOwnProperty('unit2')) {
                    delete $scope.newTableMap[x].unit2;
                }
                if ($scope.newTableMap[x].hasOwnProperty('isUpdating')) {
                    delete $scope.newTableMap[x].isUpdating;
                }
            }

            for (var i = 0; i < $scope.newTableMap.length; i++) {
                for (var j = 0; j < $scope.newTableMap[i].quantity; j++) {
                    var count = j + 1;
                    var t = {
                        tableUuid: uuid.v1(),
                        tableId: $scope.count++,
                        tableIdInZone: count,
                        tableName: $scope.newTableMap[i].unit + ' ' + count + ' - ' + $scope.newTableMap[i].zone,
                        tableZone: $scope.newTableMap[i],
                        tableStatus: 0,
                        tableOrder: [{
                            saleOrder: {
                                //revision: 0,
                                orderDetails: []
                            }
                        }]
                    }
                    angular.copy(saleOrder, t.tableOrder[0].saleOrder);
                    $scope.newTables.push(t);
                }
            }

            $scope.newTablesSetting = [];
            angular.copy($scope.tablesSetting, $scope.newTablesSetting);

            var storeIndex = findIndex($scope.newTablesSetting, 'storeId', $scope.currentStore.storeID);

            if (storeIndex != null) {
                $scope.newTablesSetting[storeIndex] = {
                    storeId: $scope.currentStore.storeID,
                    tables: $scope.newTables,
                    zone: $scope.newTableMap
                }
            } else {
                $scope.newTablesSetting.push({
                    storeId: $scope.currentStore.storeID,
                    tables: $scope.newTables,
                    zone: $scope.newTableMap
                });
            }

            //// console.log($scope.newTablesSetting);
            //var data = {
            //    "key": "tableSetting",
            //    "value": JSON.stringify($scope.newTablesSetting),
            //    "extConfig": {
            //        db: DBSettings,
            //        token: $scope.token
            //    }
            //}
            //console.log(data);
            //var url = Api.postKeyValue;

            //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
            //    if (data) {
            //        toaster.pop('success', "Đã lưu sơ đồ bàn thành công!", 'Sơ đồ bàn sẽ được cập nhật sau khi bạn thực hiện kết ca cuối ngày.');
            //        $scope.endSession();
            //    }
            //}, function (error) {
            //    console.log(error)
            //    }, true, 'tableSetting');

            var url = Api.postKeyValue;
            var method = 'POST';
            var data = {
                "key": "tableSetting",
                "value": JSON.stringify($scope.newTablesSetting)
            };
            $SunoRequest.makeRestful(url, method, data)
                .then(function (data) {
                    toaster.pop('success', "Đã lưu sơ đồ bàn thành công!", 'Sơ đồ bàn sẽ được cập nhật sau khi bạn thực hiện kết ca cuối ngày.');
                    $scope.endSession();
                })
                .catch(function (e) {
                    console.log(e);
                });

            if ($scope.modalEditTables) $scope.modalEditTables.hide();

        } else {
            //console.log('tableMap', $scope.tableMap);
            //console.log('newTableMap', $scope.newTableMap);
            if ($scope.tableMap.length == 0) {
                $scope.modalEditTables.hide();
            }
            else {
                $scope.deleteTable();
            }
            //$scope.deleteTable();
            //toaster.pop('warning', "", 'Vui lòng nhập thông tin sơ đồ bàn!');
        }
    }

    $scope.deleteTable = function () {
        //var data = {
        //    "key": "tableSetting",
        //    "value": "",
        //    "extConfig": {
        //        db: DBSettings,
        //        token: $scope.token
        //    }
        //}

        //var url = Api.postKeyValue;

        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
        //    if (data) {
        //        toaster.pop('success', "Đã lưu sơ đồ bàn thành công!", 'Sơ đồ bàn sẽ được cập nhật sau khi bạn thực hiện kết ca cuối ngày.');
        //        if ($scope.modalEditTables) $scope.modalEditTables.hide();
        //        $scope.endSession();
        //    }
        //}, function (error) {
        //    console.log(error)
        //}, true, 'tableSetting');

        var url = Api.postKeyValue;
        var method = 'POST';
        var data = {
            "key": "tableSetting",
            "value": ""
        };
        $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                toaster.pop('success', "Đã lưu sơ đồ bàn thành công!", 'Sơ đồ bàn sẽ được cập nhật sau khi bạn thực hiện kết ca cuối ngày.');
                if ($scope.modalEditTables) $scope.modalEditTables.hide();
                $scope.endSession();
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    $scope.showSyncSetting = function () {
        $scope.popoverSettings.hide();
        $ionicModal.fromTemplateUrl('sync-setting.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalSyncSetting = modal;
            $scope.modalSyncSetting.show();
        });
    }

    $scope.closeSyncSetting = function () {
        $scope.modalSyncSetting.hide();
    }

    $scope.showSetting = function () {
        $scope.popoverSettings.hide();
        $scope.choice = $scope.removeSetting;
        $ionicModal.fromTemplateUrl('print-setting.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalPrintSetting = modal;

            if ($scope.permissionIndex < 0 && !$scope.isWebView) {
                // nếu là nhân viên và đang ở web thì config là
                $scope.tabPrintSetting = 2;
            } else {
                $scope.tabPrintSetting = 1;
            }

            $scope.modalPrintSetting.show();
        });
    }

    $scope.closeSetting = function () {
        $scope.modalPrintSetting.hide();
    }

    $scope.savePrintSetting = function (setting, printHelper) {
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc lưu thiết lập in, bạn phải thực hiện <b>KẾT CA</b> cuối ngày, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể nên thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) {
                    }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {
                        if (printHelper) {
                            DBSettings.$getDocByID({ _id: 'printHelper' })
                                .then(function (data) {
                                    if (data.docs.length > 0) {
                                        DBSettings.$addDoc({ _id: 'printHelper', printHelper: data.docs[0].printHelper, _rev: data.docs[0]._rev })
                                            .catch(function (error) {
                                                console.log(error);
                                            });
                                    }
                                    else {
                                        DBSettings.$addDoc({ _id: 'printHelper', printHelper: data.docs[0].printHelper })
                                            .catch(function (error) {
                                                console.log(error);
                                            });
                                    }
                                })
                            $scope.printHelper = printHelper;
                            //window.localStorage.setItem('printHelper', JSON.stringify(printHelper));
                            //$scope.printHelper = printHelper;
                        }

                        if ($scope.permissionIndex >= 0) {
                            var s = {
                                'printSubmitOrder': setting && setting.printSubmitOrder ? setting.printSubmitOrder : false,
                                'printNoticeKitchen': setting && setting.printNoticeKitchen ? setting.printNoticeKitchen : false,
                                'prePrint': setting && setting.prePrint ? setting.prePrint : false,
                                'unGroupItem': setting && setting.unGroupItem ? setting.unGroupItem : false,
                                'unGroupBarKitchen': setting && setting.unGroupBarKitchen ? setting.unGroupBarKitchen : false,
                                'noticeByStamps': setting && setting.noticeByStamps ? setting.noticeByStamps : false
                            };

                            var url = Api.postKeyValue;
                            var method = 'POST';
                            var d = {
                                "key": "printSetting",
                                "value": JSON.stringify(s)
                            }
                            $SunoRequest.makeRestful(url, method, d)
                                .then(function (data) {
                                    Promise.all([
                                        DBTables.$queryDoc({
                                            selector: {
                                                'store': { $eq: $scope.currentStore.storeID }
                                            },
                                        }),
                                        DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                    ])
                                        .then(function (data) {
                                            data[0].docs.forEach(function (d) { d._deleted = true; });
                                            return DBTables.$manipulateBatchDoc(data[0].docs);
                                        })
                                        .then(function (data) {
                                            ////debugger;
                                            $scope.updateBalance(0);
                                            audit(5, 'Kết ca cuối ngày', '');
                                            if ($scope.modalStoreReport) $scope.modalStoreReport.hide();

                                            // $state.reload();
                                            toaster.pop('success', "", 'Đã hoàn thành kết ca cuối ngày!');
                                            if (!$scope.isSync) {
                                                window.location.reload(true);
                                            }
                                            else {
                                                DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                                    .then(function (data) {
                                                        ////debugger;
                                                        var shiftId = null;
                                                        if (data.docs.length > 0) {
                                                            shiftId = data.docs[0].shiftId;
                                                            //DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                                            //.then(function (data) {
                                                            //    //console.log(data)
                                                            //    //log for debugging.
                                                            //})
                                                            ////.catch(function (error) { throw error }); //throw error to outer catch 
                                                        }
                                                        var completeShift = {
                                                            "companyId": SunoGlobal.companyInfo.companyId,
                                                            "storeId": $scope.currentStore.storeID,
                                                            "clientId": SunoGlobal.userProfile.sessionId,
                                                            "shiftId": shiftId, //LSFactory.get('shiftId')
                                                            "info": {
                                                                action: "completeShift",
                                                                deviceID: deviceID,
                                                                timestamp: genTimestamp(),
                                                                author: SunoGlobal.userProfile.userId,
                                                                isUngroupItem: $scope.isUngroupItem
                                                            }
                                                        }

                                                        completeShift = angular.toJson(completeShift);
                                                        completeShift = JSON.parse(completeShift);
                                                        console.log('dataCompleteShift', completeShift);
                                                        socket.emit('completeShift', completeShift);
                                                    });
                                            }
                                        })
                                        .catch(function (error) {
                                            console.log(error);
                                        });
                                    $scope.modalPrintSetting.hide();
                                })
                                .catch(function (e) {
                                    console.log(e);
                                });
                            //var data = {
                            //    "key": "printSetting",
                            //    "value": JSON.stringify(s),
                            //    "extConfig": {
                            //        db: DBSettings,
                            //        token: $scope.token
                            //    }
                            //}

                            //var url = Api.postKeyValue;

                            //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
                            //    if (data) {
                            //        //if ($scope.isUngroupItem == $scope.printSetting.unGroupItem) {
                            //        //    toaster.pop('success', "", 'Đã lưu thiết lập in cho cửa hàng!');
                            //        //}
                            //        //else {
                            //        //    $ionicPopup.alert({ title: 'Thông báo', template: '<p style="text-align: center;">Đã lưu thiết lập in cho cửa hàng, vui lòng thực hiện việc <b>Kết ca</b> và khởi động lại ứng dụng để áp dụng cấu hình mới!</p>' });
                            //        //}
                            //        Promise.all([
                            //            DBTables.$queryDoc({
                            //                selector: {
                            //                    'store': { $eq: $scope.currentStore.storeID }
                            //                },
                            //            }),
                            //            DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                            //        ])
                            //            .then(function (data) {
                            //                data[0].docs.forEach(function (d) { d._deleted = true; });
                            //                return DBTables.$manipulateBatchDoc(data[0].docs);
                            //            })
                            //            .then(function (data) {
                            //                ////debugger;
                            //                $scope.updateBalance(0);
                            //                audit(5, 'Kết ca cuối ngày', '');
                            //                if ($scope.modalStoreReport) $scope.modalStoreReport.hide();

                            //                // $state.reload();
                            //                toaster.pop('success', "", 'Đã hoàn thành kết ca cuối ngày!');
                            //                if (!$scope.isSync) {
                            //                    window.location.reload(true);
                            //                }
                            //                else {
                            //                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                            //                        .then(function (data) {
                            //                            ////debugger;
                            //                            var shiftId = null;
                            //                            if (data.docs.length > 0) {
                            //                                shiftId = data.docs[0].shiftId;
                            //                                //DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                            //                                //.then(function (data) {
                            //                                //    //console.log(data)
                            //                                //    //log for debugging.
                            //                                //})
                            //                                ////.catch(function (error) { throw error }); //throw error to outer catch 
                            //                            }
                            //                            var completeShift = {
                            //                                "companyId": SunoGlobal.companyInfo.companyId,
                            //                                "storeId": $scope.currentStore.storeID,
                            //                                "clientId": SunoGlobal.userProfile.sessionId,
                            //                                "shiftId": shiftId, //LSFactory.get('shiftId')
                            //                                "info": {
                            //                                    action: "completeShift",
                            //                                    deviceID: deviceID,
                            //                                    timestamp: genTimestamp(),
                            //                                    author: SunoGlobal.userProfile.userId,
                            //                                    isUngroupItem: $scope.isUngroupItem
                            //                                }
                            //                            }

                            //                            completeShift = angular.toJson(completeShift);
                            //                            completeShift = JSON.parse(completeShift);
                            //                            console.log('dataCompleteShift', completeShift);
                            //                            socket.emit('completeShift', completeShift);
                            //                        });
                            //                }
                            //            })
                            //            .catch(function (error) {
                            //                console.log(error);
                            //            });
                            //        $scope.modalPrintSetting.hide();
                            //    }
                            //}, function (error) {
                            //    console.log(error)
                            //}, true, 'savePrintSetting');
                        } else {
                            toaster.pop('success', "", 'Đã lưu thiết lập in cho cửa hàng!');
                            return $scope.modalPrintSetting.hide();
                        }
                    }
                }
            ]
        });
    }

    // angular.copy($scope.removeSetting,$scope.choice);
    $scope.openRemoveItemSettingModal = function () {
        $scope.popoverSettings.hide();
        $scope.choice = $scope.removeSetting;
        $ionicModal.fromTemplateUrl('remove-item-setting.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalRemoveItemSetting = modal;
            $scope.modalRemoveItemSetting.show();
        });
    }

    $scope.closeRemoveItemSettingModal = function () {
        $scope.modalRemoveItemSetting.hide();
    }

    $scope.saveRemoveItemSetting = function (choice) {
        //var data = {
        //    "key": "removeItemSetting",
        //    "value": JSON.stringify(choice),
        //    "extConfig": {
        //        db: DBSettings,
        //        token: $scope.token
        //    }
        //}

        //var url = Api.postKeyValue;

        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
        //    if (data) {
        //        toaster.pop('success', "", 'Đã lưu thiết lập điều kiện huỷ món thành công!');
        //    }
        //}, function (error) {
        //    console.log(error)
        //}, true, 'setKeyValue');

        var url = Api.postKeyValue;
        var method = 'POST';
        var d = {
            "key": "removeItemSetting",
            "value": JSON.stringify(choice)
        };
        $SunoRequest.makeRestful(url, method, d)
        .then(function (data) {
            toaster.pop('success', "", 'Đã lưu thiết lập điều kiện huỷ món thành công!');
        })
        .catch(function (e) {
            console.log(e);
        });

        $scope.closeSetting();
    }

    $scope.savePrinterInfo = function (printDevice) {
        if (printDevice) {
            if ((printDevice.kitchenPrinter && printDevice.kitchenPrinter.status && printDevice.kitchenPrinter.ip == null) || (printDevice.cashierPrinter && printDevice.cashierPrinter.status && printDevice.cashierPrinter.ip == null)) {
                return toaster.pop('warning', "", 'Bạn chưa thiết lập địa chỉ máy in');
            }
            //window.localStorage.setItem('printDevice', JSON.stringify(printDevice));
            DBSettings.$getDocByID({ _id: 'printDevice' })
            .then(function (data) {
                if (data.docs.length > 0) {
                    DBSettings.$addDoc({ _id: 'printDevice', printDevice: printDevice, _rev: data.docs[0]._rev })
                    .catch(function (error) {
                        console.log(error);
                    });
                }
                else {
                    DBSettings.$addDoc({ _id: 'printDevice', printDevice: printDevice })
                    .catch(function (error) {
                        console.log(error);
                    });
                }
            });
            $scope.printDevice = printDevice;
            toaster.pop('success', "", 'Đã lưu thông tin máy in thành công!');
            $scope.closeSetting();
            //$scope.printDevice = printDevice;
            //toaster.pop('success', "", 'Đã lưu thông tin máy in thành công!');
            //$scope.closeSetting();
        }
    }

    $scope.showReportDetails = function (order) {
        if (order.isCollapse) {
            //Open
            order.isCollapse = false;
            if (order.details.length == 0) {
                ////Call API to get Details Of Order
                //var url = ApiUrl + 'sale/order?saleOrderId=' + order.id;
                //var data = { extConfig: { db: DBSettings, token: $scope.token } };
                //asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data) {
                //    if (data) {
                //        order.details = data.saleOrder.orderDetails;
                //    }
                //}, function (error) {
                //    toaster.pop('error', "", 'Lấy thông tin về chi tiết đơn hàng không thành công! Vui lòng thử lại');
                //    });

                var url = ApiUrl + 'sale/order?saleOrderId=' + order.id;
                var method = 'GET';
                var d = null;
                $SunoRequest.makeRestful(url, method, data)
                    .then(function (data) {
                        order.details = data.saleOrder.orderDetails;
                        $scope.$apply();
                    })
                    .catch(function (e) {
                        toaster.pop('error', "", 'Lấy thông tin về chi tiết đơn hàng không thành công! Vui lòng thử lại');
                    });
            }
        }
        else {
            //Collapse
            order.isCollapse = true;
        }
    };

    //$scope.getStoreReport = function (from, to) {
    //    $scope.currentUserReport = null;
    //    if ($scope.popoverStaffList) $scope.popoverStaffList.hide();
    //    if (typeof from == 'undefined') from = null;
    //    if (typeof to == 'undefined') to = null;

    //    var deferred = $q.defer();
    //    var curr = new Date();
    //    var fromDate = from ? from.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0).toJSON();
    //    var toDate = to ? to.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59, 0).toJSON();
    //    var url = Api.storeReport + 'limit=10000&fromDate=' + fromDate + '&toDate=' + toDate;
    //    //$scope.token.token = '123123123123';
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            $scope.reports = data;
    //            for (var x = 0; x < data.storeSales.length; x++) {
    //                var item = $scope.reports.storeSales[x];
    //                item.isCollapse = true;
    //                item.details = [];
    //            };
    //            // console.log(data.storeSales,$scope.currentStore.storeID,$filter('filter')($scope.reports.storeSales,{'storeId' : $scope.currentStore.storeID}));
    //            $scope.reports.storeSales = $filter('filter')($scope.reports.storeSales, { 'storeId': $scope.currentStore.storeID });
    //            $scope.reports.storeExpenses = $filter('filter')($scope.reports.storeExpenses, { 'storeId': $scope.currentStore.storeID });
    //            $scope.reports.storePaidDebts = $filter('filter')($scope.reports.storePaidDebts, { 'storeId': $scope.currentStore.storeID });

    //            filterReportByStore($scope.reports);
    //            if ($scope.permissionIndex < 0) $scope.filterBySale($scope.userSession);
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        //console.log(error);
    //        deferred.reject(error);
    //    }, true, 'storeReport');
    //    return deferred.promise;
    //}

    $scope.getStoreReport = function (from, to) {
        $scope.currentUserReport = null;
        if ($scope.popoverStaffList) $scope.popoverStaffList.hide();
        if (typeof from == 'undefined') from = null;
        if (typeof to == 'undefined') to = null;

        var curr = new Date();
        var fromDate = from ? from.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0).toJSON();
        var toDate = to ? to.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59, 0).toJSON();
        var url = Api.storeReport + 'limit=10000&fromDate=' + fromDate + '&toDate=' + toDate;
        var method = 'GET';
        var d = null;
        return $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                $scope.reports = data;
                for (var x = 0; x < data.storeSales.length; x++) {
                    var item = $scope.reports.storeSales[x];
                    item.isCollapse = true;
                    item.details = [];
                };
                // console.log(data.storeSales,$scope.currentStore.storeID,$filter('filter')($scope.reports.storeSales,{'storeId' : $scope.currentStore.storeID}));
                $scope.reports.storeSales = $filter('filter')($scope.reports.storeSales, { 'storeId': $scope.currentStore.storeID });
                $scope.reports.storeExpenses = $filter('filter')($scope.reports.storeExpenses, { 'storeId': $scope.currentStore.storeID });
                $scope.reports.storePaidDebts = $filter('filter')($scope.reports.storePaidDebts, { 'storeId': $scope.currentStore.storeID });

                filterReportByStore($scope.reports);
                if ($scope.permissionIndex < 0) $scope.filterBySale($scope.userSession);
                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                return e;
            });
    }

    //$scope.getBalance = function () {
    //    var deferred = $q.defer();
    //    var url = Api.getKeyValue + 'getBalance=' + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            if (data.value != "") {
    //                var rs = JSON.parse(data.value);
    //                $scope.balance = rs;
    //                // console.log(rs);
    //            } else {
    //                $scope.balance = 0;
    //            }
    //            deferred.resolve();
    //        }
    //    }, function (error) {
    //        console.log(error);
    //        error.where = "getBalance";
    //        deferred.reject(error);
    //    }, true, 'getBalance');
    //    return deferred.promise;
    //}

    $scope.getBalance = function () {
        var url = Api.getKeyValue + 'getBalance=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if (data.value != "") {
                    var rs = JSON.parse(data.value);
                    $scope.balance = rs;
                    $scope.$apply();
                    // console.log(rs);
                } else {
                    $scope.balance = 0;
                }
                return null;
            })
            .catch(function (e) {
                return e;
            });
    }



    $scope.openStoreReport = function () {
        $scope.popoverSettings.hide();

        $ionicModal.fromTemplateUrl('store-report.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            var curr = new Date();
            $scope.modalStoreReport = modal;
            $scope.modalStoreReport.fromDate = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0);
            $scope.modalStoreReport.toDate = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59, 0);
            return $scope.getStoreReport();
        })
        .then(function () {
            return $scope.getBalance();
        })
        .then(function () {
            $scope.modalStoreReport.show();
            $scope.paymentMethod = { val: "1" };
            $scope.selectPaymentMethod($scope.paymentMethod);
            $scope.totalCash($scope.paymentMethod);
        })
        .catch(function (error) {
            console.log(error);
        });
    }

    $scope.renewStoreReport = function (from, to) {
        $scope.getStoreReport(from, to)
        .then(function () {
            return $scope.getBalance();
        })
        .then(function () {
            $scope.modalStoreReport.show();
            $scope.paymentMethod = { val: "1" };
            $scope.selectPaymentMethod($scope.paymentMethod);
            $scope.totalCash($scope.paymentMethod);
        })
        .catch(function (error) { console.log(error); });
    }

    $scope.closeStoreReport = function () {
        $scope.modalStoreReport.hide();
    }

    $scope.viewChangeBalance = false;
    $scope.changeBalace = function () {
        $scope.viewChangeBalance = true;
    }

    //$scope.updateBalance = function (balance) {
    //    $scope.viewChangeBalance = false;

    //    var data = {
    //        "key": "getBalance=" + $scope.currentStore.storeID,
    //        "value": JSON.stringify(balance),
    //        "extConfig": {
    //            db: DBSettings,
    //            token: $scope.token
    //        }
    //    }

    //    var url = Api.postKeyValue;

    //    asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            if ($scope.modalStoreReport) {
    //                $scope.modalStoreReport.hide();
    //            }
    //            toaster.pop('success', "", 'Đã cập nhật tồn quỹ đầu ca!');
    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'setBalance');
    //}

    $scope.updateBalance = function (balance) {
        $scope.viewChangeBalance = false;

        var url = Api.postKeyValue;
        var method = 'POST';
        var d = {
            "key": "getBalance=" + $scope.currentStore.storeID,
            "value": JSON.stringify(balance)
        }
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if ($scope.modalStoreReport) {
                    $scope.modalStoreReport.hide();
                }
                toaster.pop('success', "", 'Đã cập nhật tồn quỹ đầu ca!');
            })
            .catch(function (e) {
                console.log(e);
            });
        //asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
        //    if (data) {
        //        if ($scope.modalStoreReport) {
        //            $scope.modalStoreReport.hide();
        //        }
        //        toaster.pop('success', "", 'Đã cập nhật tồn quỹ đầu ca!');
        //    }
        //}, function (error) {
        //    console.log(error)
        //}, true, 'setBalance');
    }


    $scope.openPopOverStaffList = function (e) {
        $ionicPopover.fromTemplateUrl('staff-list.html', {
            scope: $scope
        }).then(function (popover) {
            $scope.popoverStaffList = popover;
            $scope.popoverStaffList.show(e);
        });
    }

    $scope.checkUserInStore = function (s) {
        var storeIndex = findIndex(s.userInStores, 'value', $scope.currentStore.storeID);
        if (storeIndex != null) {
            return true;
        }
        return false;
    }

    $scope.filterBySale = function (s) {
        $scope.currentUserReport = s;
        // $scope.cashier = {
        //   sellerId : s.userId
        // }
        if (s) {
            var saleCount = 0;
            var saleTotal = 0;
            var cashTotal = 0;
            var cardTotal = 0;
            var debtTotal = 0;
            var discountTotal = 0;
            var subFeeTotal = 0;
            var totalExpense = 0;
            var totalPaidDebt = 0;
            var totalExpenseCash = 0;
            var totalPaidDebtCash = 0;

            for (var i = 0; i < $scope.reports.storeSales.length; i++) {
                var item = $scope.reports.storeSales[i];
                if (item.userId == s.userId) {
                    saleCount++;
                    saleTotal += item.total;
                    cashTotal += item.cashTotal;
                    cardTotal += item.cardTotal;
                    debtTotal += item.debtTotal;
                    discountTotal += item.discount;
                    subFeeTotal += item.subFee;
                }
            }

            for (var i = 0; i < $scope.reports.storeExpenses.length; i++) {
                var item = $scope.reports.storeExpenses[i];
                if (item.userId == s.userId) {
                    totalExpense += item.payment;
                    if (item.paymentMethodId == 1) totalExpenseCash += item.payment;
                }
            }

            for (var i = 0; i < $scope.reports.storePaidDebts.length; i++) {
                var item = $scope.reports.storePaidDebts[i];
                if (item.userId == s.userId) {
                    totalPaidDebt += item.amount;
                    if (item.paymentMethodId == 1) totalPaidDebtCash += item.amount;
                }
            }

            $scope.reports.totalPaidDebtCash = totalPaidDebtCash;
            $scope.reports.totalPaidDebt = totalPaidDebt;
            $scope.reports.totalExpense = totalExpense;
            $scope.reports.totalExpenseCash = totalExpenseCash;
            $scope.reports.saleCount = saleCount;
            $scope.reports.saleTotal = saleTotal;
            $scope.reports.cashTotal = cashTotal;
            $scope.reports.cardTotal = cardTotal;
            $scope.reports.debtTotal = debtTotal;
            $scope.reports.discountTotal = discountTotal;
            $scope.reports.subFeeTotal = subFeeTotal;
        }
        if ($scope.popoverStaffList) $scope.popoverStaffList.hide();
    }

    $scope.closeRemoveItemSetting = function () {
        $scope.modalRemoveItemSetting.hide();
    }

    $scope.endSession = function () {
        if (!isSocketConnected && $scope.isSync) {
            return toaster.pop({
                type: 'error',
                title: 'Thông báo',
                body: 'Đã mất kết nối internet. Vui lòng kết nối Internet và thực hiện lại thao tác kết ca.',
                timeout: 10000
            });
        }
        $ionicPopup.show({
            title: 'Kết ca cuối ngày',
            subTitle: 'Tất cả thông tin hóa đơn sẽ được xóa hết và tồn quỹ đầu ca sẽ được thiết lập về 0.',
            scope: $scope,
            buttons: [{
                text: 'Trở lại'
            }, {
                text: '<b>Xác nhận</b>',
                type: 'button-positive',
                onTap: function (e) {
                    //window.localStorage.removeItem($scope.currentStore.storeID);
                    Promise.all([
                        DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID }
                            },
                        }),
                        DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                    ])
                    .then(function (data) {
                        data[0].docs.forEach(function (d) { d._deleted = true; });
                        return DBTables.$manipulateBatchDoc(data[0].docs);
                    })
                    .then(function (data) {
                        ////debugger;
                        $scope.updateBalance(0);
                        audit(5, 'Kết ca cuối ngày', '');
                        if ($scope.modalStoreReport) $scope.modalStoreReport.hide();

                        // $state.reload();
                        toaster.pop('success', "", 'Đã hoàn thành kết ca cuối ngày!');
                        if (!$scope.isSync) {
                            window.location.reload(true);
                        }
                        else {
                            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                            .then(function (data) {
                                ////debugger;
                                var shiftId = null;
                                if (data.docs.length > 0) {
                                    shiftId = data.docs[0].shiftId;
                                    //DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                    //.then(function (data) {
                                    //    //console.log(data)
                                    //    //log for debugging.
                                    //})
                                    ////.catch(function (error) { throw error }); //throw error to outer catch 
                                }
                                var completeShift = {
                                    "companyId": SunoGlobal.companyInfo.companyId,
                                    "storeId": $scope.currentStore.storeID,
                                    "clientId": SunoGlobal.userProfile.sessionId,
                                    "shiftId": shiftId, //LSFactory.get('shiftId')
                                    "info": {
                                        action: "completeShift",
                                        deviceID: deviceID,
                                        timestamp: genTimestamp(),
                                        author: SunoGlobal.userProfile.userId,
                                        isUngroupItem: $scope.isUngroupItem
                                    }
                                }

                                completeShift = angular.toJson(completeShift);
                                completeShift = JSON.parse(completeShift);
                                console.log('dataCompleteShift', completeShift);
                                socket.emit('completeShift', completeShift);
                            });
                        }
                    })
                    .catch(function (error) {
                        console.log(error);
                    });

                    //if ($scope.isSync) {
                    //    DBSettings.$getDocByID({ _id: 'shiftId' })
                    //    .then(function (data) {
                    //        var shiftId = null;
                    //        if (data.docs.length > 0) {
                    //            shiftId = data.docs[0].shiftId;
                    //        }
                    //        var completeShift = {
                    //            "companyId": SunoGlobal.companyInfo.companyId,
                    //            "storeId": $scope.currentStore.storeID,
                    //            "clientId": SunoGlobal.userProfile.sessionId,
                    //            "shiftId": shiftId, //LSFactory.get('shiftId')
                    //        }

                    //        completeShift = angular.toJson(completeShift);
                    //        completeShift = JSON.parse(completeShift);
                    //        console.log('completeShift', completeShift);
                    //        socket.emit('completeShift', completeShift);
                    //    })
                    //    .catch(function (error) {
                    //        console.log(error);
                    //    });
                    //}

                }
            }]
        });
    }

    $scope.logout = function () {
        Promise.all([
            //DBSettings.$removeDoc({ _id: 'account' }),
            //DBSettings.$removeDoc({ _id: 'bootloader' }),
            //DBSettings.$removeDoc({ _id: 'setting' }),
            //DBSettings.$removeDoc({ _id: 'store' }),
            //DBSettings.$removeDoc({ _id: 'token' }),
            //DBSettings.$removeDoc({ _id: 'user' }),
            DBSettings.$removeDoc({ _id: 'SunoGlobal' }),
            DBSettings.$removeDoc({ _id: 'printDevice' }),
            DBSettings.$removeDoc({ _id: 'printHelper' })
        ]).then(function (data) {
            $scope.isLoggedIn = true;
            $scope.popoverSettings.hide();
            $rootScope.isNeedToReload = true;
            $state.go('login');
            $timeout(function () {
                $ionicHistory.clearCache();
            }, 200);
        })
    }

    //$scope.updateSyncSetting = function (isSync) {
    //    var data = {
    //        "key": "isSync",
    //        "value": JSON.stringify(isSync),
    //        "extConfig": {
    //            db: DBSettings,
    //            token: $scope.token
    //        }
    //    }

    //    var url = Api.postKeyValue;

    //    asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            var notification = isSync ? 'bật' : 'tắt';
    //            toaster.pop('success', "", 'Đã ' + notification + ' thiết lập đồng bộ.');

    //            if (isSync) {
    //                // Nếu bật đồng bộ, đi kiểm tra tableUuid 
    //                var count = 0;

    //                for (var i = 0; i < $scope.tables.length; i++) {
    //                    if (!$scope.tables[i].tableUuid) {
    //                        count++;
    //                    }
    //                }
    //                if (count > 0) {
    //                    $scope.newTableMap = [];
    //                    angular.copy($scope.tableMap, $scope.newTableMap);
    //                    $scope.updateTable();
    //                }

    //            } else {
    //                // Nếu tắt đồng bộ
    //                DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
    //                .then(function (data) {
    //                    var shiftId = null;
    //                    if (data.docs.length > 0) {
    //                        shiftId = data.docs[0].shiftId;
    //                    }
    //                    var completeShift = {
    //                        "companyId": SunoGlobal.companyInfo.companyId,
    //                        "storeId": $scope.currentStore.storeID,
    //                        "clientId": SunoGlobal.userProfile.sessionId,
    //                        "shiftId": shiftId, //LSFactory.get('shiftId')
    //                        "info": {
    //                            action: "completeShift",
    //                            deviceID: deviceID,
    //                            timestamp: genTimestamp(),
    //                            author: SunoGlobal.userProfile.userId
    //                        }
    //                    }

    //                    completeShift = angular.toJson(completeShift);
    //                    completeShift = JSON.parse(completeShift);
    //                    console.log('completeShift', completeShift);
    //                    socket.emit('completeShift', completeShift);
    //                })
    //                .catch(function (error) {
    //                    console.log(error);
    //                });

    //                Promise.all([
    //                    DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
    //                    DBTables.$queryDoc({
    //                        selector: {
    //                            'store': { $eq: $scope.currentStore.storeID }
    //                        },
    //                    })
    //                ])
    //                .then(function (data) {
    //                    data[1].docs.forEach(function (d) { d._deleted = true; });
    //                    returnDBTables.$manipulateBatchDoc(data[1].docs);
    //                })
    //                .catch(function (error) {
    //                    console.log(error);
    //                });
    //                //window.localStorage.removeItem($scope.currentStore.storeID);
    //                //window.localStorage.removeItem('shiftId');

    //            }
    //            if ($scope.modalSyncSetting) $scope.modalSyncSetting.hide();
    //            window.location.reload(true);
    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'isSync');
    //}

    $scope.updateSyncSetting = function (isSync) {
        var url = Api.postKeyValue;
        var method = 'POST';
        var d = {
            "key": "isSync",
            "value": JSON.stringify(isSync)
        }

        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                var notification = isSync ? 'bật' : 'tắt';
                toaster.pop('success', "", 'Đã ' + notification + ' thiết lập đồng bộ.');

                if (isSync) {
                    // Nếu bật đồng bộ, đi kiểm tra tableUuid 
                    var count = 0;

                    for (var i = 0; i < $scope.tables.length; i++) {
                        if (!$scope.tables[i].tableUuid) {
                            count++;
                        }
                    }
                    if (count > 0) {
                        $scope.newTableMap = [];
                        angular.copy($scope.tableMap, $scope.newTableMap);
                        $scope.updateTable();
                    }

                } else {
                    // Nếu tắt đồng bộ
                    DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                        .then(function (data) {
                            var shiftId = null;
                            if (data.docs.length > 0) {
                                shiftId = data.docs[0].shiftId;
                            }
                            var completeShift = {
                                "companyId": SunoGlobal.companyInfo.companyId,
                                "storeId": $scope.currentStore.storeID,
                                "clientId": SunoGlobal.userProfile.sessionId,
                                "shiftId": shiftId, //LSFactory.get('shiftId')
                                "info": {
                                    action: "completeShift",
                                    deviceID: deviceID,
                                    timestamp: genTimestamp(),
                                    author: SunoGlobal.userProfile.userId
                                }
                            }

                            completeShift = angular.toJson(completeShift);
                            completeShift = JSON.parse(completeShift);
                            console.log('completeShift', completeShift);
                            socket.emit('completeShift', completeShift);
                        })
                        .catch(function (error) {
                            console.log(error);
                        });

                    Promise.all([
                        DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
                        DBTables.$queryDoc({
                            selector: {
                                'store': { $eq: $scope.currentStore.storeID }
                            },
                        })
                    ])
                        .then(function (data) {
                            data[1].docs.forEach(function (d) { d._deleted = true; });
                            returnDBTables.$manipulateBatchDoc(data[1].docs);
                        })
                        .catch(function (error) {
                            console.log(error);
                        });
                    //window.localStorage.removeItem($scope.currentStore.storeID);
                    //window.localStorage.removeItem('shiftId');

                }
                $scope.$apply();
                if ($scope.modalSyncSetting) $scope.modalSyncSetting.hide();
                window.location.reload(true);
            })
            .catch(function (e) {
                console.log(e);
            });
    }


    $scope.stopCounter = function (item, $event) {

        var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;

        item.endTime = new Date().getTime();
        item.timeCounter = Math.abs(item.endTime - item.startTime);

        var roundBlock = Math.ceil(item.timeCounter / (60000 * $scope.blockCounter));
        var roundCount = roundBlock * $scope.blockCounter * 60000;

        var hourCount = Math.floor(roundCount / 3600000);
        var minusCount = roundCount % 3600000;
        minusCount = Math.floor(minusCount / 60000);

        var hour = Math.floor(item.timeCounter / 3600000);
        var minus = item.timeCounter % 3600000;
        minus = Math.floor(minus / 60000);

        item.duration = hour + ' giờ ' + minus + ' phút';
        item.blockCount = hourCount + ' giờ ' + minusCount + ' phút';
        // console.log(item.duration,item.blockCount);
        item.quantity = Math.ceil(item.timeCounter / (60000 * $scope.blockCounter)) * ($scope.blockCounter / 60);
        item.timer = false;
        item.subTotal = item.quantity * item.sellPrice;
        calculateTotal($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.payments[0].amount = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total;
        if ($scope.tables && $scope.tables.length > 0 && $scope.currentStore.storeID) {
            utils.debounce(updateSelectedTableToDB, 300, false)();
            //updateSelectedTableToDB();
            //LSFactory.set($scope.currentStore.storeID, {
            //    tables: $scope.tables,
            //    zone: $scope.tableMap
            //});
        }
        if ($scope.isSync) {
            var currentTable = {};
            angular.copy($scope.tableIsSelected, currentTable);

            var currentTableOrder = [];
            currentTableOrder.push(currentTable);
            currentTableOrder[0].tableOrder = [];
            currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": null,//LSFactory.get('shiftId'),
                "startDate": "",
                "finishDate": "",
                "tables": angular.copy(currentTableOrder),
                "zone": $scope.tableMap,
                "info": {
                    action: "stopTimer",
                    deviceID: deviceID,
                    timestamp: genTimestamp(),
                    author: SunoGlobal.userProfile.userId,
                    itemID: item.itemId
                }
            }
            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            .then(function (data) {
                var shiftId = null;
                if (data.docs.length > 0) {
                    shiftId = data.docs[0].shiftId;
                }
                updateData.shiftId = shiftId;
                updateData = angular.toJson(updateData);
                updateData = JSON.parse(updateData);
                if (isSocketConnected) {
                    console.log('updateData-stopTimer', updateData);
                    socket.emit('updateOrder', updateData);
                }
            })
            .catch(function (error) {
                console.log(error);
            });
        }

        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    };

    $scope.startCounter = function (item, $event) {
        if (!item.timer) {
            item.timer = true;
            if (!item.timeCounter) item.timeCounter = 0;
            if (!item.startTime) item.startTime = new Date().getTime();
        }
        if (item.startTime) {
            if ($scope.tables && $scope.tables.length > 0 && $scope.currentStore.storeID) {
                updateSelectedTableToDB();
                //LSFactory.set($scope.currentStore.storeID, {
                //    tables: $scope.tables,
                //    zone: $scope.tableMap
                //});
            }
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    };

    //$scope.search_product = function (key) {
    //    var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        $scope.searchProductList = data.items;

    //    }, function (status) { console.log(status) }, true, 'SearchProductItem');
    //}

    $scope.search_product = function (key) {
        var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                $scope.searchProductList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    $scope.change_search = function (key) {
        if (!key) $scope.searchProductList = null;
    }

    $scope.addServiceProduct = function (i) {

        if (!$scope.hourService.itemArr) $scope.hourService.itemArr = [];
        var indexItem = findIndex($scope.hourService.itemArr, 'itemId', i.itemId);
        if (indexItem != null) {
            return toaster.pop('warning', "", 'Đã có hàng hóa này trong danh sách hàng hóa tính tiền theo giờ!');
        } else {
            $scope.hourService.itemArr.push(i);
            $scope.searchProductList = null;

        }

    }

    $scope.addBarItem = function (i) {

        if (!$scope.BarItemSetting) $scope.BarItemSetting = [];
        var indexItem = findIndex($scope.BarItemSetting, 'itemId', i.itemId);
        if (indexItem != null) {
            return toaster.pop('warning', "", 'Đã có hàng hóa này trong danh sách in bar!');
        } else {
            $scope.BarItemSetting.push(i);
            $scope.searchProductList = null;
        }

    }

    $scope.removeBarItem = function (index) {
        $scope.BarItemSetting.splice(index, 1);
    }

    $scope.removeServiceProduct = function (index) {
        $scope.hourService.itemArr.splice(index, 1);
    }

    $scope.openCategories = function () {
        $scope.showCategoriesItem = true;
    }

    $scope.closeCategories = function () {
        $scope.showCategoriesItem = false;
    }

    //$scope.selectCategory = function (i) {
    //    var url = Api.productitems + 'categoryId=' + i.categoryID + '&limit=' + 1000 + '&pageIndex=' + 1 + '&storeId=' + $scope.currentStore.storeID;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            if (!$scope.BarItemSetting) $scope.BarItemSetting = [];
    //            for (var j = 0; j < data.items.length; j++) {
    //                var indexItem = findIndex($scope.BarItemSetting, 'itemId', data.items[j].itemId);
    //                if (indexItem != null) { } else {
    //                    $scope.BarItemSetting.push(data.items[j]);
    //                }
    //            }
    //        }
    //        $scope.closeCategories();
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'getProductItems');
    //}

    $scope.selectCategory = function (i) {
        var url = Api.productitems + 'categoryId=' + i.categoryID + '&limit=' + 1000 + '&pageIndex=' + 1 + '&storeId=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if (!$scope.BarItemSetting) $scope.BarItemSetting = [];
                for (var j = 0; j < data.items.length; j++) {
                    var indexItem = findIndex($scope.BarItemSetting, 'itemId', data.items[j].itemId);
                    if (indexItem != null) { } else {
                        $scope.BarItemSetting.push(data.items[j]);
                    }
                }
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    //$scope.saveBarItem = function () {
    //    var data = {
    //        "key": "BarItemSetting",
    //        "value": JSON.stringify($scope.BarItemSetting),
    //        "extConfig": {
    //            db: DBSettings,
    //            token: $scope.token
    //        }
    //    };

    //    var url = Api.postKeyValue;

    //    asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
    //        if (data) {
    //            toaster.pop('success', "", 'Đã lưu thiết lập in bar!');

    //        }
    //    }, function (error) {
    //        console.log(error)
    //    }, true, 'saveHourServiceSetting');
    //}

    $scope.saveBarItem = function () {
        var url = Api.postKeyValue;
        var method = 'POST';
        var data = {
            "key": "BarItemSetting",
            "value": JSON.stringify($scope.BarItemSetting)
        };
        $SunoRequest.makeRestful(url, method, data)
            .then(function (data) {
                toaster.pop('success', "", 'Đã lưu thiết lập in bar!');
            })
            .catch(function (e) {
                console.log(e);
            });
    }

    //$scope.saveServiceSetting = function (o) {
    //    if (o) {
    //        var data = {
    //            "key": "hourServiceSetting",
    //            "value": JSON.stringify(o),
    //            "extConfig": {
    //                db: DBSettings,
    //                token: $scope.token
    //            }
    //        }

    //        var url = Api.postKeyValue;

    //        asynRequest($state, $http, 'POST', url, $scope.token.token, 'json', data, function (data, status) {
    //            if (data) {
    //                $scope.hourService = o;
    //                if ($scope.hourService && $scope.hourService.isUse) {
    //                    switch ($scope.hourService.optionSelected) {
    //                        case "1":
    //                            $scope.blockCounter = 15;
    //                            break;
    //                        case "2":
    //                            $scope.blockCounter = 30;
    //                            break;
    //                        case "3":
    //                            $scope.blockCounter = 60;
    //                            break;
    //                        case "0":
    //                            $scope.blockCounter = $scope.hourService.customOption;
    //                            break;
    //                    }
    //                }
    //                toaster.pop('success', "", 'Đã lưu thiết lập dịch vụ tính giờ!');
    //                return $scope.closeSyncSetting();
    //            }
    //        }, function (error) {
    //            console.log(error)
    //        }, true, 'saveHourServiceSetting');
    //    }
    //}

    $scope.saveServiceSetting = function (o) {
        if (o) {
            var url = Api.postKeyValue;
            var method = 'POST';
            var d = {
                "key": "hourServiceSetting",
                "value": JSON.stringify(o)
            }
            $SunoRequest.makeRestful(url, method, d)
                .then(function (data) {
                    $scope.hourService = o;
                    if ($scope.hourService && $scope.hourService.isUse) {
                        switch ($scope.hourService.optionSelected) {
                            case "1":
                                $scope.blockCounter = 15;
                                break;
                            case "2":
                                $scope.blockCounter = 30;
                                break;
                            case "3":
                                $scope.blockCounter = 60;
                                break;
                            case "0":
                                $scope.blockCounter = $scope.hourService.customOption;
                                break;
                        }
                    }
                    toaster.pop('success', "", 'Đã lưu thiết lập dịch vụ tính giờ!');
                    $scope.$apply();
                    return $scope.closeSyncSetting();
                })
                .catch(function (e) {
                    console.log(e);
                });
        }
    }

    //$scope.rePrintOrder = function (o) {
    //    var url = Api.getOrderInfo + o.id;
    //    var data = { extConfig: { db: DBSettings, token: $scope.token } };
    //    asynRequest($state, $http, 'GET', url, $scope.token.token, 'json', data, function (data, status) {
    //        var printOrder = data.saleOrder;
    //        var setting = {
    //            companyInfo: $scope.companyInfo.companyInfo,
    //            allUsers: $scope.authBootloader.users,
    //            store: $scope.currentStore
    //        }
    //        if ($scope.isWebView) {
    //            var rs = printOrderInBrowser(printer, printOrder, 1, setting);
    //            if (rs) {
    //                toaster.pop('success', "", 'Đã in hoá đơn thành công.');
    //            } else {
    //                toaster.pop('error', "", 'Vui lòng kiểm tra lại mẫu in.');
    //            }
    //        } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
    //            // console.log('in bep truc tiep tren IOS');
    //            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
    //            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
    //            toaster.pop('success', "", 'Đã in hoá đơn thành công.');
    //        } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
    //            // console.log('in bep Android');
    //            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
    //            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
    //            toaster.pop('success', "", 'Đã in hoá đơn thành công.');
    //        }
    //        audit(5, 'In lại hóa đơn ' + printOrder.saleOrderCode + ', giá trị đơn hàng: ' + $filter('number')(printOrder.total, 0), '');
    //    }, function (status) { console.log(status) }, true, 'getOrderInfo');
    //}

    $scope.rePrintOrder = function (o) {
        var url = Api.getOrderInfo + o.id;
        var method = 'GET';
        var d = null;
        $SunoRequest.makeRestful(url, method, d)
            .then(function (data) {
                var printOrder = data.saleOrder;
                var setting = {
                    companyInfo: $scope.companyInfo.companyInfo,
                    allUsers: $scope.authBootloader.users,
                    store: $scope.currentStore
                }
                if ($scope.isWebView) {
                    var rs = printOrderInBrowser(printer, printOrder, 1, setting);
                    if (rs) {
                        toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                    } else {
                        toaster.pop('error', "", 'Vui lòng kiểm tra lại mẫu in.');
                    }
                } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
                    // console.log('in bep truc tiep tren IOS');
                    printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                    // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
                    toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
                    // console.log('in bep Android');
                    printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                    // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
                    toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                }
                audit(5, 'In lại hóa đơn ' + printOrder.saleOrderCode + ', giá trị đơn hàng: ' + $filter('number')(printOrder.total, 0), '');
                $scope.$apply();
            })
            .catch(function (e) {
                console.log(e);
            });
    }


    $scope.totalCash = function (method) {
        if (method == "0") {
            total = $scope.reports.saleTotal - $scope.reports.debtTotal;
            totalPaidDebt = $scope.reports.totalPaidDebt;
            totalExpense = $scope.reports.totalExpense;
        } else if (method == "1") {
            total = $scope.reports.cashTotal;
            totalPaidDebt = $scope.reports.totalPaidDebtCash;
            totalExpense = $scope.reports.totalExpenseCash;
        } else {
            total = $scope.reports.cardTotal;
            totalPaidDebt = $scope.reports.totalPaidDebt - $scope.reports.totalPaidDebtCash;
            totalExpense = $scope.reports.totalExpense - $scope.reports.totalExpenseCash;
        }
        return parseFloat(total) + parseFloat($scope.balance) + parseFloat(totalPaidDebt) - parseFloat(totalExpense);
    }

    $scope.selectPaymentMethod = function (method) {

        var total = 0;
        var totalPaidDebt = 0;
        var totalExpense = 0;
        var totalExpense = 0;
        var totalPaidDebt = 0;
        $scope.balance ? $scope.balance : 0;

        if (method.val == "0") {
            $scope.reports.paymentMethod = 'Tất cả';
            $scope.reports.total = $scope.reports.saleTotal - $scope.reports.debtTotal;
        } else if (method.val == "1") {
            $scope.reports.paymentMethod = 'Tiền mặt';
            $scope.reports.total = $scope.reports.cashTotal;
        } else {
            $scope.reports.paymentMethod = 'Thẻ';
            $scope.reports.total = $scope.reports.cardTotal;
        }

        for (var i = 0; i < $scope.reports.storeExpenses.length; i++) {
            var item = $scope.reports.storeExpenses[i];
            if (parseInt(method.val) == item.paymentMethodId || parseInt(method.val) == 0) {
                totalExpense += item.payment
            }
        }

        for (var i = 0; i < $scope.reports.storePaidDebts.length; i++) {
            var item = $scope.reports.storePaidDebts[i];
            if (parseInt(method.val) == item.paymentMethodId || parseInt(method.val) == 0) {
                totalPaidDebt += item.amount
            }
        }

        $scope.reports.totalPaidDebt = totalPaidDebt;
        $scope.reports.totalExpense = totalExpense;
        $scope.reports.totalCash = $scope.totalCash(method.val);
        // console.log(parseFloat(total) + parseFloat($scope.balance) + parseFloat(totalPaidDebt) - parseFloat(totalExpense),parseFloat(total), parseFloat($scope.balance) , parseFloat(totalPaidDebt) , parseFloat(totalExpense));

    }

    $scope.printReport = function () {
        var setting = {
            companyInfo: $scope.companyInfo.companyInfo,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        $scope.reports.balance = $scope.balance;
        $scope.reports.fromDate = $scope.modalStoreReport.fromDate;
        $scope.reports.toDate = $scope.modalStoreReport.toDate;
        printReport(printer, $scope.reports, setting);
    }


    var keyType = {
        left: 1,
        right: 2,
        up: 3,
        down: 4
    };

    // HOTKEY
    if ($scope.isWebView) {
        hotkeys.add({
            combo: 'f10',
            description: 'Lưu và in',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.submitOrder(1);
            }
        });

        hotkeys.add({
            combo: 'f9',
            description: 'Báo bếp',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.noticeToTheKitchen();
            }
        });

        hotkeys.add({
            combo: 'f8',
            description: 'Mở thực đơn / sơ đồ bàn',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.showOrderDetails = false;
                $scope.switchLayout();
            }
        });

        hotkeys.add({
            combo: 'f7',
            description: 'Thêm hàng hóa F2',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                if ($scope.onSearchField) {
                    $scope.onSearchField = false;
                    $("#productSearchInput").blur();
                }
                else {
                    $scope.onSearchField = true;
                    $scope.ItemIsSelected = {};
                    $("#productSearchInput").focus();
                }
            }
        });

        hotkeys.add({
            combo: 'right',
            description: 'Chuyển bàn / Chuyển món',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.isUseKeyboard = true;
                if (!$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(1);
                }
            }
        });

        hotkeys.add({
            combo: 'left',
            description: 'Chuyển bàn',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.isUseKeyboard = true;
                //var focus = $('#productSearchInput').is(':focus');
                if (!$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-1);
                }
            }
        });

        hotkeys.add({
            combo: 'enter',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa hoặc chọn bàn',
            callback: function () {
                //var focus = $('#productSearchInput').is(':focus');
                if (!$scope.onSearchField) {
                    enterHandler();
                }
            }
        });

        hotkeys.add({
            combo: 'down',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa hoặc chọn bàn',
            callback: function () {
                $scope.isUseKeyboard = true;
                if (!$scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey($scope.quantityItemPerRow);
                }
                else if ($scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey($scope.quantityTablePerRow);
                }
            }
        });

        hotkeys.add({
            combo: 'up',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa',
            callback: function () {
                //console.log('up');
                $scope.isUseKeyboard = true;
                if (!$scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-$scope.quantityItemPerRow);
                }
                else if ($scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-$scope.quantityTablePerRow);
                }
            }
        });

        hotkeys.add({
            combo: 'f4',
            allowIn: ['INPUT', 'BUTTON'],
            description: 'Chi tiết hóa đơn',
            callback: function () {
                if (!$scope.isInTable) {
                    $scope.openOrderDetails();
                }
            }
        });

        hotkeys.add({
            combo: 'tab',
            callback: function () {

            }
        });
    }

    var enterHandler = function () {
        if ($scope.isUseKeyboard) {
            //Nếu đang ở màn hình sơ đồ bàn và không có chọn hàng hóa ở ô search.
            if ($scope.isInTable && !$scope.onSearchField) {
                //Xác định context đang chọn.
                var filteredTable = $filter('filter')($scope.tables, $scope.currentZone);
                var tableIndex = findIndex(filteredTable, 'tableUuid', $scope.tableIsSelected.tableUuid);
                if (tableIndex != null) {
                    //Nếu index null thì item đang chọn ko thuộc context này không cho chọn.
                    //Chuyển sang view chọn món.
                    $scope.switchLayout();
                    buildHotKeyIndex();
                }
            }
                //Nếu đang ở màn hình chọn món và không có chọn hàng hóa ở ô search.
            else if (!$scope.isInTable && !$scope.onSearchField) {
                //$scope.leftviewStatus && 
                //console.log('ItemIsSelected', $scope.ItemIsSelected);
                $scope.pickProduct($scope.ItemIsSelected);
            }
            ////Nếu đang ở ô search
            //else if ($scope.onSearchField) {
            //    //console.log($scope.ItemSearchIsSelected);
            //    $scope.pickProduct($scope.ItemSearchIsSelected);
            //    $scope.ItemSearchIsSelected = null;
            //    //$scope.onSearchField = false;
            //    $("#productSearchInput").focus();
            //}
        }
    }

    $scope.tapInputSearch = function () {
        $scope.onSearchField = true;
    }

    $scope.isOnCustomerSearch = false;
    $scope.tapCustomerSearch = function () {
        $scope.onSearchField = false;
    }

    $scope.$on('modal.shown', function () {
        $scope.isUseKeyboard = false;
    });

    var scrollAcction = 0;
    $scope.SelectItemWhenSearch = function (offset) {

        if (!$scope.ItemSearchIsSelected && $scope.searchList) {
            $scope.ItemSearchIsSelected = $scope.searchList[0];
        }

        else if ($scope.searchList) {
            var itemIndex = findIndex($scope.searchList, 'itemId', $scope.ItemSearchIsSelected.itemId);
            if ((offset < 0 && itemIndex > 0) || (offset > 0 && itemIndex < $scope.searchList.length - 1))
                $scope.ItemSearchIsSelected = $scope.searchList[itemIndex + offset];
            // $scope.ItemSearchIsSelected = $scope.searchList[0]
            // console.log($scope.ItemSearchIsSelected);
            var p0 = document.getElementById('p0-' + $scope.ItemSearchIsSelected.itemId);
            var quotePosition = $ionicPosition.position(angular.element(p0));
            var delegate = $ionicScrollDelegate.$getByHandle('search-product-result');
            delegate.scrollTo(0, quotePosition.top, true);

        }
    }

    $scope.scrollAcction = 0;
    var screenHeight = $(window).height();

    var changeTableIndex = function (table) {
        $scope.tableIsSelected = table;
        $scope.pinItem = null;
    }

    //Hàm dùng thay đổi index của bàn hoặc item bằng phím tắt.
    $scope.changeTableOrItemByHotKey = function (offset) {

        if ($scope.isInTable) {
            // Di chuyển chọn bàn

            var filteredTable = $filter('filter')($scope.tables, $scope.currentZone);
            //Luôn phải có bàn mang về ở đầu
            if (filteredTable.length > 0 && filteredTable[0].tableName !== 'Mang về') {
                //Thêm bàn mang về vào đầu nếu chưa có.
                filteredTable.unshift($scope.tables[0]);
            }
            else if (filteredTable.length == 0) {
                filteredTable.push($scope.tables[0]);
            }

            var tableIndex = findIndex(filteredTable, 'tableUuid', $scope.tableIsSelected.tableUuid);
            if (tableIndex == null && filteredTable.length > 0) {
                //Nếu index null thì set mặc định là ở bàn mang về.
                tableIndex = 0;
            }
            if ((offset < 0 && tableIndex > -offset) || (offset > 0 && tableIndex < filteredTable.length - offset && tableIndex > 0))
                //$scope.openTable(filteredTable[tableIndex + offset], false);
                changeTableIndex(filteredTable[tableIndex + offset]);
            else if ((tableIndex == 1 && offset < -1) || (tableIndex == 1 && offset == -1)) {
                //$scope.openTable(filteredTable[tableIndex - 1], false);
                changeTableIndex(filteredTable[tableIndex - 1]);
            }
            else if (tableIndex == 0 && offset >= 1 && tableIndex < filteredTable.length - offset) {
                //$scope.openTable(filteredTable[tableIndex + 1], false);
                changeTableIndex(filteredTable[tableIndex + 1]);
            }
            //$scope.leftviewStatus = false;

            try {
                var p1 = document.getElementById('p1-' + $scope.tableIsSelected.tableUuid);
                var quotePosition = $ionicPosition.position(angular.element(p1));

                if (offset > 0) {
                    if (quotePosition.top > screenHeight - 151) {
                        // console.log(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction++;
                        var delegate = $ionicScrollDelegate.$getByHandle('tables');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                } else if (offset < 0) {
                    if (quotePosition.top < 0) {
                        // console.log(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction--;
                        var delegate = $ionicScrollDelegate.$getByHandle('tables');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                }
            }
            catch (e) {
                //console.log(e);
            }
        } else {
            // Di chuyển chọn món
            if (!$scope.ItemIsSelected) {
                $scope.ItemIsSelected = $scope.productItemList[0];
            } else {
                var itemIndex = findIndex($scope.productItemList, 'itemId', $scope.ItemIsSelected.itemId);
                if ((offset < 0 && itemIndex >= -offset) || (offset > 0 && itemIndex < $scope.productItemList.length - offset))
                    $scope.ItemIsSelected = $scope.productItemList[itemIndex + offset];

                // Cuộn màn hình theo item selected  
                var p2 = document.getElementById('p2-' + $scope.ItemIsSelected.itemId);
                var quotePosition = $ionicPosition.position(angular.element(p2));
                // console.log(angular.element(p2));
                if (offset > 0) {
                    if (quotePosition.top > screenHeight - 151) {
                        // console.log(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction++;
                        var delegate = $ionicScrollDelegate.$getByHandle('productItemList');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);

                    }
                } else if (offset < 0) {
                    if (quotePosition.top < 0) {
                        // console.log(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction--;
                        var delegate = $ionicScrollDelegate.$getByHandle('productItemList');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                }
            }
        }
    }

    var isValidTableQuantity = function (value) {
        if (Number.isInteger(parseInt(value)) && parseInt(value) > 0) {
            return true;
        }
        return false;
    }

    $scope.confirmTableZoneEditing = function (index) {
        //Nếu xác nhận thì chép từ bản tạm qua bản chính.
        if ($scope.newTableMapTemp[index].zone == null
            || $scope.newTableMapTemp[index].zone.trim() == ''
            || $scope.newTableMapTemp[index].quantity == null
            || !isValidTableQuantity($scope.newTableMapTemp[index].quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        $scope.newTableMapTemp[index].isUpdating = false;
        $scope.newTableMapTemp[index].unit = $scope.newTableMapTemp[index].unit2 ? 'Phòng' : 'Bàn';
        $scope.newTableMap[index] = angular.copy($scope.newTableMapTemp[index]);
    };

    $scope.cancelTableZoneEditing = function (index) {
        //Nếu hủy thao tác thì chép từ bản chính qua bản tạm lại.
        $scope.newTableMapTemp[index] = angular.copy($scope.newTableMap[index]);
        $scope.newTableMapTemp[index].isUpdating = false;
    };

    $scope.removeAllTableZone = function () {
        $scope.newTableMap = [];
        $scope.newTableMapTemp = [];
    };

    $scope.removeAllInitTableZone = function () {
        $scope.tableMap = [];
        $scope.tableMapTemp = [];
    };

    $scope.confirmTableZoneInitializing = function (index) {
        if ($scope.tableMapTemp[index].zone == null
            || $scope.tableMapTemp[index].zone.trim() == ''
            || $scope.tableMapTemp[index].quantity == null
            || !isValidTableQuantity($scope.tableMapTemp[index].quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        $scope.tableMapTemp[index].isUpdating = false;
        $scope.tableMap[index] = angular.copy($scope.tableMapTemp[index]);
    };

    $scope.editTableZoneInitializing = function (index) {
        $scope.tableMapTemp[index].isUpdating = true;
    };

    $scope.cancelTableZoneInitializing = function (index) {
        $scope.tableMapTemp[index] = angular.copy($scope.tableMap[index]);
        $scope.tableMapTemp[index].isUpdating = false;
    };

    $scope.removeTableZoneInitializingTablesModal = function (index) {
        $scope.tableMapTemp[index].splice(index, 1);
        $scope.tableMap[index].splice(index, 1);
    };

    $scope.addTableZone = function (zone, quantity, unit) {
        if (zone == null
            || zone.trim() == ''
            || quantity == null
            || !isValidTableQuantity(quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        if (!quantity) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.tableMapTemp.length,
            zone: zone ? zone : '',
            quantity: quantity,
            unit: unit ? 'Phòng' : 'Bàn',
            isUpdating: false,
            unit2: unit
        };
        $scope.modalCreateTables.zone = null;
        $scope.modalCreateTables.quantity = null;
        $scope.tableMap.push(t);
        $scope.tableMapTemp.push(angular.copy(t));
    };

    $scope.closeCreateTableZone = function () {
        $scope.tableMapTemp = [];
        $scope.tableMap = [];
        $scope.modalCreateTables.hide();
    };

    $scope.closeEditTableZone = function () {
        $scope.modalEditTables.hide();
    };

    $scope.removeAll = function (item, $event) {
        $scope.pinItem = null;
        $scope.selectedItem = item;
        $scope.checkRemoveItem(-$scope.selectedItem.quantity, $scope.selectedItem);
        $scope.selectedItem.changeQuantity = null;
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    };

    $scope.redirectToManage = function () {
        window.open('https://pos.suno.vn', '_blank');
    };

    $scope.changeTempOrderName = function () {
        if ($scope.tableIsSelected
              && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
              && $scope.permissionIndex == -1
              ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasOwnProperty('note')) {
            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdByName = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.note;
            delete $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.note;
            $scope.popoverTableAction.hide();
            if ($scope.isSync) {
                var currentTable = angular.copy($scope.tableIsSelected);
                var currentTableOrder = [];
                currentTableOrder.push(currentTable);
                currentTableOrder[0].tableOrder = [];
                currentTableOrder[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                var updateData = {
                    "companyId": SunoGlobal.companyInfo.companyId,
                    "storeId": $scope.currentStore.storeID,
                    "clientId": SunoGlobal.userProfile.sessionId,
                    "shiftId": null,//LSFactory.get('shiftId'),
                    "startDate": "",
                    "finishDate": "",
                    "tables": angular.copy(currentTableOrder),
                    "zone": $scope.tableMap,
                    "info": {
                        action: "renameOrder",
                        deviceID: deviceID,
                        timestamp: genTimestamp(),
                        author: SunoGlobal.userProfile.userId
                    }
                }
                DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                .then(function (data) {
                    var shiftId = null;
                    if (data.docs.length > 0) {
                        shiftId = data.docs[0].shiftId;
                    }
                    updateData.shiftId = shiftId;
                    updateData = angular.toJson(updateData);
                    updateData = JSON.parse(updateData);
                    if (isSocketConnected) {
                        console.log('updateData-renameOrder', updateData);
                        socket.emit('updateOrder', updateData);
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
            }
            return toaster.pop('success', '', 'Đã đổi tên cho đơn hàng LƯU TẠM thành công!');
        }
        return toaster.pop('warning', '', 'Thao tác không được thực hiện, đổi tên chỉ áp dụng các đơn hàng LƯU TẠM.');
    }

    $ionicPopover.fromTemplateUrl('SupportPopOver', {
        scope: $scope
    })
    .then(function (popOver) {
        $scope.popOver = popOver;
    });

    $scope.openSupportPopOver = function ($event) {
        $scope.popOver.show($event);
    }

    $scope.closeSupportPopOver = function ($event) {
        $scope.popOver.hide();
    }

    $scope.promotionTab = 1;

    $scope.openPromotionPopOver = function () {
        $ionicModal.fromTemplateUrl('promotion.html', {
            scope: $scope,
            animation: 'slide-in-up',
            backdropClickToClose: true
        }).then(function (modal) {
            $scope.promotionPopOver = modal;
            $scope.promotionPopOver.show();
        });
    }

    $scope.closePromotionPopOver = function ($event) {
        $scope.promotionPopOver.hide();
    }

    ////Hàm cập nhật 
    //var updateSelectedTableToDB = function () {
    //    if (!$scope.tableIsSelected) return;
    //    var tableUuid = $scope.tableIsSelected.tableUuid;
    //    var store = $scope.currentStore.storeID;
    //    DBTables.$queryDoc({
    //        selector: {
    //            'store': { $eq: store },
    //            'tableUuid': { $eq: tableUuid }
    //        },
    //        fields: ['_id', '_rev']
    //    }).then(function (data) {
    //        //Check docs length để tránh trường hợp khi client dùng lần đầu tiên tạo phòng bàn thì tableIsSelected thay đổi
    //        //dẫn đến callback này gọi trong khi chưa có dữ liệu dưới DB Local gây lỗi _id of undefined.
    //        if (data.docs.length > 0) {
    //            var table = JSON.parse(JSON.stringify($scope.tableIsSelected));
    //            table._id = data.docs[0]._id;
    //            table._rev = data.docs[0]._rev;
    //            table.store = store;
    //            return DBTables.$addDoc(table);
    //        }
    //        return null;
    //    }).then(function (data) {
    //        //console.log(data);
    //        return null;
    //    }).catch(function (error) {
    //        //Thử cập nhật lại thông tin của bàn đó sau khi cập nhật thất bại ở then thứ 1.
    //        //Do 2 watch Group và Collection đôi lúc chạy song song, nhưng trong PouchDB cập nhật phải có _rev.
    //        //Sau khi callback của 1 trong 2 watch trên đã cập nhật thì _rev sẽ bị thay đổi
    //        //Gây ra lỗi conflict _rev ở callback của watch chạy sau, do _rev đã cũ và ko tồn tại.
    //        //Khắc phục bằng cách thử gọi để lấy _rev mới sau đó cập nhật lại.
    //        return DBTables.$queryDoc({
    //            selector: {
    //                'store': { $eq: store },
    //                'tableUuid': { $eq: tableUuid }
    //            },
    //            fields: ['_id', '_rev']
    //        });
    //    }).then(function (data) {
    //        //Kiểm tra này để check trường hợp then thứ 1 thực hiện thành công ko nhảy vào catch 1 sẽ nhảy thẳng xuống then này
    //        //Gây ra lỗi Can not read property '...' of undefined. Ở then thứ 2 return null.
    //        if (data) { //&& data.docs && data.docs.length > 0) {
    //            var table = JSON.parse(JSON.stringify($scope.tableIsSelected));
    //            table._id = data.docs[0]._id;
    //            table._rev = data.docs[0]._rev;
    //            table.store = store;
    //            return DBTables.$addDoc(table);
    //        } else return null;
    //    }).catch(function (error) {
    //        console.log(error);
    //    });
    //};

    //Hàm cập nhật bàn vào DB với bàn đang được chọn.
    var updateSelectedTableToDB = function () {
        var tb = $scope.tableIsSelected;
        updateTableToDB(tb);
    }

    //Hàm cập nhật bàn vào DB với 1 bàn tùy ý lúc truyền vào.
    var updateTableToDB = function (tb) {
        DBTables.$queryDoc({
            selector: {
                'store': { $eq: $scope.currentStore.storeID },
                'tableUuid': { $eq: tb.tableUuid }
            },
            fields: ['_id', '_rev']
        })
        .then(function (data) {
            var table = angular.copy(tb);
            table._id = data.docs[0]._id;
            table._rev = data.docs[0]._rev;
            table.store = $scope.currentStore.storeID;
            return DBTables.$addDoc(table);
        })
        .then(function (data) {
            //log for debug
            //console.log(data);
        })
        .catch(function (error) {
            //Nếu bị conflict thì retry lại
            DBTables.$queryDoc({
                selector: {
                    'store': { $eq: $scope.currentStore.storeID },
                    'tableUuid': { $eq: tb.tableUuid }
                },
                fields: ['_id', '_rev']
            })
            .then(function (data) {
                var table = angular.copy(tb);
                table._id = data.docs[0]._id;
                table._rev = data.docs[0]._rev;
                table.store = $scope.currentStore.storeID;
                return DBTables.$addDoc(table);
            })
            .catch(function (e) {
                console.log(e);
            })
        });
    }


    var refreshToken = function () {
        return new Promise(function (resolve, reject) {
            var urlRefreshToken = Api.refreshToken + "&clientId=" + $scope.token.clientId + "&token=" + $scope.token.refreshToken;
            asynRequest($state, $http, 'GET', urlRefreshToken, false, 'json', null, function (data, status) {
                if (data) {
                    resolve(data);
                }
            }, function (error) {
                console.log(error);
                reject("Có lỗi xảy ra khi get Access Token!");
            }, true, 'refreshAccessToken');
        });
    };
}

//Kết ca lúc offline thì khi online lại thì data sẽ vẫn còn trên server.

//Điều chỉnh lại cấu trúc dữ liệu cho hàng tách món.
//Cấu trúc lại logs
//Gửi lên server cấu hình tách món
//Merge lại theo cấu trúc logs mới.


//Cập nhật lại printed.
//Cập nhật lại thông báo.
//Tách ghép hóa đơn ở hàng tách món.


//Set lại accessToken và refreshToken khi hết hạn.
//Đọc sơ đồ thì API, kiểm tra dưới Local


//permissions
//set lại thời gian
//merge
//print
//store granted.