var checkArr = [];
var ApiUrl = 'http://localhost:14952/api/';
//var AuthUrl = 'http://auth.hugate.demo/api/';
//var ApiUrl = 'https://api.suno.vn/api/';
var AuthUrl = 'http://localhost:6985/api/';
//var AuthUrl = 'https://auth.suno.vn/api/'
var PrintUrl = 'https://cafe.suno.vn/print.html';
var socketUrl = 'http://localhost:8181';
//ApiUrl = 'https://api.suno.vn/api/';
//AuthUrl = 'https://auth.suno.vn/api/';
//socketUrl = 'http://cafebeta.suno.vn'
var Api = {
    login: AuthUrl + 'auth/hugate?format=json&',
    getSession: AuthUrl + 'provider/GetUserSession?format=json&',
    search: ApiUrl + 'productitem/search?limit=30&pageIndex=1&format=json&keyword=',
    bootloader: ApiUrl + 'bootloader?format=json',
    authBootloader: AuthUrl + 'bootloader?format=json',
    getCompanyInfo: AuthUrl + 'membership/getcompanyinfo',
    store: ApiUrl + 'stores?format=json',
    refreshToken: AuthUrl + 'provider/refreshToken?format=json',
    customers: ApiUrl + 'customers?limit=30&pageIndex=1&format=json&keyword=',
    serial: ApiUrl + 'inventory/serialnumbers?format=json',
    submitOrder: ApiUrl + 'sale/complete?format=json',
    addCustomer: ApiUrl + 'customer/create?format=json',
    productitems: ApiUrl + 'productitems?format=json&',
    categories: ApiUrl + 'categories?format=json',
    printTemplate: ApiUrl + 'printtemplate/get',
    getKeyValue: ApiUrl + 'setting/getKeyValue?format=json&key=',
    getMultiKeyValue: ApiUrl + 'setting/getMultiKeyValue?format=json',
    postKeyValue: ApiUrl + 'setting/postKeyValue?format=json',
    receipt: ApiUrl + 'receipt/create',
    getNewProduct: ApiUrl + 'productitems/new?keyword=&limit=100&pageIndex=1&hasImages=true&storeId=',
    getBestSelling: ApiUrl + 'productitems/bestselling?keyword=&limit=100&pageIndex=1&hasImages=true&storeId=',
    storeReport: ApiUrl + 'sale/storeReport?',
    getMemberPermission: AuthUrl + 'membership/getMemberPermission',
    auditTrailRecord: ApiUrl + 'audit/create',
    getOrderInfo: ApiUrl + 'sale/order?saleOrderId=',
    ping: ApiUrl + 'ping'
}

var saleOrder = {
    "storeId": null,
    "createdBy": null,
    "subTotal": 0,
    "discount": 0,
    "DiscountInPercent": 0,
    "IsDiscountPercent": false,
    "tax": 0,
    "promotionId": 0,
    "comment": "",
    "customer": null,
    "payments": [
      {
          "voucherId": 0,
          "code": "",
          "receivedDate": null,
          "status": 3,
          "paymentMethodId": 1,
          "amount": 0,
          "balance": 0,
          "description": ""
      }
    ],
    "orderDetails": [],
    "saleOrderCode": "",
    "saleOrderDate": null,
    "seller": null,
    "cashier": null,
    "totalQuantity": 0,
    "total": 0,
    "tableName": null,
    "subFee": null,
    "subFeeName": null,
    "amountPaid": 0,
    "paymentBalance": 0,
    "saleTypeID": 0,
    "status": 0,
    "shipper": {
        "shipperId": 0,
        "name": "",
        "shippingDate": null,
        "comment": "",
        "shipper": ""
    },
    logs: [],
    sharedWith: [],
    revision: 1 //Để check đồng bộ giữa các đơn hàng khi Init.
}

//Kiểu Log cho các hàng hóa thông thường (gộp số lượng của món).
var Log = function (itemID, itemName, action, quantity, timestamp, deviceID, status) {
    this.itemID = itemID; //ID item
    this.itemName = itemName; //Tên item
    this.action = action; //Tên Action trong các loại loại BB(Báo bếp) hoặc H(Hủy), D(Ngừng tính giờ)
    this.quantity = quantity; //Số lượng item tham gia vào action.
    this.timestamp = timestamp; //Thời gian thực hiện action.
    this.deviceID = deviceID; //ID định danh cho mỗi thiết bị.
    //this.author = author;
    //this.tableID = tableID;
    //this.orderID = orderID;
    this.status = status; //Trạng thái action đã thực hiện trong 2 loại false(Offline, mất kết nối hoặc unsync) hoặc true(Online sync).
    //this.startTime = null; //Thời gian bắt đầu nếu có đồng bộ về thời gian.
}

//Kiểu Log cho các đơn hàng tách món.
var UngroupLog = function (itemID, itemName, action, quantity, timestamp, deviceID, detailID, status) {
    this.itemID = itemID; //ID item
    this.itemName = itemName; //Tên item
    this.action = action; //Tên action trong các loại BB(Báo bếp) hoặc H(Hủy).
    this.quantity = quantity; //Số lượng action tham gia vào action
    this.timestamp = timestamp; //Thời gian thực hiện action.
    this.deviceID = deviceID; //ID định danh cho mỗi thiết bị.
    this.detailID = detailID; //ID cho mỗi dòng tương ứng với detail nào.
    //this.affectedID = affectedID; //Item chịu tác động của action. Nếu là BB thì logID và affectedID bằng nhau, nếu là hủy món thì affectedID là 1 trong số các logID đã tồn tại.
    this.status = status; //Trạng thái action đã thực hiện trong 2 loại  false(Offline, mất kết nối hoặc unsync) hoặc true(Online sync).
}

var filter = angular.injector(["ng"]).get("$filter")("number");

var Mysuno = {
    isContains: function (str, substr) {
        return (str.indexOf(substr) >= 0) ? true : false;
    },
}

