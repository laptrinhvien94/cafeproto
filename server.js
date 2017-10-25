var connect = require('connect');
var serveStatic = require('serve-static');
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var streamify = require('gulp-streamify');
var ngAnnotate = require('gulp-ng-annotate');
var ejs = require("gulp-ejs");

var destFolder = './static/',
    destFile = 'bundle.js';

gulp.src([
    './lib/ionic/js/ionic.bundle.min.js',
    './lib/ionic/js/ionic-angular.min.js',
    './cordova.js',
    './js/jquery-2.2.3.min.js',
    './js/app.js',
    './js/factory.js',
    './js/controllers.js',
    './js/LoginController.js',
    './js/PosController.js',
    './js/printer.js',
    './js/encoder.js',
    './js/hotkeys.min.js',
    './lib/AngularJS-Toaster/toaster.min.js',
    './lib/ion-datetime-picker/release/ion-datetime-picker.min.js',
    './lib/socket.io-client/socket.io.js',
    './lib/angular-socket-io/socket.js',
])
    .pipe(ngAnnotate())
    .pipe(concat(destFile))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest(destFolder));


var randomNum = new Date().getTime();
gulp.src('./index.html')
    .pipe(ejs({
        rev: randomNum
    }))
    .pipe(gulp.dest('.'));

var winston = require('winston');
//winston.remove(winston.transports.Console);
winston.level = 'debug';
var logger = new (winston.Logger)({
    exitOnError: false,
    transports: [
        new (winston.transports.File)({
            name: 'debug-file',
            filename: './log/debug.log',
            level: 'debug'
        }),
        new (winston.transports.File)({
            name: 'error-file',
            filename: './log/error.log',
            level: 'error'
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: './log/exceptions.log' })
    ]
});

var devLogger = new (winston.Logger)({
    exitOnError: false,
    transports: [
        new (winston.transports.File)({
            name: 'debug',
            filename: './log/dev.log',
            level: 'debug'
        })
    ]
})

var devLog = function (logData) {
    devLogger.log('debug', logData);
}

var port = 8181;
var DEBUG = true;
var CACHE_TIME_OUT = 104400000;
var AUTH_URL = 'localhost:6985';
var https = require('http');
var querystring = require('querystring');
var cache = require('memory-cache');
var _ = require('underscore');
var uuid = require('uuid');

//initialize db
var MongoClient = require('mongodb').MongoClient
var db;
var io;
// Connection URL 
// var url = 'mongodb://172.16.1.3:27017/cafe?maxPoolSize=100';
//var url = 'mongodb://192.168.1.6:27017,192.168.1.8:27017/cafe?replicaSet=rs0&maxPoolSize=100';
var url = 'mongodb://127.0.0.1:27017/sunocafe?maxPoolSize=100';
// Use connect method to connect to the Server 

//Nhớ sửa dưới kia chỗ port và ở http
//AUTH_URL = 'auth.suno.vn';

