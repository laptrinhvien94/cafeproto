angular.module('SunoPosCafe.loginController', [])
    .controller('LoginCtrl', ["$q", "$scope", "$rootScope", "$http", "Auth", "$state", "$ionicSideMenuDelegate", "$ionicPopup", "toaster", "$timeout", "SunoPouchDB", LoginCtrl]);
function LoginCtrl($q, $scope, $rootScope, $http, AuthFactory, $state, $ionicSideMenuDelegate, $ionicPopup, toaster, $timeout, SunoPouchDB) {
    $scope.$watch('$root.appVersion', function () {
        $scope.appVersion = $rootScope.appVersion;
    });
    $scope.offline = null;
    $ionicSideMenuDelegate.canDragContent(false);

    var sunoAuth = new SunoAuth();
    var DBSettings = SunoPouchDB.getPouchDBInstance('setting', null);

    //force reload tab nếu nhận được yêu cầu cần reload lại bên Pos Controller.
    if ($rootScope.hasOwnProperty('isNeedToReload') && $rootScope.isNeedToReload) {
        delete $rootScope.isNeedToReload;
        window.location.reload(true);
    }

    $scope.loginData = {
        username: null,
        password: null
    };
    $scope.token = null;
    $scope.hasAccount = false;
    $scope.displayName = null;

    $scope.isCancel = false;
    ////Khi mới vào route login thực hiện kiểm tra dưới DB Local để xem đã đăng nhập hay chưa?
    //Promise.all([
    //    AuthFactory.getSessionId(),
    //    AuthFactory.getStoreList(),
    //    AuthFactory.getBootloader(),
    //    AuthFactory.getSetting(),
    //    AuthFactory.getUser(),
    //    AuthFactory.getToken()
    //])
    AuthFactory.getSunoGlobal()
    .then(function (data) {
        //Đã đăng nhập
        if (
            //data[0].docs.length > 0
            //&& data[1].docs.length > 0
            //&& data[2].docs.length > 0
            //&& data[3].docs.length > 0
            //&& data[4].docs.length > 0
            //&& data[5].docs.length > 0
            data.docs.length > 0 && validateUsagePackage(data.docs[0].SunoGlobal)
        ) {
            $scope.hasAccount = true;
            $scope.displayName = data.docs[0].SunoGlobal.userProfile.fullName;
            $scope.$apply();
            //Chờ 3s rồi tự động đăng nhập nếu không nhấn "Đăng nhập"
            $timeout(function () {
                if (!$scope.isCancel) {
                    //Gán lại cho SunoGlobal các giá trị dưới DB Local.
                    //SunoGlobal.userProfile.sessionId = data[4].docs[0].user.sesssionId;
                    //SunoGlobal.userProfile.userName = data[4].docs[0].user.email;
                    //UserProfile
                    //SunoGlobal.userProfile.authSessionId = data[4].docs[0].user.authSessionId;
                    //SunoGlobal.userProfile.userId = data[4].docs[0].user.userId;
                    //SunoGlobal.userProfile.fullName = data[4].docs[0].user.displayName;
                    //SunoGlobal.userProfile.email = data[4].docs[0].user.email;
                    //SunoGlobal.userProfile.isAdmin = data[4].docs[0].user.isAdmin;
                    //Token info
                    //SunoGlobal.token.accessToken = data[5].docs[0].token.token;
                    //SunoGlobal.token.refreshToken = data[5].docs[0].token.refreshToken;
                    //Company Info
                    //SunoGlobal.companyInfo.companyId = data[4].docs[0].user.companyId;
                    //SunoGlobal.companyInfo.companyName = data[4].docs[0].user.companyName;
                    //Permission
                    //SunoGlobal.permissions = data[4].docs[0].user.permissions;
                    //Gán lại cho SunoGlobal các giá trị dưới DB Local.
                    for (var prop in data.docs[0].SunoGlobal) {
                        SunoGlobal[prop] = data.docs[0].SunoGlobal[prop];
                    }
                    $state.go('pos');
                }
            }, 2000);
        } else { //Chưa đăng nhập
            $scope.resetUser();
            $scope.hasAccount = false;
        }
    })

    $scope.$watch('$root.w_logout', function () {
        if ($rootScope.w_logout == false) {
            $scope.hasAccount = false;
        }
    });

    var validateUsagePackage = function (SunoGlobal) {
        var dateTxt = SunoGlobal.usageInfo.overallExpiryDateText;
        var dateArr = dateTxt.split('/');
        var expiredDateNum = new Date(dateArr[2], dateArr[1] - 1, dateArr[0]).getTime();
        var nowDateNum = new Date().getTime();
        if (expiredDateNum > nowDateNum) return true;
        return false;   
    }

    $scope.resetUser = function () {
        //localStorage.removeItem('account');
        //localStorage.removeItem('bootloader');
        //localStorage.removeItem('setting');
        //localStorage.removeItem('store');
        //localStorage.removeItem('token');
        //localStorage.removeItem('user');
        $scope.isCancel = true;
        Promise.all([
            DBSettings.$removeDoc({ _id: 'SunoGlobal' })
            //    //$PouchDB.DBSettings.$removeDoc({ _id: 'account' }),
            //    $PouchDB.DBSettings.$removeDoc({ _id: 'bootloader' }),
            //    $PouchDB.DBSettings.$removeDoc({ _id: 'setting' }),
            //    $PouchDB.DBSettings.$removeDoc({ _id: 'store' }),
            //    $PouchDB.DBSettings.$removeDoc({ _id: 'token' }),
            //    $PouchDB.DBSettings.$removeDoc({ _id: 'user' })
        ]).then(function (data) {
            //window.location.reload(true);
            $scope.hasAccount = false;
            $scope.$apply();
        }).catch(function (e) {
            console.log(e);
        });
    }

    $scope.openLink = function (url) {
        if (window.cordova) {
            cordova.InAppBrowser.open(url, '_system');
        }
    }

    var getAuthBootloader = function () {
        var deferred = $q.defer();
        var url = Api.authBootloader;
        asynRequest($state, $http, 'POST', url, $scope.token, 'json', null, function (data, status) {
            if (data) {
                //console.log('getAuthBootloader', data);
                //AuthFactory.setBootloader(data).then(function (info) {
                //    deferred.resolve(data);
                //});
                deferred.resolve(data);
            }
        }, function (error, status) {
            deferred.reject("Có lỗi xảy ra!");
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Có sự cố khi đăng nhập</p> <p style="text-align:center;">Vui lòng thử lại!</p>'
            });
        }, true, 'getAuthBootloader');
        return deferred.promise;
    }

    var getStoreList = function () {
        var deferred = $q.defer();
        var url = Api.store;
        asynRequest($state, $http, 'GET', url, $scope.token, 'json', null, function (data, status) {
            if (data) {
                //Check lỗi chưa có kho
                if (data.stores) {
                    //console.log('getStoreList', data);
                    AuthFactory.setStoreList(data.stores).then(function (info) {
                        deferred.resolve(data);
                    }).catch(function (error) {
                        console.log(error);
                        deferred.reject("Có lỗi xảy ra");
                    });
                }
                else {
                    deferred.reject("Có lỗi xảy ra");
                }
            }
        }, function (error, status) {
            deferred.reject("Có lỗi xảy ra!");
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Có sự cố khi đăng nhập</p> <p style="text-align:center;">Vui lòng thử lại!</p>'
            });
        }, true, 'getStoreList');
        return deferred.promise;
    }

    var getBootloader = function () {
        var deferred = $q.defer();
        var url = Api.bootloader;
        asynRequest($state, $http, 'POST', url, $scope.token, 'json', null, function (data, status) {
            if (data) {
                AuthFactory.setSetting(data).then(function (info) {
                    deferred.resolve(data);
                });
            }
        }, function (error, status) {
            deferred.reject("Có lỗi xảy ra!");
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Có sự cố khi đăng nhập</p> <p style="text-align:center;">Vui lòng thử lại!</p>'
            });
        }, true, 'getBootloader');
        return deferred.promise;
    }

    $('#loginFrm').on('keyup keypress', function (e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13) {
            e.target.blur();
        }
    });

    var getSession = function (sessionId) {
        var deferred = $q.defer();
        var url = Api.getSession + 'clientId=' + sessionId;
        asynRequest($state, $http, 'GET', url, false, 'json', null, function (data, status) {
            if (data) {
                AuthFactory.setToken({
                    clientId: sessionId,
                    token: data.userSession.accessToken,
                    expires: data.userSession.accessTokenExpired,
                    refreshToken: data.userSession.refreshToken
                }).then(function () {
                    $scope.token = data.userSession.accessToken;
                    delete data.userSession.accessToken;
                    delete data.userSession.accessTokenExpired;
                    delete data.userSession.refreshToken;
                    return Promise.all([
                        AuthFactory.setUser(data.userSession)
                        //AuthFactory.setAccount($scope.loginData)
                    ]);
                }).then(function () {
                    deferred.resolve(data);
                });
            }
        }, function (error, status) {
            deferred.reject("Có lỗi xảy ra!");
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Thông tin đăng nhập không đúng!</p>'
            });
        }, true, 'getSession');
        return deferred.promise;
    }

    var login = function () {
        var deferred = $q.defer();
        sunoAuth.login($scope.loginData.username, $scope.loginData.password)
            .then(function (body) {
                //Gán cho SunoGlobal
                SunoGlobal.userProfile.sessionId = body.sessionId;
                SunoGlobal.userProfile.userName = body.userName;
                sunoAuth.getUserInfo(SunoGlobal.userProfile.sessionId)
                    .then(function (data) {
                        //UserProfile
                        SunoGlobal.userProfile.authSessionId = data.userSession.authSessionId;
                        SunoGlobal.userProfile.userId = data.userSession.userId;
                        SunoGlobal.userProfile.fullName = data.userSession.displayName;
                        SunoGlobal.userProfile.email = data.userSession.email;
                        SunoGlobal.userProfile.isAdmin = data.userSession.isAdmin;
                        //Token info
                        SunoGlobal.token.accessToken = data.userSession.accessToken;
                        SunoGlobal.token.refreshToken = data.userSession.refreshToken;
                        //Company Info
                        SunoGlobal.companyInfo.companyId = data.userSession.companyId;
                        SunoGlobal.companyInfo.companyName = data.userSession.companyName;
                        //Permission
                        SunoGlobal.permissions = data.userSession.permissions;
                        $scope.token = data.userSession.accessToken;
                        deferred.resolve(data);
                    })
                    .catch(function (error) {
                        console.log('getUserInfo', error);
                    });
            })
            .catch(function (e) {
                deferred.reject(e);
                if (e == null) {
                    return $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Vui lòng kiểm tra kết nối internet của bạn</p>'
                    });
                }
                else {
                    $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Thông tin đăng nhập không đúng</p>'
                    });
                }
            });
        return deferred.promise;
        //url = Api.login + 'username=' + $scope.loginData.username + '&password=' + $scope.loginData.password;
        //asynRequest($state, $http, 'GET', url, false, 'json', null, function (data, status) {
        //    if (data) {
        //        $scope.sessionId = data.sessionId;
        //        AuthFactory.setSessionId(data.sessionId)
        //        .then(function (data) {
        //            deferred.resolve(data);
        //        });
        //    }
        //}, function (error, status) {
        //    deferred.reject("Có lỗi xảy ra!");
        //    if (error == null)
        //        return $ionicPopup.alert({
        //            title: 'Thông báo',
        //            template: 'Vui lòng kiểm tra kết nối internet của bạn'
        //        });
        //    else
        //        $ionicPopup.alert({
        //            title: 'Thông báo',
        //            template: 'Thông tin đăng nhập không đúng'
        //        });
        //}, true, 'login');
        return deferred.promise;
    }


    $scope.doLogin = function () {
        if ($scope.hasAccount) {
            $state.go('pos');
            return;
        }
        $scope.loginData.username = $('#username').val();
        $scope.loginData.password = $('#password').val();
        if (window.cordova) {
            var isAndroid = ionic.Platform.isAndroid();
            var isIPad = ionic.Platform.isIPad();
            var isIOS = ionic.Platform.isIOS();
        }

        if ($scope.loginData.username == '' || $scope.loginData.password == '') {
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Vui lòng nhập thông tin tài khoản!</p>'
            });
        }

        //$scope.$watch("offline", function (n) {
        //    if (n)
        //        if (n.action == "submit-order")
        //            toaster.pop('error', "", 'Kết nối internet không ổn định hoặc đã mất kết nối internet, vui lòng lưu đơn hàng sau khi có internet trở lại!');
        //        else
        //            toaster.pop('error', "", 'Kết nối internet không ổn định hoặc đã mất kết nối internet, thao tác hiện không thể thực hiện được, vui lòng thử lại sau!');
        //    $scope.offline = null;
        //});

        login()
            //.then(function (data) {
            //    return Promise.all([
            //        AuthFactory.setSessionId(SunoGlobal.userProfile.sessionId),
            //        getSession(SunoGlobal.userProfile.sessionId)
            //    ]);
            //})
            .then(function (data) {
                //console.log(data);
                //return Promise.all([getBootloader(), getStoreList(), getAuthBootloader()]);
                //return Promise.all([getBootloader(), getAuthBootloader()]);
                return getAuthBootloader();
            }).then(function (data) {
                //Thêm vào SunoGlobal sau đó lưu xuống DB.
                //console.log(data);
                //console.log(SunoGlobal);
                var SunoGlobalWithoutFn = JSON.parse(JSON.stringify(SunoGlobal));
                //SunoGlobalWithoutFn.stores = data[0].allStores;
                //SunoGlobalWithoutFn.featureActivations = data[0].featureActivations;
                //SunoGlobalWithoutFn.companyInfo.companyCode = data[1].companyCode;
                //SunoGlobalWithoutFn.companyInfo.companyPhone = data[1].companyPhone;
                //SunoGlobalWithoutFn.companyInfo.industry = data[1].industry;
                //SunoGlobalWithoutFn.storeIdsGranted = data[1].storeIdsGranted;
                SunoGlobalWithoutFn.usageInfo = data.usageInfo;
                //SunoGlobalWithoutFn.rolesGranted = data[1].rolesGranted;
                //SunoGlobalWithoutFn.users = data[1].users.userProfiles;
                //SunoGlobalWithoutFn.saleSetting.cogsCalculationMethod = data[0].saleSetting.cogsCalculationMethod;
                //SunoGlobalWithoutFn.saleSetting.isAllowDebtPayment = data[0].saleSetting.allowDebtPayment;
                //SunoGlobalWithoutFn.saleSetting.isAllowPriceModified = data[0].saleSetting.allowPriceModified;
                //SunoGlobalWithoutFn.saleSetting.isAllowQuantityAsDecimal = data[0].saleSetting.allowQuantityAsDecimal;
                //SunoGlobalWithoutFn.saleSetting.isApplyCustomerPricingPolicy = data[0].saleSetting.applyCustomerPricingPolicy;
                //SunoGlobalWithoutFn.saleSetting.isApplyEarningPoint = data[0].saleSetting.applyEarningPoint;
                //SunoGlobalWithoutFn.saleSetting.isApplyPromotion = data[0].saleSetting.applyPromotion;
                //SunoGlobalWithoutFn.saleSetting.isPrintMaterials = data[0].saleSetting.isPrintMaterials;
                //SunoGlobalWithoutFn.saleSetting.isProductReturnDay = data[0].saleSetting.allowProductReturnDay;
                //SunoGlobalWithoutFn.saleSetting.productReturnDay = data[0].saleSetting.productReturnDay;
                //SunoGlobalWithoutFn.saleSetting.saleReportSetting = data[0].saleSetting.saleReportSetting;
                //SunoGlobalWithoutFn.saleSetting.allowOfflineCache = data[0].saleSetting.allowOfflineCache;
                //SunoGlobalWithoutFn.saleSetting.allowTaxModified = data[0].saleSetting.allowTaxModified;
                //SunoGlobalWithoutFn.saleSetting.applyCustomerCare = data[0].saleSetting.applyCustomerCare;
                //SunoGlobalWithoutFn.saleSetting.bankTransferPaymentMethod = data[0].saleSetting.bankTransferPaymentMethod;
                //SunoGlobalWithoutFn.saleSetting.cardPaymentMethod = data[0].saleSetting.cardPaymentMethod;
                //SunoGlobalWithoutFn.saleSetting.cashPaymentMethod = data[0].saleSetting.cashPaymentMethod;
                //SunoGlobalWithoutFn.saleSetting.currencyNote = data[0].saleSetting.currencyNote;
                //SunoGlobalWithoutFn.saleSetting.customerEmailConfiguration = data[0].saleSetting.customerEmailConfiguration;
                //SunoGlobalWithoutFn.saleSetting.isHasSampleData = data[0].saleSetting.isHasSampleData;
                //SunoGlobalWithoutFn.saleSetting.longtimeInventories = data[0].saleSetting.longtimeInventories;
                //SunoGlobalWithoutFn.saleSetting.receiptVoucherMethod = data[0].saleSetting.receiptVoucherMethod;
                //SunoGlobalWithoutFn.saleSetting.showInventoryTotal = data[0].saleSetting.showInventoryTotal;
                //SunoGlobalWithoutFn.saleSetting.storeChangeAutoApproval = data[0].saleSetting.storeChangeAutoApproval;
                //SunoGlobalWithoutFn.saleSetting.weeklyReportEmail = data[0].saleSetting.weeklyReportEmail;
                if (validateUsagePackage(SunoGlobalWithoutFn))
                {
                    return AuthFactory.setSunoGlobal(SunoGlobalWithoutFn);
                }
                else {
                    $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Tài khoản của bạn đã hết hạn.</p>'
                    });
                    throw "Hết hạn sử dụng";
                }
            })
            .then(function (d) {
                $state.go('pos');
            }).catch(function (error) {
                console.log(error);
                //toaster.pop('error', "", 'Đăng nhập không thành công, xin thử lại!');
            });
    };
}