var dateFormat = function () { var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g, timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g, timezoneClip = /[^-+\dA-Z]/g, pad = function (val, len) { val = String(val); len = len || 2; while (val.length < len) val = "0" + val; return val }; return function (date, mask, utc) { var dF = dateFormat; if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) { mask = date; date = undefined } date = date ? new Date(date) : new Date; if (isNaN(date)) throw SyntaxError("invalid date"); mask = String(dF.masks[mask] || mask || dF.masks["default"]); if (mask.slice(0, 4) == "UTC:") { mask = mask.slice(4); utc = true } var _ = utc ? "getUTC" : "get", d = date[_ + "Date"](), D = date[_ + "Day"](), m = date[_ + "Month"](), y = date[_ + "FullYear"](), H = date[_ + "Hours"](), M = date[_ + "Minutes"](), s = date[_ + "Seconds"](), L = date[_ + "Milliseconds"](), o = utc ? 0 : date.getTimezoneOffset(), flags = { d: d, dd: pad(d), ddd: dF.i18n.dayNames[D], dddd: dF.i18n.dayNames[D + 7], m: m + 1, mm: pad(m + 1), mmm: dF.i18n.monthNames[m], mmmm: dF.i18n.monthNames[m + 12], yy: String(y).slice(2), yyyy: y, h: H % 12 || 12, hh: pad(H % 12 || 12), H: H, HH: pad(H), M: M, MM: pad(M), s: s, ss: pad(s), l: pad(L, 3), L: pad(L > 99 ? Math.round(L / 10) : L), t: H < 12 ? "a" : "p", tt: H < 12 ? "am" : "pm", T: H < 12 ? "A" : "P", TT: H < 12 ? "AM" : "PM", Z: utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""), o: (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4), S: ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10] }; return mask.replace(token, function ($0) { return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1) }) } }(); dateFormat.masks = { "default": "ddd mmm dd yyyy HH:MM:ss", shortDate: "m/d/yy", mediumDate: "mmm d, yyyy", longDate: "mmmm d, yyyy", fullDate: "dddd, mmmm d, yyyy", shortTime: "h:MM TT", mediumTime: "h:MM:ss TT", longTime: "h:MM:ss TT Z", isoDate: "yyyy-mm-dd", isoTime: "HH:MM:ss", isoDateTime: "yyyy-mm-dd'T'HH:MM:ss", isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'" }; dateFormat.i18n = { dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] }; Date.prototype.format = function (mask, utc) { return dateFormat(this, mask, utc) };

function formatDateJsonToString(datejson, formatstring) {
    if (datejson == null)
        return "";
    var date = convertJsonDateTimeToJs(datejson);
    if (formatstring) {
        return dateFormat(date, formatstring);
    }
    else {
        return dateFormat(date, "dd/mm/yyyy HH:MM:ss");
    }
}

function convertJsonDateTimeToJs(jsonDate) {
    var dateSlice = jsonDate.slice(6, 24);
    var milliseconds = parseInt(dateSlice);
    var date = new Date(milliseconds);
    return date;
}

function removeItemZeroForPrint(o) {

    var temp = {
        saleOrder: {}
    };

    angular.copy(o, temp);
    temp.saleOrder.orderDetails = [];
    for (var i = 0; i < o.saleOrder.orderDetails.length; i++) {
        if (o.saleOrder.orderDetails[i].quantity > 0) {
            temp.saleOrder.orderDetails.push(o.saleOrder.orderDetails[i]);
        }
    }

    return temp;
}

function removeItemZero($SunoSaleOrderCafe) {
    var removedCount = 0;
    var length = $SunoSaleOrderCafe.saleOrder.orderDetails.length;
    for (var i = 0; i < length; i++) {
        if ($SunoSaleOrderCafe.saleOrder.orderDetails[i - removedCount].quantity <= 0) {
            $SunoSaleOrderCafe.removeItem($SunoSaleOrderCafe.saleOrder.orderDetails[i - removedCount]);
            removedCount++;
        }
    }
}


function removeUnNotice(o) {
    o.saleOrder.hasNotice = false;
    for (var i = 0; i < o.saleOrder.orderDetails.length; i++) {
        if (o.saleOrder.orderDetails[i].newOrderCount > 0) {
            o.saleOrder.hasNotice = true;
            break;
        }
    }
}

function prepareOrder(saleOrder) {
    if (saleOrder.seller.userId) saleOrder.seller = saleOrder.seller.userId;
    saleOrder.amountPaid = parseFloat(saleOrder.amountPaid);
    if (saleOrder.amountPaid < saleOrder.payments[0].amount && !saleOrder.receiptVoucher) {
        saleOrder.paymentBalance = saleOrder.payments[0].amount - saleOrder.amountPaid;
        saleOrder.payments[0].amount = saleOrder.amountPaid;
    } else if (saleOrder.amountPaid < saleOrder.total && saleOrder.receiptVoucher && saleOrder.receiptVoucher.length > 0) {
        saleOrder.payments[0].amount = saleOrder.amountPaid;
        saleOrder.payments[0].balance = parseFloat(saleOrder.total) - parseFloat(saleOrder.payments[0].amount);
        saleOrder.paymentBalance = parseFloat(saleOrder.total) - parseFloat(saleOrder.payments[0].amount);
        saleOrder.amountPaid = parseFloat(saleOrder.payments[0].amount) + parseFloat(saleOrder.receiptVoucher[0].amount);
    } else if (saleOrder.amountPaid >= saleOrder.total) {
        saleOrder.paymentBalance = 0;
        saleOrder.payments[0].amount = saleOrder.total;
    }
}

function repricingOrder(saleOrder, isMultiplePrice) {
    if (!saleOrder || !saleOrder.orderDetails) return;
    if (isMultiplePrice) {
        var lastIndex = saleOrder.orderDetails.indexOf(saleOrder.orderDetails);

        var type = saleOrder.customer ? saleOrder.customer.type : 0;

        for (i = 0; i < saleOrder.orderDetails.length; i++) {
            var detail = saleOrder.orderDetails[i];
            if (!detail) continue;

            switch (type) {
                case 1:
                    if (detail.wholeSalePrice) detail.unitPrice = detail.wholeSalePrice;
                    break;
                case 2:
                    if (detail.vipPrice) detail.unitPrice = detail.vipPrice;
                    break;
                default:
                    // detail.unitPrice = detail.retailPrice;
                    break;
            };
            if (detail.unitPrice == undefined || detail.unitPrice == null) detail.unitPrice = 0;
            //calculatePrice : recalculate sellPrice
            detail.sellPrice = detail.unitPrice - detail.discount;
        }

    };
    calculateTotal(saleOrder);
}

function calculateTotal(saleOrder) {

    saleOrder.totalQuantity = 0;
    saleOrder.subTotal = 0;
    saleOrder.tax = 0;
    for (i = 0; i < saleOrder.orderDetails.length; i++) {
        var item = saleOrder.orderDetails[i];
        if (!item.quantity) item.quantity = 0;
        else if (item.quantity && typeof (item.quantity) == "string") item.quantity = parseFloat(item.quantity.replace(/\,/g, ''));
        saleOrder.totalQuantity += item.quantity;
        //item.subTotal = item.quantity * (item.unitPrice - item.discount);
        item.subTotal = parseFloat(item.quantity * item.sellPrice);
        saleOrder.subTotal += parseFloat(item.subTotal);
        saleOrder.tax += (item.quantity * item.tax);
    };
    //calculate discount
    if (saleOrder.IsDiscountPercent) {
        saleOrder.discount = saleOrder.subTotal * saleOrder.DiscountInPercent / 100;
    }
    else {
        saleOrder.discount = Math.min(saleOrder.discount, saleOrder.subTotal);
    }
    //calculate total
    saleOrder.total = saleOrder.subTotal - saleOrder.discount;
    // if (saleOrder.IsSubFeePercent){
    //   saleOrder.subFee = (saleOrder.SubFeeInPercent * saleOrder.total)/100;
    // }
    if (saleOrder.subFee) {
        if (typeof (saleOrder.subFee) == "string") saleOrder.subFee = parseFloat(saleOrder.subFee.replace(/\,/g, ''));
        saleOrder.total += saleOrder.subFee;
    }
    if (!saleOrder.IsPaid) saleOrder.amountPaid = saleOrder.total;

    saleOrder.payment = saleOrder.total - saleOrder.amountPaid;
}

function prepProcessStamps(saleOrder) {
    // Ghép món phụ vào cùng 1 tem với món chính
    for (var i = 0; i < saleOrder.orderDetails.length; i++) {
        var lastItem = 0;
        if (typeof saleOrder.orderDetails[i].isChild == 'undefined')
            lastItem = i;
        if (!saleOrder.orderDetails[lastItem].childItem) saleOrder.orderDetails[lastItem].childItem = [];
        else
            saleOrder.orderDetails[lastItem].childItem.push({ childName: saleOrder.orderDetails[i].itemName });
    }

    // Xóa các món phụ ra khỏi danh sách
    var data = angular.copy(saleOrder);
    data.orderDetails = [];
    for (var j = 0; j < saleOrder.orderDetails.length; j++) {
        if (typeof saleOrder.orderDetails[j].isChild == 'undefined')
            data.orderDetails.push(saleOrder.orderDetails[j]);
    }

    return data;
}

function printOrderInBrowser(printer, saleOrder, type, setting) {
    var html = printer.initializeOrder(null, type);
    if (html) {
        for (i = 0; i < saleOrder.orderDetails.length; i++) {
            var item = saleOrder.orderDetails[i];
            if (item.discountIsPercent == true) {
                item.discount = item.discountInPercent;
            }
        }
        saleOrder.Date = new Date();
        saleOrder.companyName = setting.companyInfo.companyName;
        saleOrder.companyPhone = setting.companyInfo.phoneNumber;
        saleOrder.companyAddress = setting.companyInfo.address;

        saleOrder.storeName = setting.store.storeName;
        saleOrder.storePhone = setting.store.storePhone;
        saleOrder.storeAddress = setting.store.storeAddress;
        if (saleOrder.subFee == null) saleOrder.subFee = 0;
        saleOrder.taxCode = setting.companyInfo.TaxCode;

        var sellerIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.seller.userId);
        var cashierUserIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.cashier);

        if (sellerIndex != null) saleOrder.sellerName = setting.allUsers.userProfiles[sellerIndex].displayName;
        if (cashierUserIndex != null) saleOrder.cashierName = setting.allUsers.userProfiles[cashierUserIndex].displayName;

        saleOrder.saleOrderDate ? saleOrder.saleOrderDate : saleOrder.saleOrderDate = "\/Date(" + (new Date()).getTime() + "-0000)\/";
        saleOrder.saleDateString = formatDateJsonToString(saleOrder.saleOrderDate);
        saleOrder.startTimeString = dateFormat(saleOrder.startTime, "dd/mm/yyyy HH:MM:ss");
        //Print

        printer.print(html, saleOrder);
        return true;
    } else {
        return false;
    }
}