MongoClient.connect(url, function (err, database) {
    if (err) console.log(err);
    db = database;
    //initialize socket
    var httpServer = require('http').createServer();
    httpServer.listen(port);
    io = require('socket.io')(httpServer);
    //io = require('socket.io').listen(connect().use(serveStatic(__dirname)).listen(port));

    io.sockets.on('connection', function (socket) {
        if (socket.handshake.query.room) {
            logDebug(socket.handshake.query.room);
            socket.join(socket.handshake.query.room);
            //socket.emit('getVersion', null);
        }
        socket.on('initShift', function (clientData) {
            //console.log('initShift', data);
            if (!clientData) return;
            doAuth(clientData, function (data) {
                try {
                    logDebug('initShift:');
                    // dirDebug(data);
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    // logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                        logDebug('exception...' + data);
                    }
                    else {
                        //update(id, data);
                        //debugger;
                        initShift(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });

        socket.on('updateOrder', function (data) {
            //debugger;
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    logDebug('updateOrder');
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        logDebug('exception...' + data);
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        //update(id, data);
                        updateOrder(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });
        socket.on('moveOrder', function (data) {
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    logDebug('updateOrder');
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        logDebug('exception...' + data);
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        moveOrder(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });

        socket.on('reconnectServer', function (data) {
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    var id = data.companyId.toString() + '_' + data.storeId.toString();
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        syncOfflineOrder(id, data);
                    }
                }
                catch (exception) {
                    data.ipAddress = socket.handshake.address;
                }
            })
        });

        socket.on('completeOrder', function (data) {
            //debugger;
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    logDebug('completeOrder:');
                    // dirDebug(data);
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        logDebug('exception...' + JSON.stringify(data));
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        completeOrder(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });
        socket.on('completeShift', function (data) {
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    logDebug('completeShift:');
                    // dirDebug(data);
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        logDebug('exception...' + JSON.stringify(data));
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        completeShift(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });
        socket.on('printHelper', function (data) {
            if (!data) return;
            doAuth(data, function (data) {
                try {
                    logDebug('printHelper:');
                    // dirDebug(data);
                    var id = '';
                    id = data.companyId + '_' + data.storeId;
                    logDebug(id);
                    if (id == '' || id == '_' || id == 'undefined_undefined') {
                        logDebug('exception...' + JSON.stringify(data));
                        //io.sockets.emit('exception', data);  
                        socket.emit('exception', { errorCode: 'invalidStore', data: data });
                    }
                    else {
                        printHelper(id, data);
                    }
                }
                catch (ex) {
                    data.ipAddress = socket.handshake.address;
                    logError(data, ex);
                }
            });
        });
        socket.on('version', function (data) {
            if (data.version == '2.0.0') {
                var noti = {
                    title: '<b>SUNO thông báo</b>',
                    content: '<p style="text-align: center;">Phiên bản hiện tại bạn đang dùng là phiên bản Cafe mới nhất.</p>',
                    type: 1, //1 alert, 2 noti.
                    action: 'logout',
                    isForce: true
                }
                socket.emit('notification', noti);
            }
        });

        //Lần đầu báo bếp revision là 1, các lần cập nhật sau thì revision tăng lên.

        //Hàm xử lý khi khởi tạo một shift mới hoặc tái kết nối với server.
        var initShift = function (id, data) {
            var shiftIdReq = data.shiftId;
            var shiftIdCur = null;
            var collection = db.collection('tableOrder');
            var history = db.collection('tableOrderHistory');
            var serverLog = db.collection('serverLog');
            var msg = {
                deviceID: data.info.deviceID,
                author: data.info.author,
                alteredOrder: [],
                lostOrder: []
            }; //Đơn hàng gửi lên và cái nào đã bị thay đổi.
            //Type của thông báo 1 gửi hết cho các client, 2 chỉ gửi cho client đó, 3 gửi cho các client khác ngoại trừ client đó.
            //Dưới client cứ check theo ai gửi cái nào đã bị thay đổi, clientID và phải của người đó ko? để thông báo.
            collection.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docs) {
                if (err) logError(err);
                history.find({ companyId: data.companyId, storeId: data.storeId, shiftId: data.shiftId }).toArray(function (errHis, docHis) {
                    if (errHis) logError(errHis);
                    serverLog.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (errLog, docsLog) {
                        if (errLog) logError(errLog);
                        //Giai đoạn 1: Chuẩn bị data
                        //Nếu trong collection tableOrder không có documents nào thuộc companyId và storeId (Trường hợp Init shift lần đầu tiên).
                        if (docs == null || docs == undefined || docs == [] || docs.length == 0) {
                            shiftIdCur = uuid.v4();
                            data.shiftId = shiftIdCur;
                            data.startDate = new Date();
                            collection.insert(data, function (err, doc) { if (err) logDebug('Error:' + err); else { logDebug('Result:'); dirDebug(doc); } });
                            history.insert(data, function (err, doc) { if (err) logDebug('Error:' + err); else { logDebug('Result:'); dirDebug(doc); } });
                            var companyLog = { companyId: data.companyId, storeId: data.storeId, logs: [] };
                            serverLog.insert(companyLog, function (err, doc) { if (err) logDebug('Error' + err); else { logDebug('Result:'); dirDebug(doc); } });
                        }
                        else {
                            //Gán shiftId hiện tại là shiftId trong collection tableOrder.
                            shiftIdCur = docs[0].shiftId;
                            //Nếu shiftId của Client trùng với ShiftId hiện tại.
                            if (data.tables && data.tables.length > 0 && shiftIdReq == shiftIdCur) {
                                if (!docs[0].tables || docs[0].tables.length == 0) docs[0].tables = [];
                                if (!docHis || !docHis[0] || !docHis[0].tables || docHis[0].tables.length == 0) docHis = [{ tables: [] }];

                                //Lặp qua từng bàn trong ds bàn mà Client gửi lên.
                                for (var i = 0; i < data.tables.length; i++) {
                                    //Nếu trong bàn đó không có đơn hàng thì chuyển qua bàn khác
                                    if (!data.tables[i].tableOrder || data.tables[i].tableOrder.length == 0) continue;

                                    //Lặp qua từng hóa đơn trong bàn đó.
                                    for (var j = 0; j < data.tables[i].tableOrder.length; j++) {
                                        var t = _.findWhere(docs[0].tables, { tableUuid: data.tables[i].tableUuid });
                                        var tHis = _.findWhere(docHis[0].tables, { tableUuid: data.tables[i].tableUuid });

                                        //Nếu bàn mà Client gửi lên có trong ds bàn trên Server.
                                        if (t) {
                                            var order = _.find(t.tableOrder, function (tb) { return tb.saleOrder && tb.saleOrder.saleOrderUuid == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });

                                            //Nếu đơn hàng Client gửi lên đang tồn tại trong ds đơn hàng trên Server thì cập nhật lại đơn hàng đó trên Server.
                                            //Việc cập nhật là merge dữ liệu giữa Client và Server không phải overwrite.
                                            if (order) {
                                                //Merge sharedWith
                                                var sWClient = data.tables[i].tableOrder[j].saleOrder.sharedWith.filter(function (item) {
                                                    return order.saleOrder.sharedWith.findIndex(function (i) {
                                                        return i.deviceID == item.deviceID && i.userID == item.userID;
                                                    }) < 0;
                                                });
                                                order.saleOrder.sharedWith = order.saleOrder.sharedWith.concat(sWClient);

                                                //Merge printed
                                                var printedClient = data.tables[i].tableOrder[j].saleOrder.printed.filter(function (item) {
                                                    return order.saleOrder.printed.findIndex(function (i) {
                                                        return i.saleOrder.timestamp == item.saleOrder.timestamp;
                                                    }) < 0;
                                                });
                                                order.saleOrder.printed = order.saleOrder.printed.concat(printedClient);

                                                if (order.saleOrder.revision == data.tables[i].tableOrder[j].saleOrder.revision && data.tables[i].tableOrder[j].saleOrder.logs.length == 0) {
                                                    //Order client đã được đồng bộ và phía client gửi lên không có thay đổi gì.
                                                    //Do nothing.
                                                }

                                                else if (order.saleOrder.revision == data.tables[i].tableOrder[j].saleOrder.revision && data.tables[i].tableOrder[j].saleOrder.logs.length > 0) {
                                                    //Order client đã được đồng bộ và phía client gửi lên có sự thay đổi.

                                                    //Cập nhật dữ liệu cho server và cập nhật luôn log.
                                                    order.saleOrder.orderDetails = data.tables[i].tableOrder[j].saleOrder.orderDetails;
                                                    data.tables[i].tableOrder[j].saleOrder.logs.forEach(function (log) {
                                                        order.saleOrder.logs.push(log);
                                                        log.status = true;
                                                    });

                                                    //Update revision
                                                    order.saleOrder.revision++;

                                                    //Thêm vào thông báo cho Client về sự thay đổi.
                                                    msg.alteredOrder.push({ tableName: t.tableName, orderID: order.saleOrder.saleOrderUuid, type: 3 });
                                                }

                                                else if (order.saleOrder.revision > data.tables[i].tableOrder[j].saleOrder.revision && data.tables[i].tableOrder[j].saleOrder.logs.length == 0) {
                                                    //Order client đã cũ nhưng phía client gửi lên không có sự thay đổi gì.
                                                    //Thêm vào thông báo cho Client về sự thay đổi.
                                                    msg.alteredOrder.push({ tableName: t.tableName, orderID: order.saleOrder.saleOrderUuid, type: 2 });
                                                }

                                                else if (order.saleOrder.revision > data.tables[i].tableOrder[j].saleOrder.revision && data.tables[i].tableOrder[j].saleOrder.logs.length > 0) {
                                                    //Order client đã cũ nhưng phía client gửi lên có sự thay đổi -> Xảy ra conflict.

                                                    if (!data.info.isUngroupItem) {

                                                        //Merge dữ liệu của client và server
                                                        //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                                        var errorFont = [];
                                                        var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                            return order.saleOrder.logs.findIndex(function (i) {
                                                                var rs = i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                                if (rs) { //Có thể xảy ra lỗi font trong socket tại đây.
                                                                    errorFont.push(i.itemID);
                                                                }
                                                                return rs;
                                                            }) < 0;
                                                        });
                                                        order.saleOrder.logs = order.saleOrder.logs.concat(orderClient);
                                                        //Dùng cách trên vì có trường hợp update lúc mất kết nối internet, nhưng khi kết nối lại thì server vẫn nhận đc tín hiệu của socket gửi lên nhưng ko emit lại để cập nhật xuống client.
                                                        //Sau khi có kết nối lại thì client auto reconnect lại gửi tiếp tục những log đó lên server.
                                                        //order.saleOrder.logs = order.saleOrder.logs.concat(data.tables[i].tableOrder[j].saleOrder.logs);

                                                        //B2: Tính toán lại số lượng dựa trên logs
                                                        var groupLog = groupBy(order.saleOrder.logs);

                                                        //B3: Cập nhật lại số lượng item
                                                        groupLog.forEach(function (log) {
                                                            var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                                return d.itemId == log.itemID;
                                                            });
                                                            if (log.totalQuantity > 0 && index < 0) {
                                                                //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                                var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                                order.saleOrder.orderDetails.push(itemDetail);
                                                            }
                                                            else if (log.totalQuantity > 0 && index >= 0) {
                                                                //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                                var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                                itemDetail.quantity = log.totalQuantity;
                                                                //Sửa lỗi font trong socket.
                                                                if (errorFont.length > 0) {
                                                                    var e = errorFont.find(function (eLog) { return eLog == itemDetail.itemId; });
                                                                    if (e) {
                                                                        var itemName = data.tables[i].tableOrder[j].saleOrder.logs.find(function (l) { return l.itemID == e }).itemName;
                                                                        itemDetail.itemName = itemName;
                                                                    }
                                                                }
                                                            }
                                                            else if (log.totalQuantity < 0 && index >= 0) {
                                                                //Nếu số lượng trong log < 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                                var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID });
                                                                order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                            }
                                                            else if (log.totalQuantity < 0 && index < 0) {
                                                                //Nếu số lượng trong log < 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                            }
                                                        });

                                                        //B4: Cập nhật status cho mỗi dòng log là đã cập nhật.
                                                        order.saleOrder.logs.forEach(function (log) {
                                                            if (!log.status) log.status = true;
                                                        });

                                                        //Update revision.
                                                        order.saleOrder.revision++;

                                                        //Thông báo cho client đã bị conflict.
                                                        //Thêm vào thông báo cho Client về sự thay đổi.
                                                        msg.alteredOrder.push({ tableName: t.tableName, orderID: order.saleOrder.saleOrderUuid, type: 1 });

                                                    } else {

                                                        //Điều chỉnh data cho phù hợp
                                                        //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                                        var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                            return order.saleOrder.logs.findIndex(function (i) {
                                                                return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID && i.detailID == item.detailID;
                                                            }) < 0;
                                                        });
                                                        var arr = order.saleOrder.logs.concat(orderClient);
                                                        order.saleOrder.logs = arr; //Cập nhật log cho server.

                                                        //B2: Tính toán lại số lượng dựa trên logs
                                                        var groupLog = groupByUngroupItem(order.saleOrder.logs);

                                                        //B3: Cập nhật lại số lượng item
                                                        groupLog.forEach(function (log) {
                                                            var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                                return d.itemId == log.itemID && d.detailID == log.detailID;
                                                            });
                                                            if (log.totalQuantity > 0 && index < 0) {
                                                                //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                                var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                                //Nếu item chưa có là parent thì push vào như bình thường.
                                                                if (!itemDetail.isChild) {
                                                                    order.saleOrder.orderDetails.push(itemDetail);
                                                                }
                                                                else { //Nếu item chưa có là child
                                                                    //Kiếm parent của item đó.
                                                                    var parentDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == itemDetail.parentID });
                                                                    //Push ngay bên dưới parent.
                                                                    order.saleOrder.orderDetails.splice(parentDetailIndex + 1, 0, itemDetail);
                                                                }
                                                            }
                                                            else if (log.totalQuantity > 0 && index >= 0) {
                                                                //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                                var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                                itemDetail.quantity = log.totalQuantity;
                                                            }
                                                            else if (log.totalQuantity <= 0 && index >= 0) {
                                                                //Nếu số lượng trong log <= 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                                var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                                order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                            }
                                                            else if (log.totalQuantity <= 0 && index < 0) {
                                                                //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                            }
                                                        });

                                                        //B4: Sắp xếp lại parent và child Item.
                                                        var parentItemList = order.saleOrder.orderDetails.filter(function (d) { return !d.isChild });
                                                        var addCount = 0;
                                                        var length = parentItemList.length;
                                                        for (var x = 0; x < length; x++) {
                                                            var pIndex = x + addCount;
                                                            var childItemList = order.saleOrder.orderDetails.filter(function (d) { return d.parentID && d.parentID == parentItemList[pIndex].detailID });
                                                            for (var y = childItemList.length - 1; y >= 0; y--) {
                                                                parentItemList.splice(pIndex + 1, 0, childItemList[y]);
                                                                addCount++;
                                                            }
                                                        }

                                                        order.saleOrder.orderDetails = parentItemList;

                                                        //B5: Cập nhật status cho mỗi dòng log là đã cập nhật.
                                                        order.saleOrder.logs.forEach(function (log) {
                                                            if (!log.status) log.status = true;
                                                        });

                                                        //Update revision.
                                                        order.saleOrder.revision++;

                                                        //Thông báo cho client đã bị conflict.
                                                        //Thêm vào thông báo cho Client về sự thay đổi.
                                                        msg.alteredOrder.push({ tableName: t.tableName, orderID: order.saleOrder.saleOrderUuid, type: 1 });

                                                    }
                                                }
                                                //t.tableOrder[t.tableOrder.indexOf(order)] = data.tables[i].tableOrder[j];
                                            }
                                            //Nếu order chưa tồn tại thì kiểm tra trong collection tableOrderHistory
                                            //- Có thì đơn hàng Client gửi lên không hợp lệ (Trường hợp đăng nhập cùng 1 tài khoản trên 2 thiết bị, thoát 1 thiết bị nhưng vẫn còn lưu ở DB Local)
                                            //- Không thì đưa đơn hàng vào ds đơn hàng trên Server.
                                            else if (!order) {
                                                var orderHis = null;
                                                if (tHis) orderHis = _.find(tHis.tableOrder, function (tbHis) { return tbHis.saleOrder && tbHis.saleOrder.saleOrderUuid == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });
                                                if (!orderHis) {
                                                    //Kiểm tra trong server logs xem có chuyển bàn hay đã ghép HD gì hay chưa?
                                                    var log = docsLog[0].logs.find(function (log) { return log.fromTableID == data.tables[i].tableUuid && log.fromOrderID == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });
                                                    //Nếu trong server logs có action chuyển bàn hoặc ghép HD.
                                                    if (log) {
                                                        var orderPlace = null;
                                                        if (log.action == 'CB') { //Chuyển bàn
                                                            //Lấy bàn đó trong ds bàn của server ra để kiểm tra
                                                            var tb = docs[0].tables.find(function (t) { return t.tableUuid == log.toTableID; });
                                                            if (tb) {
                                                                //Lấy order cần kiểm tra xong bàn đó xem còn hay không? (Có thể đã bị đổi hoặc ghép 1 hoặc n lần nữa.)
                                                                var curOrder = tb.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == log.toOrderID; });
                                                                //Nếu còn nghĩa là order đó ko có đổi hoặc ghép gì thêm.
                                                                if (curOrder) {
                                                                    ////Kiểm tra log và push đơn hàng vào cho phù hợp.
                                                                    ////Lặp qua từng dòng logs mà client gửi lên.
                                                                    //for (var x = 0; x < data.tables[i].tableOrder[j].saleOrder.logs.length; x++) {
                                                                    //    //Nếu thời gian action trong log thực hiện trc khi bàn được chuyển thì apply action đó vào order đó.
                                                                    //    if (data.tables[i].tableOrder[j].saleOrder.logs[x].timestamp < log.timestamp) {
                                                                    //        //Kiểm tra xem item đó đã có trong log hay chưa nếu chưa thì push vào, rồi thì cập nhật.
                                                                    //        var curDetailsIndex = curOrder.saleOrder.orderDetails.findIndex(function (i) { return i.itemId == data.tables[i].tableOrder[j].saleOrder.logs[x].itemID });
                                                                    //        if (curOrderIndex >= 0) {
                                                                    //            curOrder.saleOrder.orderDetails[curDetailsIndex].quantity += data.tables[i].tableOrder[j].saleOrder.logs[x].action == "BB" ? data.tables[i].tableOrder[j].saleOrder.logs[x].quantity :
                                                                    //                data.tables[i].tableOrder[j].saleOrder.logs[x].action == "H" ? -data.tables[i].tableOrder[j].saleOrder.logs[x].quantity : 0;
                                                                    //        }
                                                                    //        else {
                                                                    //            var detail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (i) { return i.itemId == log.itemID });
                                                                    //            detail.quantity = log.quantity;
                                                                    //            curOrder.saleOrder.orderDetails.push(detail);
                                                                    //        }
                                                                    //        //Kiểm tra nếu số lượng <=0 thì xóa khỏi ds detail của order đó.
                                                                    //        if (item.quantity <= 0) {
                                                                    //            curOrder.saleOrder.orderDetails.splice(curDetailsIndex, 1);
                                                                    //        }
                                                                    //    }
                                                                    //}
                                                                    orderPlace = {
                                                                        tableName: tb.tableName,
                                                                        tableID: tb.tableUuid,
                                                                        orderID: curOrder.saleOrder.saleOrderUuid
                                                                    };
                                                                }
                                                                else {
                                                                    var svLog = docsLog[0].logs;
                                                                    var tables = docs[0].tables;
                                                                    var tbID = data.tables[i].tableUuid;
                                                                    var oID = data.tables[i].tableOrder[j].saleOrder.saleOrderUuid;
                                                                    orderPlace = findOrder(svLog, tables, tbID, oID);
                                                                }
                                                            }
                                                        }
                                                        else if (log.action == 'G') { //Ghép hóa đơn
                                                            var tb = docs[0].tables.find(function (t) { return t.tableUuid == log.toTableID; });
                                                            orderPlace = {
                                                                tableName: tb.tableName,
                                                                tableID: tb.tableUuid,
                                                                orderID: log.toOrderID
                                                            };
                                                        }
                                                        
                                                        //Tạo đơn hàng mới với dữ liệu của order push lên để lưu tạm.
                                                        var storedOrder = clone(data.tables[i].tableOrder[j]);
                                                        storedOrder.saleOrder.saleOrderUuid = uuid.v1();
                                                        //Lưu lại trên đơn tên của người tạo và đổi tên thành lưu tạm.
                                                        storedOrder.saleOrder.note = storedOrder.saleOrder.createdByName;
                                                        storedOrder.saleOrder.createdByName = "LƯU TẠM - " + storedOrder.saleOrder.createdByName;
                                                        storedOrder.saleOrder.startTime = new Date();
                                                        storedOrder.saleOrder.logs.forEach(function (log) {
                                                            if (!log.status) log.status = true;
                                                        });
                                                        t.tableOrder.push(storedOrder);

                                                        //Thêm vào thông báo cho Client về sự thay đổi.
                                                        var notiLog = { tableName: data.tables[i].tableName, orderID: data.tables[i].tableOrder[j].saleOrder.saleOrderUuid, orderPlaceNow: orderPlace, action: log.action, type: 2 };
                                                        msg.lostOrder.push(notiLog);

                                                    }
                                                    else {
                                                        //Thêm vào collection tableOrder.
                                                        t.tableOrder.push(data.tables[i].tableOrder[j]);
                                                        logDebug('order is inserted');

                                                        //Cập nhật logs lại
                                                        data.tables[i].tableOrder[j].saleOrder.logs.forEach(function (log) {
                                                            if (!log.status) log.status = true;
                                                        });
                                                    }
                                                }
                                                else {
                                                    logDebug('order is completed or moved or deleted');
                                                }
                                            }
                                        }
                                        //Nếu bàn mà Client gửi lên chưa tồn tại trong danh sách bàn và đơn hàng trên Server thì thêm bàn đó vào ds. Trường hợp Init gửi tất cả bàn lên Server.
                                        else {
                                            docs[0].tables.push(data.tables[i]);
                                        }
                                    }
                                }

                                //Sau khi đã xử lý xong ds bàn và đơn hàng Client gửi lên thì cập nhật lại vào Collection TableOrder trên Server.
                                collection.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                    if (err) logDebug('Error:' + err);
                                });
                                //Gán lại data sẽ trả về cho Client bằng data trên Server sau xử lý.
                                data = docs[0];
                                //Thêm thông báo cho client.
                                data.msg = msg;
                            }
                            //Nếu shift mà Client gửi lên không trùng với shift hiện tại. Trường hợp Init hoặc lấy shiftId từ DB Local
                            else {
                                //Gán lại data sẽ trả về cho Client bằng data hiện tại trên Server.
                                data = docs[0];
                            }
                        }
                        //Giai đoạn 2: Trả data phù hợp về cho Client
                        //Chưa có shift nào 
                        if (shiftIdReq == '' || shiftIdReq == undefined || shiftIdReq == null) {
                            data.shiftId = shiftIdCur;
                            io.to(id).emit('initShift', data);
                        }
                        else {
                            //Thông tin shift không match. Trường hợp Client gửi lên shift cũ trong DB Local sau khi shift đó đã kết thúc.
                            if (shiftIdReq != shiftIdCur) {
                                socket.emit('exception', { errorCode: 'invalidShift', data: data });
                            }
                            //Cập nhật thông tin shift
                            else {
                                io.to(id).emit('initShift', data);
                            }
                        }
                    });
                });
            });
        };


        //GroupBy cho hàng hóa bình thường.
        var groupBy = function (arrLog) {
            var result = arrLog.reduce(function (arr, item) {
                var index = arr.findIndex(function (i) { return i.itemID == item.itemID });
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


        var time = 0;
        var findOrder = function (serverLog, tables, tableID, orderID) {
            var log = serverLog.find(function (l) { return l.fromTableID == tableID && l.fromOrderID == orderID });
            if (log) {
                var t = tables.find(function (t) { return t.tableUuid == log.toTableID });
                if (t) {
                    var order = t.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == orderID });
                    if (order) {
                        if (time > 0) time = 0;
                        return {
                            tableName: t.tableName,
                            tableID: tableID,
                            orderID: orderID
                        }
                    }
                    else {
                        if (time < 5) {
                            time++;
                            return findOrder(serverLog, tables, t.tableUuid, orderID);
                        }
                        else {
                            time = 0;
                            return null;
                        }
                    }
                }
                else {
                    if (time > 0) time = 0;
                    return null;
                }
            }
            else {
                if (time > 0) time = 0;
                return null;
            }
        }


        //Hàm xử lý khi client báo bếp, hủy món đã báo bếp, tách hóa đơn, ngưng tính thời gian,...
        var updateOrder = function (id, data) {
            var shiftIdCur = null;
            var shiftIdReq = data.shiftId;
            var collection = db.collection('tableOrder');
            var history = db.collection('tableOrderHistory');
            var msg = {
                deviceID: data.info.deviceID,
                author: data.info.author,
                alteredOrder: [],
                lostOrder: []
            }; //Đơn hàng gửi lên và cái nào đã bị thay đổi.
            //Type của thông báo 1 gửi hết cho các client, 2 chỉ gửi cho client đó, 3 gửi cho các client khác ngoại trừ client đó.
            collection.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docs) {
                if (err) logError(err);
                if (docs && docs.length > 0) {
                    shiftIdCur = docs[0].shiftId;
                    if (shiftIdReq == shiftIdCur) {
                        //Giai đoạn 1: Tính toán và cập nhật lại data trên DB Mongo
                        //Lặp qua từng bàn trong ds bàn mà Client gửi lên.
                        for (var i = 0; i < data.tables.length; i++) {

                            //Nếu trong bàn đó không có đơn hàng thì chuyển qua bàn khác
                            //Đối với các action như là báo bếp, hủy món đã báo bếp, ngưng tính giờ thì chỉ gửi lên 1 đơn hàng, còn action như tách hóa đơn thì gửi lên 2 đơn hàng.
                            if (!data.tables[i].tableOrder || data.tables[i].tableOrder.length == 0) continue;

                            var orderList = [];
                            //Lặp qua từng hóa đơn trong bàn đó.
                            for (var j = 0; j < data.tables[i].tableOrder.length; j++) {
                                var t = _.findWhere(docs[0].tables, { tableUuid: data.tables[i].tableUuid });
                                var order = _.find(t.tableOrder, function (tb) { return tb.saleOrder && tb.saleOrder.saleOrderUuid == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });

                                //Nếu đơn hàng Client gửi lên đang tồn tại trong ds đơn hàng trên Server thì cập nhật lại đơn hàng đó trên Server dựa vào logs.
                                if (order) {
                                    if (data.info.action == 'stopTimer' || data.info.action == 'renameOrder') {
                                        //Xử lý cho ngừng tính giờ item hoặc đổi tên đơn hàng lưu tạm.
                                        //detail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == data.info.itemID });
                                        order.saleOrder = data.tables[0].tableOrder[0].saleOrder;
                                        orderList.push(order);
                                    }
                                    else {
                                        //Merge sharedWith
                                        var sWClient = data.tables[i].tableOrder[j].saleOrder.sharedWith.filter(function (item) {
                                            return order.saleOrder.sharedWith.findIndex(function (s) {
                                                return s.deviceID == item.deviceID && s.userID == item.userID;
                                            }) < 0;
                                        });
                                        order.saleOrder.sharedWith = order.saleOrder.sharedWith.concat(sWClient);

                                        //Merge printed
                                        var printedClient = data.tables[i].tableOrder[j].saleOrder.printed.filter(function (item) {
                                            return order.saleOrder.printed.findIndex(function (p) {
                                                return p.saleOrder.timestamp == item.saleOrder.timestamp;
                                            }) < 0;
                                        });
                                        order.saleOrder.printed = order.saleOrder.printed.concat(printedClient);

                                        if (!data.info.isUngroupItem) { //Xử lý cho đơn hàng bình thường.

                                            //t.tableOrder[t.tableOrder.indexOf(order)] = data.tables[i].tableOrder[j];
                                            //Điều chỉnh data cho phù hợp
                                            //Luôn giữ log chỉ tính toán và cập nhật lại số lượng.
                                            //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                            var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                return order.saleOrder.logs.findIndex(function (i) {
                                                    return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                }) < 0;
                                            });
                                            var arr = order.saleOrder.logs.concat(orderClient);
                                            order.saleOrder.logs = arr; //Cập nhật log cho server.

                                            //B2: Tính toán lại số lượng dựa trên logs
                                            var groupLog = groupBy(order.saleOrder.logs);

                                            //B3: Cập nhật lại số lượng item
                                            groupLog.forEach(function (log) {
                                                var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                    return d.itemId == log.itemID;
                                                });
                                                if (log.totalQuantity > 0 && index < 0) {
                                                    //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                    var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                    order.saleOrder.orderDetails.push(itemDetail);
                                                }
                                                else if (log.totalQuantity > 0 && index >= 0) {
                                                    //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                    var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                    itemDetail.quantity = log.totalQuantity;
                                                }
                                                else if (log.totalQuantity <= 0 && index >= 0) {
                                                    //Nếu số lượng trong log <= 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                    var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID });
                                                    order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                }
                                                else if (log.totalQuantity <= 0 && index < 0) {
                                                    //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                }
                                            });

                                            //B4: Cập nhật status cho mỗi dòng log là đã cập nhật
                                            //Chỉ cập nhật đối với các action khác tách hóa đơn, vì tách hóa đơn thì các món trc đó đã đc server cập nhật log rồi và dưới client khi tách cũng set luôn là log = true.
                                            if (data.info.action !== 'splitOrder') {
                                                order.saleOrder.logs.forEach(function (log) {
                                                    if (!log.status) log.status = true;
                                                });
                                            }
                                        }
                                        else { //Xử lý cho đơn hàng tách món, kiểu trà sữa.
                                            //Điều chỉnh data cho phù hợp
                                            //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                            var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                return order.saleOrder.logs.findIndex(function (i) {
                                                    return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID && i.detailID == item.detailID;
                                                }) < 0;
                                            });
                                            var arr = order.saleOrder.logs.concat(orderClient);
                                            order.saleOrder.logs = arr; //Cập nhật log cho server.

                                            //B2: Tính toán lại số lượng dựa trên logs
                                            var groupLog = groupByUngroupItem(order.saleOrder.logs);

                                            //B3: Cập nhật lại số lượng item
                                            groupLog.forEach(function (log) {
                                                var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                    return d.itemId == log.itemID && d.detailID == log.detailID;
                                                });
                                                if (log.totalQuantity > 0 && index < 0) {
                                                    //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                    var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    //Nếu item chưa có là parent thì push vào như bình thường.
                                                    if (!itemDetail.isChild) {
                                                        order.saleOrder.orderDetails.push(itemDetail);
                                                    }
                                                    else { //Nếu item chưa có là child
                                                        //Kiếm parent của item đó.
                                                        var parentDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == itemDetail.parentID });
                                                        //Push ngay bên dưới parent.
                                                        order.saleOrder.orderDetails.splice(parentDetailIndex + 1, 0, itemDetail);
                                                    }
                                                }
                                                else if (log.totalQuantity > 0 && index >= 0) {
                                                    //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                    var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    itemDetail.quantity = log.totalQuantity;
                                                }
                                                else if (log.totalQuantity <= 0 && index >= 0) {
                                                    //Nếu số lượng trong log <= 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                    var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                    order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                }
                                                else if (log.totalQuantity <= 0 && index < 0) {
                                                    //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                }
                                            });

                                            //B4: Sắp xếp lại parent và child Item.
                                            var parentItemList = order.saleOrder.orderDetails.filter(function (d) { return !d.isChild });
                                            var addCount = 0;
                                            var length = parentItemList.length;
                                            for (var x = 0; x < length; x++) {
                                                var pIndex = x + addCount;
                                                var childItemList = order.saleOrder.orderDetails.filter(function (d) { return d.parentID && d.parentID == parentItemList[pIndex].detailID });
                                                for (var y = childItemList.length - 1; y >= 0; y--) {
                                                    parentItemList.splice(pIndex + 1, 0, childItemList[y]);
                                                    addCount++;
                                                }
                                            }

                                            order.saleOrder.orderDetails = parentItemList;

                                            //B5: Cập nhật status cho mỗi dòng log là đã cập nhật
                                            //Chỉ cập nhật đối với các action khác tách hóa đơn, vì tách hóa đơn thì các món trc đó đã đc server cập nhật log rồi và dưới client khi tách cũng set luôn là log = true.
                                            if (data.info.action !== 'splitOrder') {
                                                order.saleOrder.logs.forEach(function (log) {
                                                    if (!log.status) log.status = true;
                                                });
                                            }
                                        }

                                        //Cập nhật lại revision
                                        order.saleOrder.revision++;

                                        orderList.push(order);

                                        //Thêm thông báo về cho Client.
                                        msg.alteredOrder.push({ tableName: t.tableName, orderID: order.saleOrder.saleOrderUuid, type: 3 });
                                    }
                                } else {
                                    if (data.info.action !== 'stopTimer') {
                                        //Xử lý dành cho các trường hợp tách đơn hàng hoặc báo bếp lần đầu của order đó.. (update: báo bếp offline đã được initShift xử lý ở init hoặc reconnect).
                                        //Chỉ cập nhật đối với các action khác tách hóa đơn, vì tách hóa đơn thì các món trc đó đã đc server cập nhật log rồi.
                                        if (data.info.action !== 'splitOrder') {
                                            data.tables[i].tableOrder[j].saleOrder.logs.forEach(function (log) {
                                                log.status = true;
                                            });
                                        }
                                        //Không cần tính toán lại số lượng nữa vì khi mới báo bếp lần đầu của order đó số lượng đã được tính toán ở dưới Client rồi.
                                        t.tableOrder.push(data.tables[i].tableOrder[j]);
                                        //Revision lúc này của order mới báo bếp hoặc mới được tách đã được gán mặc định là 1 ở dưới client.
                                        orderList.push(data.tables[i].tableOrder[j]);
                                    }
                                    else {
                                        //Trường hợp chưa có Order trên server mà vẫn stopTimer đc có thể là do thao tác và kết nối Internet diễn ra đồng thời.
                                    }
                                }
                            }

                            //Gán lại data để trả về cho Client, gán xong thì reset lại mảng rỗng.
                            if (orderList.length > 0) {
                                data.tables[i].tableOrder = clone(orderList);
                                orderList = [];
                            }
                        }
                    }
                    //Sau khi đã xử lý xong ds bàn và đơn hàng Client gửi lên thì cập nhật lại vào Collection TableOrder trên Server.
                    collection.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) { if (err) logDebug('Error:' + err); });
                    //Giai đoạn 2: Trả về cho tất cả các client trừ client gửi lên.
                    //io.to(id).emit('broadcastOrders', data);
                    //socket.broadcast.to(id).emit('updateOrder', data);
                    //Trả về cho tất cả client
                    io.to(id).emit('updateOrder', data);
                }
                //Không khớp shiftId thì trả về exception
                else {
                    io.to(id).emit('exception', { errorCode: 'invalidShift', data: docs[0] });
                }
            });
        }

        //Hàm xử lý tái kết nối với Server của Client từ trạng thái Offline.
        var syncOfflineOrder = function (id, data) {
            initShift(id, data);
        }

        //Hàm xử lý khi hoàn tất đơn hàng hoặc xóa trống đơn hàng đã báo bếp.
        var completeOrder = function (id, data) {
            //debugger;
            var shiftIdReq = data.shiftId;
            var shiftIdCur;
            var tableOrder = db.collection('tableOrder');
            var history = db.collection('tableOrderHistory');
            var serverLog = db.collection('serverLog');
            var errorLog = db.collection('errorLog');
            var completed = [];
            var responseData = clone(data);
            // Find some documents 
            tableOrder.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docs) {
                serverLog.find({ companyId: data.companyId, storedId: data.storedId }).toArray(function (err, docsLog) {
                    //debugger;
                    if (err) { logError(err); return; }
                    if (docs && docs.length > 0) {
                        shiftIdCur = docs[0].shiftId;
                        //Nếu khớp shiftId thì cập nhật danh sách bàn và orders lại trên server.
                        if (shiftIdCur == shiftIdReq) {
                            if (data.tables && data.tables.length > 0) {
                                if (!docs[0].tables || docs[0].tables.length == 0) docs[0].tables = [];

                                //Lặp qua từng bàn mà client gửi lên.
                                for (var i = 0; i < data.tables.length; i++) {
                                    if (!data.tables[i].tableOrder || data.tables[i].tableOrder.length == 0) continue;

                                    //Lặp qua từng order của bàn đó.
                                    for (var j = 0; j < data.tables[i].tableOrder.length; j++) {
                                        var t = _.findWhere(docs[0].tables, { tableUuid: data.tables[i].tableUuid });
                                        var order = _.find(t.tableOrder, function (tb) { return tb.saleOrder && tb.saleOrder.saleOrderUuid == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });

                                        //Nếu có order đó đang tồn tại trên ds orders của server. Trường hợp ko tồn tại là dưới client thanh toán khi chưa báo bếp hoặc xóa trắng đơn hàng.
                                        if (order) {
                                            logDebug('completed order');

                                            //Merge sharedWith
                                            var sWClient = data.tables[i].tableOrder[j].saleOrder.sharedWith.filter(function (item) {
                                                return order.saleOrder.sharedWith.findIndex(function (i) {
                                                    return i.deviceID == item.deviceID && i.userID == item.userID;
                                                }) < 0;
                                            });
                                            order.saleOrder.sharedWith = order.saleOrder.sharedWith.concat(sWClient);

                                            if (data.info.action == 'clearItem') {
                                                if (!data.info.isUngroupItem) {
                                                    //Cập nhật lại log và số lượng đối với trường hợp xóa trống đơn hàng.
                                                    //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                                    var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                        return order.saleOrder.logs.findIndex(function (i) {
                                                            return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                        }) < 0;
                                                    });
                                                    var arr = order.saleOrder.logs.concat(orderClient);
                                                    order.saleOrder.logs = arr; //Cập nhật log cho server.

                                                    //B2: Tính toán lại số lượng dựa trên logs
                                                    var groupLog = groupBy(order.saleOrder.logs);

                                                    //B3: Cập nhật lại số lượng item
                                                    groupLog.forEach(function (log) {
                                                        var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                            return d.itemId == log.itemID;
                                                        });
                                                        if (log.totalQuantity > 0 && index < 0) {
                                                            //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                            var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                            order.saleOrder.orderDetails.push(itemDetail);
                                                        }
                                                        else if (log.totalQuantity > 0 && index >= 0) {
                                                            //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                            var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                            itemDetail.quantity = log.totalQuantity;
                                                        }
                                                        else if (log.totalQuantity <= 0 && index >= 0) {
                                                            //Nếu số lượng trong log <= 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                            var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID });
                                                            order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                        }
                                                        else if (log.totalQuantity <= 0 && index < 0) {
                                                            //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                        }
                                                    });

                                                    //B4: Cập nhật status cho mỗi dòng log là đã cập nhật
                                                    order.saleOrder.logs.forEach(function (log) {
                                                        if (!log.status) log.status = true;
                                                    });
                                                }
                                                else {
                                                    //Cập nhật lại log và số lượng đối với trường hợp xóa trống đơn hàng.
                                                    //B1: Merge log giữa client và server có distinct -> cập nhật lại log cho server.
                                                    var orderClient = data.tables[i].tableOrder[j].saleOrder.logs.filter(function (item) {
                                                        return order.saleOrder.logs.findIndex(function (i) {
                                                            return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                        }) < 0;
                                                    });
                                                    var arr = order.saleOrder.logs.concat(orderClient);
                                                    order.saleOrder.logs = arr; //Cập nhật log cho server.

                                                    //B2: Tính toán lại số lượng dựa trên logs
                                                    var groupLog = groupByUngroupItem(order.saleOrder.logs);

                                                    //B3: Cập nhật lại số lượng item
                                                    groupLog.forEach(function (log) {
                                                        var index = order.saleOrder.orderDetails.findIndex(function (d) {
                                                            return d.itemId == log.itemID && d.detailID == log.detailID;
                                                        });
                                                        if (log.totalQuantity > 0 && index < 0) {
                                                            //Nếu số lượng trong log > 0 và item chưa có trong ds order của server thì thêm vào danh sách details
                                                            var itemDetail = data.tables[i].tableOrder[j].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                            //Nếu item chưa có là parent thì push vào như bình thường.
                                                            if (!itemDetail.isChild) {
                                                                order.saleOrder.orderDetails.push(itemDetail);
                                                            }
                                                            else { //Nếu item chưa có là child
                                                                //Kiếm parent của item đó.
                                                                var parentDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == itemDetail.parentID });
                                                                //Push ngay bên dưới parent.
                                                                order.saleOrder.orderDetails.splice(parentDetailIndex + 1, 0, itemDetail);
                                                            }
                                                        }
                                                        else if (log.totalQuantity > 0 && index >= 0) {
                                                            //Nếu số lượng trong log > 0 và item đã có trong ds order của server thì cập nhật lại số lượng
                                                            var itemDetail = order.saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                            itemDetail.quantity = log.totalQuantity;
                                                        }
                                                        else if (log.totalQuantity <= 0 && index >= 0) {
                                                            //Nếu số lượng trong log <= 0 và item đã có trong ds order của server thì xóa item đó đi khỏi danh sách details
                                                            var itemDetailIndex = order.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                            order.saleOrder.orderDetails.splice(itemDetailIndex, 1);
                                                        }
                                                        else if (log.totalQuantity <= 0 && index < 0) {
                                                            //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                        }
                                                    });

                                                    //B4: Sắp xếp lại parent và child Item.
                                                    var parentItemList = order.saleOrder.orderDetails.filter(function (d) { return !d.isChild });
                                                    var addCount = 0;
                                                    var length = parentItemList.length;
                                                    for (var x = 0; x < length; x++) {
                                                        var pIndex = x + addCount;
                                                        var childItemList = order.saleOrder.orderDetails.filter(function (d) { return d.parentID && d.parentID == parentItemList[pIndex].detailID });
                                                        for (var y = childItemList.length - 1; y >= 0; y--) {
                                                            parentItemList.splice(pIndex + 1, 0, childItemList[y]);
                                                            addCount++;
                                                        }
                                                    }

                                                    order.saleOrder.orderDetails = parentItemList;

                                                    //B5: Cập nhật status cho mỗi dòng log là đã cập nhật
                                                    order.saleOrder.logs.forEach(function (log) {
                                                        if (!log.status) log.status = true;
                                                    });
                                                }
                                            }

                                            //Xóa order đó ra khỏi ds orders trên server.
                                            t.tableOrder.splice(t.tableOrder.indexOf(order), 1);
                                            //Lấy thông tin cho history
                                            var tbs = _.find(completed, function (tb) { return tb && tb.tableUuid == data.tables[i].tableUuid });
                                            if (!tbs) {
                                                tbs = {
                                                    tableUuid: data.tables[i].tableUuid,
                                                    tableId: data.tables[i].tableId,
                                                    tableIdInZone: data.tables[i].tableIdInZone,
                                                    tableName: data.tables[i].tableName,
                                                    tableZone: data.tables[i].tableZone,
                                                    tableStatus: data.tables[i].tableStatus,
                                                    tableOrder: []
                                                };
                                                completed.push(tbs);
                                            }
                                            tbs.tableOrder.push(order);

                                            //Cập nhật trong serverLog.
                                            if (docsLog[0].logs.length > 0) {
                                                var logs = docsLog[0].logs.filter(function (log) { return log.fromOrderID == order.saleOrder.saleOrderUuid || log.toOrderID == order.saleOrder.saleOrderUuid });
                                                logs.forEach(function (log) {
                                                    var index = docsLog[0].logs.indexOf(log);
                                                    docsLog[0].logs.splice(index, 1);
                                                });
                                            }

                                            //Cập nhật lại dữ liệu trả về cho Client.
                                            responseData.tables[0].tableOrder[0] = order;
                                        }
                                    }
                                }

                                //Xử lý xong hết thì cập nhật lại
                                tableOrder.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                    if (err) logDebug('Error:' + err);
                                });
                                serverLog.update({ companyId: data.companyId, storedId: data.storedId }, { $set: { logs: docsLog[0].logs } }, { w: 1 }, function (err, result) {
                                    if (err) logDebug('Error:' + err);
                                });
                                data = docs[0];
                            }
                            else {
                                data = docs[0];
                            }
                        }
                    }

                    //Nếu shift ko khớp thì gửi về exception cho client. 
                    //Trường hợp client treo máy nhưng ko tắt browser (vd: Sleep) dẫn đến không reload được và sau đó submit order lên server.
                    if (shiftIdCur != shiftIdReq) {
                        socket.emit('exception', { errorCode: 'invalidShift', data: docs[0] });
                    }
                    else {
                        //Gửi về cho tất cả các clients trong room.
                        //socket.broadcast.to(id).emit('completeOrder', responseData);
                        io.to(id).emit('completeOrder', responseData);
                        //Cập nhật thông tin history
                        if (completed.length > 0) {
                            history.find({ companyId: data.companyId, storeId: data.storeId, shiftId: shiftIdCur }).toArray(function (err, docs) {
                                if (err) logError(err);
                                if (!docs || docs.length == 0 || !docs[0]) {
                                    docs = [];
                                    docs[0] = data;
                                    docs[0].tables = [];
                                    history.insert(docs[0], function (err, doc) {
                                        if (err) logDebug('Error:' + err);
                                    });
                                };
                                if (!docs[0].tables) docs[0].tables = [];
                                for (var i = 0; i < completed.length; i++) {
                                    var tb = _.find(docs[0].tables, function (tb) { return tb.tableUuid == completed[i].tableUuid });
                                    if (tb) {
                                        for (var r = 0; r < completed[i].tableOrder.length; r++) {
                                            tb.tableOrder.push(completed[i].tableOrder[r]);
                                        }
                                    }
                                    else {
                                        docs[0].tables.push(completed[i]);
                                    }
                                }
                                history.update({
                                    companyId: data.companyId, storeId: data.storeId,
                                    shiftId: shiftIdCur
                                }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                    if (err) logDebug('Error:' + err);
                                });
                            });
                        }
                    }
                });
            });
        };

        //Hàm xử lý thực hiện đổi bàn, ghép hóa đơn.
        //Dưới Client gửi lên chỉ gửi bàn được đổi/ghép và hóa đơn được đổi/ghép.
        var moveOrder = function (id, data) {
            var shiftIdReq = data.shiftId;
            var shiftIdCur;
            var tableOrder = db.collection('tableOrder');
            var history = db.collection('tableOrderHistory');
            var serverLog = db.collection('serverLog');
            var errorLog = db.collection('errorLog');
            var completed = [];
            var responseData = clone(data);
            // Find some documents 
            tableOrder.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docs) {
                serverLog.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docsLog) {
                    if (err) {
                        logError(err);
                        return;
                    }
                    if (docs && docs.length > 0) {
                        shiftIdCur = docs[0].shiftId;
                        if (data.tables && data.tables.length > 0 && shiftIdReq == shiftIdCur) {
                            // Tim order xoa order o ban cu
                            if (!docs[0].tables || docs[0].tables.length == 0) docs[0].tables = [];
                            var t = _.findWhere(docs[0].tables, { tableUuid: data.fromTableUuid });
                            //Kiểm tra xem bàn nguồn (fromTableuuid) có tồn tại trên server hay ko?
                            if (t) {
                                var order = _.find(t.tableOrder, function (tb) { return tb.saleOrder && tb.saleOrder.saleOrderUuid == data.fromSaleOrderUuid });
                                dirDebug(order);
                                //Nếu order nguồn (fromSaleOrderUuid) có tồn tại trên ds orders của server thì xóa order đó ra khỏi danh sách
                                if (order) {
                                    logDebug('completed order');
                                    t.tableOrder.splice(t.tableOrder.indexOf(order), 1);
                                    //Lấy thông tin cho history
                                    var tbs = _.find(completed, function (tb) { return tb && tb.tableUuid == data.tables[0].tableUuid });
                                    if (!tbs) {
                                        tbs = {
                                            tableUuid: data.tables[0].tableUuid,
                                            tableId: data.tables[0].tableId,
                                            tableIdInZone: data.tables[0].tableIdInZone,
                                            tableName: data.tables[0].tableName,
                                            tableZone: data.tables[0].tableZone,
                                            tableStatus: data.tables[0].tableStatus,
                                            tableOrder: []
                                        };
                                        completed.push(tbs);
                                    }
                                    tbs.tableOrder.push(order);
                                }
                            }

                            tableOrder.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });

                            // Cap nhat order cho ban moi
                            logDebug('compare');
                            if (!docs[0].tables || docs[0].tables.length == 0) docs[0].tables = [];
                            for (var i = 0; i < data.tables.length; i++) {
                                logDebug('tableOrder[' + i + ']:');
                                dirDebug(data.tables[i].tableOrder);
                                if (!data.tables[i].tableOrder || data.tables[i].tableOrder.length == 0) continue;
                                logDebug('tableOrder[' + i + '].length:', data.tables[i].tableOrder.length);
                                for (var j = 0; j < data.tables[i].tableOrder.length; j++) {
                                    //Tìm bàn trên trong danh sách bàn trên server trùng với bàn mà client gửi lên.
                                    var t = _.findWhere(docs[0].tables, { tableUuid: data.tables[i].tableUuid });
                                    logDebug('t:');
                                    dirDebug(t);

                                    if (t) {
                                        //Tìm order trên trong ds order trên server trùng với ds orders mà client gửi lên của bàn đó
                                        var order = _.find(t.tableOrder, function (tb) { return tb.saleOrder && tb.saleOrder.saleOrderUuid == data.tables[i].tableOrder[j].saleOrder.saleOrderUuid });
                                        logDebug('order:');
                                        dirDebug(order);
                                        //Cập nhật hoặc thêm vào ds order của bàn đó
                                        if (order) {
                                            //Trường hợp ghép hóa đơn.
                                            //Chỉ xảy ra khi client có kết nối internet, dưới client đã xử lý log.
                                            var index = t.tableOrder.indexOf(order);
                                            t.tableOrder[index] = data.tables[i].tableOrder[j];
                                            //Cập nhật lại revision
                                            t.tableOrder[index].saleOrder.revision++;
                                            responseData.tables[0].tableOrder[0].saleOrder.revision++;
                                            logDebug('order is updated');
                                        }
                                        else {
                                            //Trường hợp đổi bàn
                                            //Chỉ xảy ra khi client có kết nối internet, dưới client đã xử lý log và revision đc đặt mặc định là 1.

                                            t.tableOrder.push(data.tables[i].tableOrder[j]);
                                            logDebug('order is inserted');
                                        }

                                        //Cập nhật serverlog.
                                        var log = {
                                            timestamp: data.info.timestamp,
                                            deviceID: data.info.deviceID,
                                            author: data.info.author,
                                            fromTableID: data.fromTableUuid,
                                            fromOrderID: data.fromSaleOrderUuid,
                                            toTableID: data.tables[i].tableUuid,
                                            toOrderID: data.tables[i].tableOrder[j].saleOrder.saleOrderUuid,
                                            action: data.info.action
                                        };

                                        docsLog[0].logs.push(log);
                                        serverLog.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { logs: docsLog[0].logs } }, { w: 1 }, function (err, result) {
                                            if (err) logDebug('Error:' + err);
                                        });
                                    }
                                    else {
                                        docs[0].tables.push(data.tables[i]);
                                        logDebug('tableOrder is inserted');
                                    }
                                }
                            }
                            //Cập nhật lại dữ liệu sau khi xử lý xong.
                            tableOrder.update({ companyId: data.companyId, storeId: data.storeId }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });
                            data = docs[0];
                        }
                        else {
                            data = docs[0];
                        }
                    }

                    logDebug('shiftIdReq :' + shiftIdReq + ' shiftIdCur : ' + shiftIdCur + ' result = ' + (shiftIdReq == shiftIdCur));
                    //Thông tin shift không match
                    if (!shiftIdReq || !shiftIdCur || shiftIdReq != shiftIdCur) {
                        logDebug('exception, request shiftId ' + shiftIdReq + ' does not match with current ' + shiftIdCur + ' tableOrder: ' + data);
                        //io.to(id).emit('exception', data);
                        socket.emit('exception', { errorCode: 'invalidShift', data: data });
                    }
                    //Cập nhật thông tin shift
                    else {
                        logDebug('broadcastOrders' + JSON.stringify(data));
                        //io.to(id).emit('broadcastOrders', data);
                        ////Chỉ gửi trả về cho các client khác vì client gửi lên đã được xử lý toàn bộ dưới client.
                        io.to(id).emit('moveOrder', responseData);
                    }
                    //Cập nhật thông tin history
                    logDebug('completed length:' + completed.length);
                    dirDebug(completed);
                    if (completed.length > 0) {
                        history.find({ companyId: data.companyId, storeId: data.storeId, shiftId: shiftIdCur }).toArray(function (err, docs) {
                            if (err) logError(err);
                            if (!docs || docs.length == 0 || !docs[0]) {
                                docs = [];
                                docs[0] = data;
                                docs[0].tables = [];
                                history.insert(docs[0], function (err, doc) {
                                    if (err) logDebug('Error:' + err);
                                });
                            };
                            if (!docs[0].tables) docs[0].tables = [];
                            logDebug('hisDocs');
                            dirDebug(docs[0]);
                            for (var i = 0; i < completed.length; i++) {
                                var tb = _.find(docs[0].tables, function (tb) { return tb.tableUuid == completed[i].tableUuid });
                                if (tb) {
                                    logDebug('history updated');
                                    tb.tableOrder.push(completed[i].tableOrder);
                                }
                                else {
                                    logDebug('history inserted');
                                    docs[0].tables.push(completed[i]);
                                }
                            }
                            logDebug('hisDocs updated');
                            dirDebug(docs[0]);
                            history.update({
                                companyId: data.companyId, storeId: data.storeId,
                                shiftId: shiftIdCur
                            }, { $set: { tables: docs[0].tables } }, { w: 1 }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });
                        });
                    }
                });
            });
        };

        //Hàm xử lý khi kết ca
        var completeShift = function (id, data) {
            var shiftIdReq = data.shiftId;
            var shiftIdCur;
            var tableOrder = db.collection('tableOrder');
            var serverLog = db.collection('serverLog');
            var history = db.collection('tableOrderHistory');
            // Find some documents 
            tableOrder.find({ companyId: data.companyId, storeId: data.storeId }).toArray(function (err, docs) {
                serverLog.find({ companyId: data.companyId, storeId: data.storedId }).toArray(function (err, docsLog) {
                    if (docs && docs.length > 0) {
                        shiftIdCur = docs[0].shiftId;
                        if (shiftIdReq == shiftIdCur) {
                            //Xóa shift khỏi danh sách shift hiện tại trên server.
                            tableOrder.remove({ companyId: data.companyId, storeId: data.storeId }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });
                            //Xóa serverLog khỏi danh sách serverLog hiện tại trên server.
                            serverLog.remove({ companyId: data.companyId, storeId: data.storeId }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });
                            var now = new Date();
                            //Cập nhật shift vào history để kiểm tra lại khi cần.
                            history.update({ companyId: data.companyId, storeId: data.storeId, shiftId: shiftIdCur }, { $set: { finishDate: now } }, { w: 1 }, function (err, result) {
                                if (err) logDebug('Error:' + err);
                            });
                        }
                        else {
                            logDebug('exception');
                        }
                    }
                    else {
                        logDebug('exception');
                    }
                    logDebug('shiftIdReq :' + shiftIdReq + ' shiftIdCur : ' + shiftIdCur + ' result = ' + (shiftIdReq == shiftIdCur));
                    //Thông tin shift không match
                    if (!shiftIdReq || !shiftIdCur || shiftIdReq != shiftIdCur) {
                        logDebug('exception, request shiftId ' + shiftIdReq + ' does not match with current ' + shiftIdCur + ' tableOrder: ' + data);
                        //io.to(id).emit('exception', data); 
                        socket.emit('exception', { errorCode: 'invalidShift', data: data });
                    }
                    //Cập nhật thông tin shift
                    else {
                        logDebug('completeShift' + JSON.stringify(data));
                        //io.to(id).emit('broadcastOrders', data); 
                        io.to(id).emit('completeShift', data);
                    }
                });
            });
        };

        var printHelper = function (id, data) {
            socket.broadcast.to(id).emit('printHelper', data);
        };

        //Hàm xử lý kiểm tra Authentication và Authorization.
        var doAuth = function (data, callback) {
            if (!data || !data.clientId) {
                socket.emit('exception', { errorCode: 'unauthorizedClientId', data: data });
                return;
            }
            var userSession = cache.get(data.clientId);
            if (!userSession) {
                performRequest(AUTH_URL, '/api/provider/GetUserSession', 'GET', { clientId: data.clientId, format: 'json' },
                    function (res) {
                        if (!res) return;
                        if (data.companyId && res.userSession && res.userSession.companyId == data.companyId) {
                            cache.put(data.clientId, res.userSession, CACHE_TIME_OUT);
                            callback(data);
                        }
                        else {
                            logDebug('unauthorized clientId' + data.clientId);
                        }
                    },
                    function (error) {
                        console.log(error);
                        logDebug(error);
                        socket.emit('exception', { errorCode: 'badRequest', data: data });
                    }
                );
            }
            else {
                if (data.companyId && userSession.companyId == data.companyId) callback(data);
            }
        };

        var performRequest = function (host, endpoint, method, data, success, error) {
            var dataString = JSON.stringify(data);
            var headers = {};

            if (method == 'GET') {
                endpoint += '?' + querystring.stringify(data);
            }
            else {
                headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': dataString.length
                };
            }
            var options = {
                //host: host,
                port: 6985,
                path: endpoint,
                method: method,
                headers: headers
            };
            var req = https.request(options, function (res) {
                res.setEncoding('utf-8');
                var responseString = '';

                res.on('data', function (data) {
                    responseString += data;
                });

                res.on('end', function () {
                    try {
                        logDebug(responseString);
                        var responseObject = JSON.parse(responseString);
                        success(responseObject);
                    }
                    catch (ex) {
                        error(ex);
                    }
                });
            });

            req.write(dataString);
            req.end();
        }
    });


    var clone = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    var logError = function (data, err) {
        var error = {
            companyId: data.companyId,
            storeId: data.storeId,
            clientId: data.clientId,
            ipAddress: data.ipAddress,
            errorTime: new Date(),
            errorMessage: err.message,
            sourceData: JSON.stringify(data)
        };
        var errorLog = db.collection('errorLog');
        errorLog.insert(error, function (err) {
            logger.error(err);
        });
    };

    var logDebug = function (data) {
        if (DEBUG) logger.log('debug', data);
    };

    var dirDebug = function (data) {
        if (DEBUG) logger.log('debug', data);
    };

    db.createCollection('tableOrder', function (err, collection) {
        if (err) logError(err);
    });
    db.createCollection('tableOrderHistory', function (err, history) {
        if (err) logError(err);
    });
    db.createCollection('serverLog', function (err, history) {
        if (err) logError(err);
    });
    db.createCollection('errorLog', function (err, errorLog) {
        if (err) logError(err);
    });

    //Clear cache
    cache.clear();

    logger.log('debug', "Connected correctly to server");
    logger.log('debug', "Listening on port " + port);
    logger.log('debug', 'Suno Cafe started.')
});