function printOrderBarKitchen(printer, saleOrder, BarItemSetting, setting) {

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
    if (barOrder.orderDetails.length > 0) printOrderInBrowser(printer, barOrder, 128, setting);
    if (kitchenOder.orderDetails.length > 0) printOrderInBrowser(printer, kitchenOder, 128, setting);
}

function printOrderBarKitchenInMobile(printDevice, saleOrder, BarItemSetting, setting) {

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
    // console.log(barOrder,kitchenOder);
    if (kitchenOder.orderDetails.length > 0 && barOrder.orderDetails.length > 0) {
        kitchenOder = prepairOrderMobile(kitchenOder, setting);
        barOrder = prepairOrderMobile(barOrder, setting);
        printOrderInMobile(printDevice.kitchenPrinter, kitchenOder, "BB", setting);
        setTimeout(function () {
            printOrderInMobile(printDevice.barPrinter, barOrder, "BB", setting);
        }, 3000);
    } else if (barOrder.orderDetails.length > 0) {
        printOrderInMobile(printDevice.barPrinter, barOrder, "BB", setting);
    } else if (kitchenOder.orderDetails.length > 0) {
        printOrderInMobile(printDevice.kitchenPrinter, kitchenOder, "BB", setting);
    }

}

function printOrderInMobile(printer, saleOrder, type, setting) {
    // console.log(saleOrder);
    saleOrder.Date = new Date();
    saleOrder.companyName = setting.companyInfo.companyName;
    saleOrder.companyPhone = setting.companyInfo.phoneNumber;
    saleOrder.companyAddress = setting.companyInfo.address;

    saleOrder.storeName = setting.store.storeName;
    saleOrder.storePhone = setting.store.storePhone;
    saleOrder.storeAddress = setting.store.storeAddress;
    if (saleOrder.subFee == null) saleOrder.subFee = 0;
    saleOrder.taxCode = setting.companyInfo.TaxCode;

    var sellerIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.seller.userId);
    var cashierUserIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.cashier);

    if (sellerIndex != null) saleOrder.sellerName = setting.allUsers.userProfiles[sellerIndex].displayName;
    if (cashierUserIndex != null) saleOrder.cashierName = setting.allUsers.userProfiles[cashierUserIndex].displayName;

    // for (i = 0; i < saleOrder.orderDetails.length; i++) {
    //   var item = saleOrder.orderDetails[i];
    //   if(item.discountIsPercent == true){
    //     item.discount = item.discountInPercent;
    //   }
    // }

    saleOrder.saleOrderDate ? saleOrder.saleOrderDate : saleOrder.saleOrderDate = "\/Date(" + (new Date()).getTime() + "-0000)\/";
    saleOrder.saleDateString = formatDateJsonToString(saleOrder.saleOrderDate);
    saleOrder.startTimeString = dateFormat(saleOrder.startTime, "dd/mm/yyyy HH:MM:ss");
    //Print

    var template = initPrintTemplate(saleOrder, type);

    data = {
        printer_type: parseInt(printer.printer), // 0: Error; 1:Bixolon; 2: Fujitsu
        ip: printer.ip,
        texts: template,
        feed: 30
    };
    // console.log(data);
    window.Suno.printer_print(
      data, function (message) {
          console.log(message);
      }, function (message) {
          console.log(message);
      });
}

function prepairOrderMobile(saleOrder, setting) {
    saleOrder.Date = new Date();
    saleOrder.companyName = setting.companyInfo.companyName;
    saleOrder.companyPhone = setting.companyInfo.phoneNumber;
    saleOrder.companyAddress = setting.companyInfo.address;

    saleOrder.storeName = setting.store.storeName;
    saleOrder.storePhone = setting.store.storePhone;
    saleOrder.storeAddress = setting.store.storeAddress;
    if (saleOrder.subFee == null) saleOrder.subFee = 0;
    saleOrder.taxCode = setting.companyInfo.TaxCode;

    var sellerIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.seller.userId);
    var cashierUserIndex = findIndex(setting.allUsers.userProfiles, 'userId', saleOrder.cashier);

    if (sellerIndex != null) saleOrder.sellerName = setting.allUsers.userProfiles[sellerIndex].displayName;
    if (cashierUserIndex != null) saleOrder.cashierName = setting.allUsers.userProfiles[cashierUserIndex].displayName;

    // for (i = 0; i < saleOrder.orderDetails.length; i++) {
    //   var item = saleOrder.orderDetails[i];
    //   if(item.discountIsPercent == true){
    //     item.discount = item.discountInPercent;
    //   }
    // }

    saleOrder.saleOrderDate ? saleOrder.saleOrderDate : saleOrder.saleOrderDate = "\/Date(" + (new Date()).getTime() + "-0000)\/";
    saleOrder.saleDateString = formatDateJsonToString(saleOrder.saleOrderDate);
    saleOrder.startTimeString = dateFormat(saleOrder.startTime, "dd/mm/yyyy HH:MM:ss");

    return saleOrder
}

function initPrintTemplate(data, type) {
    if (type == 'BB') {
        var printTemplate = [
          { text: data.storeName, format: 0, align: 0, size: 0 },
          { text: data.storeAddress, format: 0, align: 0, size: 0 },
          { text: data.storePhone, format: 0, align: 0, size: 0 },
          { text: "PHIẾU IN BẾP", format: 0, align: 1, size: 0 },
          { text: data.tableName, format: 0, align: 1, size: 0 },
          { text: data.saleDateString, format: 0, align: 1, size: 0 },
          { text: "Phục vụ: " + data.sellerName, format: 0, align: 0, size: 0 },
          { text: "     SL     MÓN", format: 0, align: 0, size: 0 },
          { text: "------------------------------------------", format: 0, align: 0, size: 0 }
        ];
        for (var i = 0; i < data.orderDetails.length; i++) {
            printTemplate.push(
              { text: '     ' + data.orderDetails[i].quantity + '     ' + data.orderDetails[i].itemName, format: 0, align: 0, size: 0 }
            );
            printTemplate.push({ text: '           Ghi chú: ' + data.orderDetails[i].comment, format: 0, align: 0, size: 0 })

        }
        printTemplate.push(
            { text: "------------------------------------------", format: 0, align: 0, size: 0 }
        );
        return printTemplate;
    } else if (type = 'TT') {
        var printTemplate = [
          { text: data.storeName, format: 0, align: 0, size: 0 },
          { text: data.storeAddress, format: 0, align: 0, size: 0 },
          { text: data.storePhone, format: 0, align: 0, size: 0 },
          { text: "HÓA ĐƠN BÁN HÀNG", format: 0, align: 1, size: 0 },
          { text: data.saleOrderCode, format: 0, align: 1, size: 0 },
          { text: "Thu ngân: " + data.cashierName, format: 0, align: 0, size: 0 },
          { text: data.tableName, format: 0, align: 0, size: 0 },
          { text: 'Giờ vào: ' + data.startTimeString, format: 0, align: 0, size: 0 },
          { text: 'Giờ ra: ' + data.saleDateString, format: 0, align: 0, size: 0 },
          { text: "------------------------------------------", format: 0, align: 0, size: 0 },
          { text: "MÓN", format: 0, align: 0, size: 0 },
          { text: "ĐƠN GIÁ                   SL    THÀNH TIỀN", format: 0, align: 0, size: 0 },
          { text: "------------------------------------------", format: 0, align: 0, size: 0 }
        ];
        for (var i = 0; i < data.orderDetails.length; i++) {
            printTemplate.push(
              { text: data.orderDetails[i].itemName, format: 0, align: 0, size: 0 }
            );
            var txtDiscount = (data.orderDetails[i].discount > 0) ? '(đã giảm ' + filter(data.orderDetails[i].discount) + ')' : '';
            var txtPrice = addWhiteSpace(filter(data.orderDetails[i].sellPrice) + txtDiscount, 26);
            var txtSl = addWhiteSpace(data.orderDetails[i].quantity, 6);
            var txtSubTotal = filter(data.orderDetails[i].subTotal);
            printTemplate.push({ text: txtPrice + txtSl + txtSubTotal, format: 0, align: 0, size: 0 })
        }
        printTemplate.push(
            { text: "------------------------------------------", format: 0, align: 0, size: 0 }
        );
        printTemplate.push(
            { text: "Hóa đơn: " + filter(data.subTotal), format: 0, align: 2, size: 0 },
            { text: "Giảm giá: " + filter(data.discount), format: 0, align: 2, size: 0 },
            { text: "Phụ phí: " + filter(data.subFee), format: 0, align: 2, size: 0 },
            { text: "Tổng thanh toán: " + filter(data.total), format: 0, align: 2, size: 0 },
            { text: "                                          ", format: 0, align: 1, size: 0 },
            { text: "Xin cám ơn và hẹn gặp lại", format: 0, align: 1, size: 0 }
        );

        return printTemplate;
    }
}

function addWhiteSpace(text, lth) {
    var l = lth - String(text).length;
    for (var i = 0; i < l; i++) {
        text += ' ';
    }
    return text;
}

function printReport(printer, data, setting) {
    data.companyName = setting.companyInfo.companyName;
    data.companyPhone = setting.companyInfo.phoneNumber;
    data.companyAddress = setting.companyInfo.address;
    data.storeName = setting.store.storeName;
    data.storePhone = setting.store.storePhone;
    data.storeAddress = setting.store.storeAddress;
    data.Date = new Date();
    var html = printer.initializeOrder(null, 512);
    if (html) {
        printer.print(html, data);
    }
}

function checkOrderPrintStatus(saleOrder) {
    var count = 0;
    for (var i = 0; i < saleOrder.orderDetails.length ; i++) {
        if (saleOrder.orderDetails[i].newOrderCount > 0) {
            return true;
        }
    }
    return false;
}

function tableIsActive(t) {
    var count = 0;
    for (var i = 0; i < t.tableOrder.length; i++) {
        if (t.tableOrder[i].saleOrder.orderDetails.length > 0) {
            return true;
        }
    }
    return false;
}

function findIndex(arraytosearch, key, valuetosearch) {
    for (var i = 0; i < arraytosearch.length; i++) {
        if (arraytosearch[i][key] == valuetosearch) {
            return i;
        }
    }
    return null;
}

function buildTree(source) {
    var dest = [];
    for (var i = 0; i < source.length; i++) {
        var item = source[i];
        if (item.parentCategoryID == null) {
            dest.push(item);
        }
        if (item.parentCategoryID == 0) {
            dest.push(item);

            getChildren(item.categoryID, dest, source);
        }
    }
    return dest;
};

function getChildren(parentId, dest, source) {
    var children = source.filter(function (item) {
        return item.parentCategoryID == parentId;
    });
    var childrenID = [];
    var below = [];
    if (children.length > 0) {
        for (var i = 0; i < children.length; i++) {
            dest.push(children[i]);
            getChildren(children[i].categoryID, dest, source);
            childrenID.push(children[i].categoryID);
            below.push(children[i]);
        }
        var check = findIndex(dest, 'categoryID', parentId);
        // console.log(check);
        dest[check].childrenID = childrenID;
        dest[check].below = below;
    }
};

function filterReportByStore(reports) {
    var saleCount = 0;
    var saleTotal = 0;
    var cashTotal = 0;
    var cardTotal = 0;
    var debtTotal = 0;
    var discountTotal = 0;
    var subFeeTotal = 0;
    var totalExpense = 0;
    var totalExpenseCash = 0;
    var totalPaidDebt = 0;
    var totalPaidDebtCash = 0;

    for (var i = 0; i < reports.storeSales.length; i++) {
        var item = reports.storeSales[i];
        saleCount++;
        saleTotal += item.total;
        cashTotal += item.cashTotal;
        cardTotal += item.cardTotal;
        debtTotal += item.debtTotal;
        discountTotal += item.discount;
        subFeeTotal += item.subFee;
    }

    for (var i = 0; i < reports.storeExpenses.length; i++) {
        var item = reports.storeExpenses[i];
        totalExpense += item.payment;
        if (item.paymentMethodId == 1) totalExpenseCash += item.payment;
    }

    for (var i = 0; i < reports.storePaidDebts.length; i++) {
        var item = reports.storePaidDebts[i];
        totalPaidDebt += item.amount;
        if (item.paymentMethodId == 1) totalPaidDebtCash += item.amount;
    }

    reports.totalExpenseCash = totalExpenseCash;
    reports.totalPaidDebtCash = totalPaidDebtCash;
    reports.totalPaidDebt = totalPaidDebt;
    reports.totalExpense = totalExpense;
    reports.saleCount = saleCount;
    reports.saleTotal = saleTotal;
    reports.cashTotal = cashTotal;
    reports.cardTotal = cardTotal;
    reports.debtTotal = debtTotal;
    reports.discountTotal = discountTotal;
    reports.subFeeTotal = subFeeTotal;
}

var socketAction = {
    process: function (online, local) {

        for (var i = 0; i < online.length; i++) {
            if (local[online[i].tableUuid]) {
                // Chỉ xử lý ở bàn có dữ liệu local
                var tablesHasChange = online[i];
                var ordersChange = local[online[i].tableUuid];
                // Lặp qua các order trong bàn dưới local
                for (var j = 0; j < ordersChange.length; j++) {
                    // Những order có trên online và có dưới local
                    var findOrder = _.filter(tablesHasChange.tableOrder, function (obj) {
                        return obj && obj.saleOrder && obj.saleOrder.saleOrderUuid == ordersChange[j].saleOrder.saleOrderUuid;
                    });

                    if (findOrder && findOrder.length > 0) {
                        // Tìm sự khác nhau giữa order online và local.
                        // Nếu order local có sự thay đổi nhưng online vẫn trả về dữ liệu mới thì ghi đè
                        var isConflict = diff(ordersChange[j].saleOrder, findOrder[0].saleOrder);
                        if (!isConflict) {
                            angular.copy(ordersChange[j].saleOrder, findOrder[0].saleOrder);
                        }
                    } else {
                        // Những order chỉ có dưới local mà không có trên online
                        // Nếu order dưới local có mà online ko có ( đã thanh toán trên thiết bị khác ) thì remove
                        // Nếu odder dưới local có mà online ko có ( order đang tạo chưa báo bếp ) thì giữ lại
                        var remove = false;
                        for (var k = 0; k < ordersChange[j].saleOrder.orderDetails.length; k++) {
                            var it = ordersChange[j].saleOrder.orderDetails[k];
                            if (it.newOrderCount < it.quantity) {
                                remove = true;
                                break;
                            }
                        }
                        if (!remove) tablesHasChange.tableOrder.push(ordersChange[j]);
                    }
                }
            }
        }
    }
};

function diff(localOrder, onlineOrder) {
    for (var i = 0; i < onlineOrder.orderDetails.length; i++) {
        var onlineItem = onlineOrder.orderDetails[i];
        var localItem = _.findWhere(localOrder.orderDetails, { productItemId: onlineItem.productItemId });
        if (!localItem) {
            return true;
        };
        if ((localItem.quantity - localItem.newOrderCount) != onlineItem.quantity) {
            return true;
        }
    }
    return false;
}

//Hàm filter đơn hàng có logs chưa đồng bộ và lấy tất cả các logs của đơn hàng đó.
function filterUnsyncedOrder(tables) {
    var data = angular.copy(tables)
    //Lặp qua từng bàn
    for (var x = 0; x < tables.length; x++) {
        var tableOrder = tables[x].tableOrder;
        //Lặp qua từng order
        for (var y = 0; y < tableOrder.length; y++) {
            var logs = tableOrder[y].saleOrder.logs;
            //Lặp qua từng dòng dogs trong mỗi order
            for (var z = 0; z < logs.length; z++) {
                if (!logs[z].status) { // tương đương status == false -> Chưa đồng bộ lên Server thêm vào Order
                    break;
                }
                if (z == logs.length - 1 && logs[z].status) { //tương đương đã duyệt đến cuối logs và phần tử cuối đã đc đồng bộ -> đồng bộ cả đơn hàng
                    //xóa ra khỏi danh sách gửi lên cho server.
                    data[x].tableOrder.splice(y, 1);
                }
            }
        }
    }
    return data;
}

//Hàm filter đơn hàng có logs chưa đồng bộ và chỉ lấy các logs chưa đồng bộ.
function filterUnsyncedOrderWithLogs(tables) {
    var data = angular.copy(tables)
    //Lặp qua từng bàn
    for (var x = 0; x < tables.length; x++) {
        var tableOrder = tables[x].tableOrder;
        //Lặp qua từng order
        for (var y = 0; y < tableOrder.length; y++) {
            var logs = tableOrder[y].saleOrder.logs;
            //Lặp qua từng dòng dogs trong mỗi order
            var logsTemp = [];
            for (var z = 0; z < logs.length; z++) {
                if (!logs[z].status) { //Nếu log chưa được đồng bộ thì thêm vào danh sách
                    logsTemp.push(logs[z]);
                }
            }
            if (logsTemp.length == 0) {//Nếu duyệt tới cuối danh sách logs mà ds tạm rỗng -> đã đồng bộ hết thì bỏ đơn hàng đó ra khỏi ds đồng bộ.
                data[x].tableOrder.splice(y, 1);
            }
            else if (logsTemp.length > 0) { //Nếu duyệt tới cuối danh sách logs mà ds tạm có logs thì cập nhật lại log. 
                data[x].tableOrder[y].saleOrder.logs = logsTemp;
            }
        }
    }
    return data;
}

//Hàm filter đơn hàng chỉ lấy các logs đã đồng bộ và đơn hàng ko rỗng.
function filterOrderWithUnsyncLogs(tables) {
    var data = angular.copy(tables)
    //Lặp qua từng bàn
    for (var x = 0; x < tables.length; x++) {
        var tableOrder = tables[x].tableOrder;
        //Lặp qua từng order
        var count = 0;
        for (var y = 0; y < tableOrder.length; y++) {
            if (!tableOrder[y].saleOrder.saleOrderUuid) {
                data[x].tableOrder.splice(y - count, 1);
                count++; // Thêm count để tránh lỗi splice của array sai index.
                continue;
            }
            var logs = tableOrder[y].saleOrder.logs;
            //Lặp qua từng dòng dogs trong mỗi order
            var logsTemp = [];
            for (var z = 0; z < logs.length; z++) {
                if (!logs[z].status) { //Nếu log chưa được đồng bộ thì thêm vào danh sách
                    logsTemp.push(logs[z]);
                }
            }
            data[x].tableOrder[y].saleOrder.logs = logsTemp;
        }
    }
    return data;
}

function filterOwnerOrder(tables, userId) {
    var data = angular.copy(tables);
    for (var i = 0; i < tables.length; i++) {
        var tableOrder = tables[i].tableOrder;
        for (var j = 0; j < tableOrder.length; j++) {
            if (tableOrder[j].saleOrder.createdBy == null || tableOrder[j].saleOrder.createdBy != userId) {
                data[i].tableOrder.splice(j, 1);
            }
        }
    }
    return data;
}

function filterHasNoticeOrder(tables) {
    var order = [];
    var data = angular.copy(tables);
    for (var i = 0; i < tables.length; i++) {
        var tableOrder = tables[i].tableOrder;
        for (var j = 0; j < tableOrder.length; j++) {
            if (tableOrder[j].saleOrder.hasNotice) {
                // data[i].tableOrder.splice(j,1);
                if (!order[tables[i].tableUuid]) {
                    order[tables[i].tableUuid] = [];
                }
                order[tables[i].tableUuid].push(tableOrder[j]);
            }
        }
    }
    return order;
}

function filterInitOrder(tables) {
    var data = angular.copy(tables);
    // lặp qua từng bàn
    for (var i = 0; i < tables.length; i++) {
        var tableOrder = tables[i].tableOrder;
        // lặp qua từng order trong bàn
        for (var j = 0; j < tableOrder.length; j++) {
            if (tableOrder[j].saleOrder && tableOrder[j].saleOrder.orderDetails.length > 0) {
                var order = tableOrder[j].saleOrder;
                // lặp qua từng món trong order, nếu order nào có món chưa báo bếp thì xóa order ra khỏi danh sách init
                var remove = false;
                for (var k = 0; k < order.orderDetails.length; k++) {
                    var it = order.orderDetails[k];
                    if (it.newOrderCount > 0) {
                        remove = true;
                        break;
                    }
                }
                if (remove) {
                    data[i].tableOrder.splice(j, 1);
                }
                // data[i].tableOrder[j].saleOrder.hasNotice = false;
            }
        }
    }
    return data;
}

var _round = Math.round;
Math.round = function (number, decimals /* optional, default 0 */) {
    if (arguments.length == 1)
        return _round(number);

    var multiplier = Math.pow(10, decimals);
    return _round(number * multiplier) / multiplier;
}

//Tham số isSynchronous dùng để config ẩn hay hiện loading.
function asynRequest($state, $http, method, url, headers, responseType, data, callback, errorCallback, unique, requestId, isSynchronous) {
    if(isSynchronous === undefined || isSynchronous === null) isSynchronous = true; //Mặc định là hiển thị loading.
    // if(checkLoader){checkLoader.setStatus(1)};
    // console.log(checkArr.indexOf(requestId));
    if (checkArr.indexOf(requestId) == -1) {
        checkArr.push(requestId);
        var db = null;
        var token = null;
        //extConfig dùng để xác lấy lại accessToken trong trường hợp accessToken hết hạn.
        if (data != null && data.hasOwnProperty('extConfig')) {
            //get Db và Token từ PosController.
            db = data.extConfig.db;
            token = data.extConfig.token;
            delete data.extConfig;
            //Cập nhật lại data là null nếu ko cần truyền dữ liệu gì
            if (Object.keys(data).length == 0) {
                data = null;
            }
        };
        if (headers != false) {
            headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + headers };
            // headers: headers !== null ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer '.headers } : null;
            var reqConfig = {
                method: method,
                headers: headers,
                responseType: responseType,
                url: url,
                data: data,
                isSync: isSynchronous
            };
        } else {
            var reqConfig = {
                method: method,
                responseType: responseType,
                url: url,
                data: data,
            };
        }

        var httpService = $http;
        // if (unique === true && requestId && requestId != '') {
        //     httpService = Mysuno.uniqueRequestsAwareHttpService($http);
        // };
        var http = httpService(reqConfig);
        if (!http) return;

        http
        .success(function (successResponse, status) {
            var pos = checkArr.indexOf(requestId);
            checkArr.splice(pos, 1);
            if (callback !== null && typeof callback === 'function') {
                callback(successResponse);
                // if(checkLoader){checkLoader.setStatus(0)};
            }
        })
        .error(function (errorResponse, status) {
            //if (url === Api.ping) {
            //    debugger;
            //}
            var pos = checkArr.indexOf(requestId);
            checkArr.splice(pos, 1);
            // console.log(errorResponse,status);
            if (headers !== null) {
                if (status == 401 && Mysuno.isContains(errorResponse.error_description, 'expired')) {
                    // POSIM.RefreshToken($http, method, url, data, callback);
                    //Token Hết hạn, đi lấy lại token
                    //error = JSON.parse(JSON.stringify(errorResponse));
                    //error.status = status;
                    //errorCallback(error);
                    //if($state){
                    //  if(window.plugins){
                    //    window.plugins.toast.showShortBottom('Phiên làm việc đã hết hạn!');
                    //  }

                    //Lấy access Token mới nếu có cấu hình là refresh Token ở extConfig
                    if (token != null && db != null) {
                        var urlRefreshToken = Api.refreshToken + "&clientId=" + token.clientId + "&token=" + token.refreshToken;
                        asynRequest($state, $http, 'GET', urlRefreshToken, false, 'json', null,
                            function (d, status) {
                                //Lưu token vào DB.
                                token.token = d.accessToken;
                                token.refreshToken = d.refreshToken;
                                db.$getDocByID({ _id: 'token' })
                                .then(function (d) {
                                    if (d.docs.length > 0) {
                                        d.docs[0].token.token = token.token;
                                        d.docs[0].token.refreshToken = token.refreshToken;
                                        return db.$addDoc(d.docs[0]);
                                    }
                                    return null;
                                })
                                .then(function (d) {
                                    //console.log(d);
                                    //Thực hiện lại action chưa thành công.
                                    var headers = token.token;
                                    asynRequest($state, $http, method, url, headers, responseType, data, callback, errorCallback, unique, requestId);
                                })
                                .catch(function (e) {
                                    console.log(e);
                                });
                            },
                            function (e) {

                            });
                    }
                    else {
                        var error = JSON.parse(JSON.stringify(errorResponse));
                        error.status = status;
                        errorCallback(error);
                    }
                }
                else if (status == 401 && Mysuno.isContains(errorResponse.error_description, 'Missing access token')) {
                    //Redirect to login page.
                    if ($state) {
                        if (window.plugins) {
                            window.plugins.toast.showShortBottom('Phiên làm việc đã hết hạn!');
                        }
                        $state.go('login', {}, { reload: true });
                    }

                }
                else if (status == 500) {
                    if (errorCallback !== null && typeof errorCallback === 'function') {
                        errorCallback(errorResponse);
                    }
                    //Redirect to error page.
                    console.log('Redirect to error page');
                }
                else if (status === 0) {
                    // if(window.plugins){
                    //   window.plugins.toast.showShortBottom('Mất kết nối internet!');
                    // }
                    if (url == Api.getCompanyInfo) {
                        return;
                    }
                    if (url == Api.ping) {
                        var scope = angular.element(document.getElementById('SunoPosCafe')).scope();
                        scope.isOnline = false;
                        if (errorCallback !== null && typeof errorCallback === 'function') {
                            errorCallback(errorResponse);
                        }
                        return;
                    }

                    if (reqConfig.method.toUpperCase() == "GET") {
                        //Kiểm tra nếu bị lỗi expired refresh Token hoặc invalid refresh Token thì logout
                        var scope = angular.element(document.getElementById('SunoPosCafe')).scope();
                        if (scope.hasOwnProperty('isLoggedIn') && scope.isLoggedIn) {
                            scope.logout();
                        }
                            //Nếu không phải thì là trường hợp invalid username và password ngoài login view.
                        else {
                            scope.offline = {
                                status: true,
                                action: requestId
                            };
                        }
                    } else if (reqConfig.method.toUpperCase() == "POST") {
                        var scope = angular.element(document.getElementById('SunoPosCafe')).scope();
                        scope.offline = {
                            status: true,
                            action: requestId
                        };
                    }
                }
                else {
                    // if(checkLoader){checkLoader.setStatus(0)};
                    if (errorCallback !== null && typeof errorCallback === 'function') {
                        errorCallback(errorResponse);
                    }
                }
            }
            else {
                // if(checkLoader){checkLoader.setStatus(0)};
                if (errorCallback !== null && typeof errorCallback === 'function') {
                    errorCallback(errorResponse);
                }
            }
        })
        return;
    }
    // if(checkLoader){checkLoader.setStatus(0)};
    console.log('reject ' + requestId);
    return;
}

angular.module('SunoPosCafe.controllers', ['SunoPosCafe.loginController', 'SunoPosCafe.posController'])
.directive('ngEnter', function () {
    return function (scope, element, attrs) {
        element.bind("keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.ngEnter, { 'event': event });
                    scope.replyContent = null;
                });

                event.preventDefault();
            }
        });
    };
})

// .directive('validNumber', function() {
//   return {
//     require: '?ngModel',
//     link: function(scope, element, attrs, ngModelCtrl) {
//       if(!ngModelCtrl) {
//         return;
//       }

//       ngModelCtrl.$parsers.push(function(val) {
//         if (angular.isUndefined(val)) {
//             var val = '';
//         }

//         var clean = val.replace(/[^0-9]/g, '');
//         var negativeCheck = clean.split('-');
// 	      var decimalCheck = clean.split('.');
//         if(!angular.isUndefined(negativeCheck[1])) {
//             negativeCheck[1] = negativeCheck[1].slice(0, negativeCheck[1].length);
//             clean =negativeCheck[0] + '-' + negativeCheck[1];
//             if(negativeCheck[0].length > 0) {
//             	clean =negativeCheck[0];
//             }

//         }

//         if(!angular.isUndefined(decimalCheck[1])) {
//             decimalCheck[1] = decimalCheck[1].slice(0,2);
//             clean =decimalCheck[0] + '.' + decimalCheck[1];
//         }

//         if (val !== clean) {
//           ngModelCtrl.$setViewValue(clean);
//           ngModelCtrl.$render();
//         }
//         return clean;
//       });

//       element.bind('keypress', function(event) {
//         if(event.keyCode === 32) {
//           event.preventDefault();
//         }
//       });
//     }
//   };
// })

.directive('ngRepeatRange', ['$compile', function ($compile) {
    return {
        replace: true,
        scope: false,

        link: function (scope, element, attrs) {

            // returns an array with the range of numbers
            // you can use _.range instead if you use underscore
            function range(from, to, step) {
                var array = [];
                while (from + step <= to)
                    array[array.length] = from += step;

                return array;
            }

            // prepare range options
            var from = attrs.from || 0;
            var step = attrs.step || 1;
            var to = attrs.to || attrs.ngRepeatRange;

            // get range of numbers, convert to the string and add ng-repeat
            var rangeString = range(from, to, step).join(',');
            angular.element(element).attr('ng-repeat', 'n in [' + rangeString + ']');
            angular.element(element).removeAttr('ng-repeat-range');

            $compile(element)(scope);
        }
    };
}])

.filter('zoneName', function () {
    return function (zoneName, length) {
        if (zoneName && zoneName.length > length) {
            return zoneName.slice(0, length - 1) + "...";
        }
        return zoneName;
    }
})

.config(function ($httpProvider, $ionicConfigProvider) {
    $ionicConfigProvider.navBar.alignTitle('center');
    $ionicConfigProvider.views.maxCache(0);
    $httpProvider.interceptors.push(function ($rootScope, $q) {
        return {
            request: function (config) {
                if (config.isSync === false) return config;
                $rootScope.$broadcast('loading:show');
                return config
            },
            response: function (response) {
                $rootScope.$broadcast('loading:hide');
                return response
            },
            requestError: function (rejection) {
                $rootScope.$broadcast('loading:hide');
                return $q.reject(rejection);
            },
            responseError: function (rejection) {
                $rootScope.$broadcast('loading:hide');
                return $q.reject(rejection);
            }
        }
    })
})

.run(function ($rootScope, $ionicLoading) {
    $rootScope.$on('loading:show', function () {
        $ionicLoading.show({
            template: '<ion-spinner icon="ripple"></ion-spinner>',
            noBackdrop: true
        })
    })

    $rootScope.$on('loading:hide', function () {
        $ionicLoading.hide();
        // $ionicLoading.hide(3000)
    })
})
.directive('ionicAutocomplete',
  function ($ionicPopover) {
      var popoverTemplate =
        '<ion-popover-view style="margin-top:5px; width: 37%; height: 50%;">' +
        '<ion-header-bar>' +
        '<h1 class="title">Kết quả tìm kiếm</h1>' +
        '</ion-header-bar>' +
        '<ion-content>' +
        '<div class="list">' +
        '<a class="item" ng-repeat="item in items" ng-click="selectItem(item)">{{item[displayPropertyName]}}</a>' +
        '</div>' +
        '</ion-content>' +
        '</ion-popover-view>';
      return {
          restrict: 'A',
          scope: {
              params: '=ionicAutocomplete',
              inputSearch: '=ngModel'
          },
          link: function ($scope, $element, $attrs) {
              var popoverShown = false;
              var popover = null;
              $scope.items = $scope.params.items;
              $scope.displayPropertyName = $scope.params.displayPropertyName;

              //Add autocorrect="off" so the 'change' event is detected when user tap the keyboard
              $element.attr('autocorrect', 'off');

              $scope.createPopover = function () {
                  popover = $ionicPopover.fromTemplate(popoverTemplate, {
                      scope: $scope
                  });
              };
              $scope.createPopover();

              $element.on('focus', function (e) {
                  if (!popoverShown) {
                      popover.show(e);
                  }
                  console.log($element[0].focus);
                  $element[0].focus();
              });

              $scope.selectItem = function (item) {
                  $element.val(item[$scope.displayPropertyName]);
                  popover.hide();
                  $scope.params.onSelect(item);
              };
              $scope.$watch('params.items', function (newItems) {
                  popover.remove();
                  $scope.items = newItems;
                  $scope.createPopover();
              });
          }
      };
  }
 )
.filter('limitChar', function () {
    return function (text, value) {
        if (text) {
            if (text.length > value) {
                var text = text.slice(0, value - 3) + "...";
                return text;
            }
            return text;
        }
        return null;
    }
})
.service('utils', function () {
    this.debounce = function (execution, wait, immediate) {
        wait = 200;
        if (!window.timeout) window.timeout = null;
        return function () {
            var later = function () {
                window.timeout = null;
                if (!immediate) {
                    execution();
                }
            };
            var callNow = immediate && !window.timeout;
            clearTimeout(window.timeout);
            window.timeout = setTimeout(later, wait || 200);
            if (callNow) {
                execution();
            }
        };
    };
})

/* --- Made by justgoscha and licensed under MIT license --- */

.directive('autocomplete', ['$compile', '$ionicScrollDelegate', '$timeout', function ($compile, $ionicScrollDelegate, $timeout) {
    var index = -1;

    var template = ['<div class="autocomplete {{attrs.class}}" id="{{attrs.id}}>',
                        '<span class="input-icon input-icon-right" style="width:100%;">',
                            '<input type="text" ng-model="searchParam" placeholder="{{attrs.placeholder}}" class="{{attrs.inputclass}}" id="{{attrs.inputid}}" autocomplete="off" on-tap="onTap()" ng-blur="onBlur()" tabindex="1" />',
                            //'<i class="icon-remove red" style="cursor:pointer;" ng-show="searchParam" ng-click="removeText()"></i>',
                        '</span>',
                        '<ion-scroll delegate-handle="searchItemsResult" class="orders-details" ng-show="!showOrderDiscount" ng-class="{\'ion-scroll-active\' : suggestions.length > 0, \'ion-scroll-anactive\' : (suggestions.length == 0 || !searchParam || searchParam.length == 0)}">',
                        //'<ion-scroll delegate-handle="searchItemsResult" class="orders-details">',
                            '<ion-list class="orders-details" ng-show="completing">',
                                '$AutocompleteTemplate$',
                            '</ion-list>',
                        '</ion-scroll>',
                        '<ul class="no-result" ng-show="searchParam && (suggestions == null || suggestions.length == 0)"><li style="color: black;">Không tìm thấy kết quả phù hợp với: <span class="hidden-sm" style="font-weight: bold;">"{{ searchParam | limitChar:20 }}"</span></li></ul>',
                    '</div>'];

    return {
        restrict: 'E',
        scope: {
            searchParam: '=ngModel',
            suggestions: '=data',
            onSearchField: '=onSearch',
            onType: '=onType',
            onSelect: '=onSelect',
            onTap: '=onTap'
        },
        controller: ['$scope', '$element', '$attrs', '$timeout', function ($scope, $element, $attrs, $timeout) {
            function $scopeApply() {
                if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
                    $scope.$apply();
                }
            }

            // the index of the suggestions that's currently selected
            $scope.selectedIndex = -1;

            // set new index
            $scope.setIndex = function (i) {
                $scope.selectedIndex = parseInt(i);
            };

            this.setIndex = function (i) {
                $scope.setIndex(i);
                $scopeApply();
            };

            $scope.getIndex = function (i) {
                return $scope.selectedIndex;
            };

            $scope.removeText = function () {
                $scope.searchParam = '';
            };

            $scope.onBlur = function () {
                $scope.onSearchField = false;
            }

            // watches if the parameter filter should be changed
            var watching = true;

            // autocompleting drop down on/off
            $scope.completing = false;

            // scanning from barcode scanner
            $scope.scanning = false;
            var typingPromise;
            // starts autocompleting on typing in something
            $scope.$watch("searchParam", function (newValue, oldValue) {
                var delay = 300; //150;
                //if ((oldValue == undefined || oldValue == '') && newValue) delay = 0;//scanning == true
                if ((oldValue == undefined || oldValue == '') && newValue) { delay = 0; $scope.scanning = true; }//scanning == true
                if (typingPromise) $timeout.cancel(typingPromise);//does nothing, if timeout already done
                typingPromise = $timeout(function () {//Set timeout
                    if (watching && $scope.searchParam) {
                        $scope.completing = true;
                        $scope.searchFilter = $scope.searchParam;
                        $scope.selectedIndex = -1;
                        $ionicScrollDelegate.$getByHandle('searchItemsResult')._instances[1].scrollTop(true);
                    }
                    if ($scope.searchParam && $scope.searchParam != '' && $scope.searchParam.length > 1) {
                        // function thats passed to on-type attribute gets executed
                        if ($scope.onType)
                            $scope.onType($scope.searchParam);
                    }
                    else {
                        $scope.completing = false;
                        $scope.scanning = false;
                    }
                    if (newValue == '' && oldValue != '') {
                        $scope.$apply();
                    }
                }, delay);
            });

            var timeoutPromise;
            // starts scanning after typing in something
            $scope.$watch("suggestions", function () {
                if (timeoutPromise) $timeout.cancel(timeoutPromise);  //does nothing, if timeout already done
                timeoutPromise = $timeout(function () {   //Set timeout
                    if ($scope.scanning === true && $scope.suggestions.length === 1) {
                        //console.log('scanning promise:' + $scope.scanning);
                        $scope.select($scope.suggestions[0]);
                    }
                    else if ($scope.scanning === true && $scope.suggestions.length >= 2 && $scope.suggestions.length <= 3) //
                    {
                        var existsKeywords = $scope.suggestions.filter(function (s) { return s.barcode.trim() === $scope.searchParam.trim(); });
                        if (existsKeywords.length > 0) {
                            $scope.select(existsKeywords[0]);
                        }

                    }
                    $scope.scanning = false;
                }, 200); //50
            });

            // for hovering over suggestions
            this.preSelect = function (suggestion) {

                watching = false;

                // this line determines if it is shown
                // in the input field before it's selected:
                //$scope.searchParam = suggestion;

                $scopeApply();
                watching = true;

            };

            $scope.preSelect = this.preSelect;

            this.preSelectOff = function () {
                watching = true;
            };

            $scope.preSelectOff = this.preSelectOff;

            // selecting a suggestion with RIGHT ARROW or ENTER
            $scope.select = function (suggestion, isclearsearch) {
                if (suggestion) {
                    //$scope.searchParam = suggestion;
                    //$scope.searchParam = isclearsearch == true ? '' : suggestion.Name;
                    $scope.searchFilter = suggestion;
                    if ($scope.onSelect) {
                        $scope.onSelect(suggestion);
                        $ionicScrollDelegate.$getByHandle('searchItemsResult')._instances[1].scrollTop(true);
                    }
                }
                watching = false;
                $scope.completing = false;
                $scope.scanning = false;
                setTimeout(function () { watching = true; }, 50); //150
                $scope.setIndex(-1);
                $scope.searchParam = '';
                $scope.suggestions = [];
            };
        }],
        link: function (scope, element, attrs) {
            function $scopeApply() {
                if (scope.$root.$$phase != '$apply' && scope.$root.$$phase != '$digest') {
                    scope.$apply();
                }
            }

            var attr = '';

            // Default atts
            scope.attrs = {
                "placeholder": "start typing...",
                "class": "",
                "id": "",
                "inputclass": "",
                "inputid": ""
            };

            for (var a in attrs) {
                attr = a.replace('attr', '').toLowerCase();
                // add attribute overriding defaults
                // and preventing duplication
                if (a.indexOf('attr') === 0) {
                    scope.attrs[attr] = attrs[a];
                }
            }

            if (attrs.clickActivation) {
                element[0].onclick = function (e) {
                    if (!scope.searchParam) {
                        scope.completing = true;
                        $scopeApply();
                    }
                };
            }

            var keyupFiredCount = 0;
            function DelayExecution(f, delay) {
                var timer = null;
                return function () {
                    var context = this, args = arguments;

                    clearTimeout(timer);
                    timer = window.setTimeout(function () {
                        f.apply(context, args);
                    },
                    delay || 100);
                };
            }

            var key = { left: 37, up: 38, right: 39, down: 40, enter: 13, esc: 27, space: 32 };

            element[0].addEventListener("keyup", DelayExecution(function (e) {
                keyupFiredCount = keyupFiredCount + 1;
            }), true);

            element[0].addEventListener("blur", function (e) {
                keyupFiredCount = 0;
                // disable suggestions on blur
                // we do a timeout to prevent hiding it before a click event is registered
                setTimeout(function () {
                    scope.select();
                    scope.setIndex(-1);
                    $scopeApply();
                }, 300); //300
            }, true);

            element[0].addEventListener("keydown", function (e) {
                var keycode = e.keyCode || e.which;
                var l = angular.element(this).find('ion-item').length; //- 1;

                if (scope.searchParam === '') {
                    keyupFiredCount = 0;
                }

                // implementation of the up and down movement in the list of suggestions
                switch (keycode) {
                    case key.up:
                        index = scope.getIndex() - 1;
                        //if (index < -1) {
                        //    index = l - 1;
                        //} else if (index >= l) {
                        //    index = -1;
                        //    scope.setIndex(index);
                        //    scope.preSelectOff();
                        //    break;
                        //}
                        if (index < 0) {
                            index = 0;
                        }
                        else if (index > l - 1) {
                            index = l - 1;
                        }
                        scope.setIndex(index);

                        if (index !== -1) {
                            scope.preSelect(angular.element(angular.element(this).find('ion-item')[index]).text());
                            //var element = angular.element(this).find('li')[index];
                            //var height = angular.element(element).height() + 10;
                            var height = $(this).find('ion-item').height() + 10;
                            var ul = angular.element(this).find('ion-list')[0];
                            if (ul && height > 0 && index >= 0 && index < l - 1) { //ul.scrollTop = Math.max(ul.scrollTop - height, 0);
                                $ionicScrollDelegate.$getByHandle('searchItemsResult')._instances[1].scrollBy(0, -height, true);
                            }
                        }

                        $scopeApply();

                        break;
                    case key.down:
                        index = scope.getIndex() + 1;
                        //if (index < -1) {
                        //    index = l - 1;
                        //} else if (index >= l) {
                        //    index = -1;
                        //    scope.setIndex(index);
                        //    scope.preSelectOff();
                        //    $scopeApply();
                        //    break;
                        //}
                        if (index < 0) {
                            index = 0;
                        }
                        else if (index > l - 1) {
                            index = l - 1;
                        }
                        scope.setIndex(index);

                        if (index !== -1) {
                            scope.preSelect(angular.element(angular.element(this).find('ion-item')[index]).text());
                            //var height = angular.element(angular.element(this).find('li')[index]).height() + 10;
                            var height = $(this).find('ion-item').height() + 10;
                            var ul = angular.element(this).find('ion-list')[0];
                            if (ul && height > 0 && index > 0 && index < l - 1) { //ul.scrollTop = Math.min(ul.scrollTop + height, height * l);
                                $ionicScrollDelegate.$getByHandle('searchItemsResult')._instances[1].scrollBy(0, height, true);
                            }
                        }
                        break;
                    case key.left:
                        break;
                    case key.right:
                    case key.enter:
                        scope.scanning = false;
                        index = scope.getIndex();
                        //scope.preSelectOff();
                        if (index !== -1) {
                            //scope.select(scope.$eval(angular.element(angular.element(this).find('li')[index]).attr('val')), true);
                            scope.select(scope.suggestions[index]);
                        }
                        else {
                            if (scope.suggestions.length === 1) {
                                scope.select(scope.suggestions[0]);
                                //console.log('scanning:' + scope.scanning + ' keyupFiredCount:' + keyupFiredCount);
                                keyupFiredCount = 0;
                            }
                            else if ((keyupFiredCount <= 1) && (scope.searchParam && scope.searchParam !== '') && scope.searchParam.length >= 4) {
                                scope.scanning = true;
                                console.log('scanning:' + scope.scanning + ' keyupFiredCount:' + keyupFiredCount);
                                keyupFiredCount = 0;
                            }
                        }
                        scope.setIndex(-1);
                        $scopeApply();

                        break;
                    case key.space:
                        index = scope.getIndex();
                        break;
                    case key.esc:
                        // disable suggestions on escape
                        scope.select();
                        scope.setIndex(-1);
                        $scopeApply();
                        e.preventDefault();
                        break;
                    default:
                        return;
                }

                if (scope.getIndex() !== -1 || keycode == key.enter)
                    e.preventDefault();
            });

            var itemTemplate = $('#' + attrs.templateId).text();
            var arrTemplate = [];
            for (var i = 0; i < template.length; i++) {
                if (template[i] === '$AutocompleteTemplate$') {
                    arrTemplate.push(itemTemplate);
                }
                else {
                    arrTemplate.push(template[i]);
                }
            }

            //Compile Template
            element.append($compile(arrTemplate.join(''))(scope));
            //Focus Textbox
            //angular.element(element).find('input[type="text"]')[0].focus();
        }
        //templateUrl: ''
    };
}])

.directive('suggestion', function () {
    return {
        restrict: 'A',
        require: '^autocomplete', // ^look for controller on parents element
        link: function (scope, element, attrs, autoCtrl) {
            element.bind('mouseenter', function () {
                autoCtrl.preSelect(attrs.val);
                autoCtrl.setIndex(attrs.index);
            });

            element.bind('mouseleave', function () {
                autoCtrl.preSelectOff();
            });
        }
    };
});