angular.module('sunoPos.factory', [])

.factory('LSFactory', [function () {
    var LSAPI = {
        clear: function () {
            return localStorage.clear();
        },
        get: function (key) {
            return JSON.parse(localStorage.getItem(key));
        },
        set: function (key, data) {
            return localStorage.setItem(key,
                JSON.stringify(data));
        },
        delete: function (key) {
            return localStorage.removeItem(key);
        }
    };
    return LSAPI;
}])

.factory('AuthFactory', ['LSFactory', function (LSFactory) {
    var userKey = 'user';
    var tokenKey = 'token';
    var refreshTokenKey = 'rftoken';
    var client = 'clientId';
    var accKey = 'account';
    var settingKey = 'setting';
    var storeKey = 'store';
    var bootloader = 'bootloader';
    var sessionKey = 'session';

    var AuthAPI = {
        isLoggedIn: function () {
            return this.getUser() === null ? false : true;
        },
        getStoreList: function () {
            return LSFactory.get(storeKey);
        },
        setStoreList: function (store) {
            return LSFactory.set(storeKey, store);
        },
        getBootloader: function () {
            return LSFactory.get(bootloader);
        },
        setBootloader: function (data) {
            return LSFactory.set(bootloader, data);
        },
        getSetting: function () {
            return LSFactory.get(settingKey);
        },
        setSetting: function (setting) {
            return LSFactory.set(settingKey, setting);
        },
        getUser: function () {
            return LSFactory.get(userKey);
        },
        setUser: function (user) {
            return LSFactory.set(userKey, user);
        },
        getAccount: function () {
            return LSFactory.get(accKey);
        },
        setAccount: function (acc) {
            return LSFactory.set(accKey, acc);
        },
        getToken: function () {
            return LSFactory.get(tokenKey);
        },
        setToken: function (token) {
            return LSFactory.set(tokenKey, token);
        },
        setSessionId: function (session) {
            return LSFactory.set(sessionKey, session);
        },
        getSessionId: function () {
            return LSFactory.get(sessionKey);
        },
        deleteAuth: function () {
            LSFactory.delete(userKey);
            LSFactory.delete(tokenKey);
            LSFactory.delete(accKey);
            LSFactory.delete(settingKey);
            LSFactory.delete(bootloader);
            LSFactory.delete(storeKey);
        }
    };
    return AuthAPI;
}])

.factory('$PouchDB', [function () {
    ////Create instances of PouchDB.
    ////First DB for Table structure and Orders.
    //var DBTables = new PouchDB("SunoCafe_Tables", { adapter: 'idb', revs_limit: 1 });

    ////Create indexes
    //Promise.all([
    //    DBTables.createIndex({ index: { fields: ['store'] } }),
    //    DBTables.createIndex({ index: { fields: ['tableId'] } }),
    //    DBTables.createIndex({ index: { fields: ['store', 'tableId'] } }),
    //    DBTables.createIndex({ index: { fields: ['store', 'tableUuid'] } }),
    //    DBTables.createIndex({ index: { fields: ['store', 'tableId', 'tableUuid'] } })
    //]).then(function (result) {
    //    //log for debug if catch error when creating Index.
    //    //console.log(result);
    //});

    ////Export API Object
    //var pDBAPI = {
    //    DBTables: DBTables,
    //    DBSettings: DBSettings
    //};

    //Public PouchDB API.
    //API with 2 parameters are 2 callback functions, that take 1 argument.
    //Get information about DB.
    PouchDB.prototype.getDBInfo = function (success, error) {
        var pDB = this;
        pDB.info()
            .then(success)
            .catch(error);
    };

    //Close any opening connection to the underlying storage.
    PouchDB.prototype.closeDB = function (success) { //, error){
        var pDB = this;
        pDB.close()
            .then(success);
    };

    //Get all documents.
    PouchDB.prototype.getAllDocs = function (success, error) {
        var pDB = this;
        pDB.allDocs({ include_docs: true })
            .then(success)
            .catch(error);
    };

    //Get document by id.
    PouchDB.prototype.getDocByID = function (doc, success, error) {
        var pDB = this;
        pDB.find({
            selector: {
                _id: doc._id
            },
            sort: ['_id']
        })
        .then(success)
        .catch(error);
    };

    //Remove document by id.
    PouchDB.prototype.removeDoc = function (doc, success, error) {
        var pDB = this;
        pDB.get(doc._id)
            .then(function (doc) {
                return pDB.remove(doc);
            })
            .then(success)
            .catch(error);
    };

    //Add document.
    PouchDB.prototype.addDoc = function (doc, success, error) {
        var pDB = this;
        pDB.put(doc)
            .then(success)
            .catch(error);
    };

    //Update document by id
    PouchDB.prototype.updateDoc = function (doc, success, error) {
        var pDB = this;
        pDB.get(doc._id)
            .then(function (data) {
                //doc._id = data._id;
                doc._rev = data._rev;
                return pDB.put(doc);
            })
            .then(success)
            .catch(error);
    };

    //Add/Update/Delete batch documents
    PouchDB.prototype.manipulateBatchDoc = function (arrayDocs, success, error) {
        var pDB = this;
        pDB.bulkDocs(arrayDocs)
            .then(function (data) {
                //returned Data includes both of successful and failed data -> validate and throw exception.
                var errorList = [];
                data.forEach(function (item) { if (item.status == 409) errorList.push(item); });
                if (errorList.length == 0) success(data);
                else throw errorList;
            })
            .catch(error);
    };

    //Query document
    PouchDB.prototype.queryDoc = function (queryObj, success, error) {
        var pDB = this;
        pDB.find(queryObj)
            .then(success)
            .catch(error);
    };

    //API return a Promise for chaining purpose.
    //Get information about DB.
    PouchDB.prototype.$getDBInfo = function () {
        var pDB = this;
        return pDB.info();
    };

    //Close any open connection to the underlying storage.
    PouchDB.prototype.$closeDB = function () {
        var pDB = this;
        return pDB.close();
    };

    //Get all documents.
    PouchDB.prototype.$getAllDocs = function () {
        var pDB = this;
        return pDB.allDocs({ include_docs: true });
    };

    //Get document by id.
    PouchDB.prototype.$getDocByID = function (doc) {
        var pDB = this;
        return pDB.find({ selector: { _id: doc._id } }); //, sort: ['_id'] })
    };

    //Remove document by id.
    PouchDB.prototype.$removeDoc = function (doc) {
        var pDB = this;
        return pDB.get(doc._id)
            .then(function (success) {
                return pDB.remove(success);
            })
            .catch(function (error) {
                return error;
            });
    };

    //Add document.
    PouchDB.prototype.$addDoc = function (doc) {
        var pDB = this;
        return pDB.put(doc);
    };

    //Update document by id
    PouchDB.prototype.$updateDoc = function (doc) {
        var pDB = this;
        return pDB.get(doc._id)
            .then(function (data) {
                doc._rev = data._rev;
                return pDB.put(doc);
            });
    };

    //Add/Update/Delete batch documents
    PouchDB.prototype.$manipulateBatchDoc = function (arrayDocs) {
        var pDB = this;
        return pDB.bulkDocs(arrayDocs);
    }

    //Query document
    PouchDB.prototype.$queryDoc = function (queryObj) {
        var pDB = this;
        return pDB.find(queryObj);
    }
    return PouchDB;
}])

.factory('SunoPouchDB', ['$PouchDB', function ($PouchDB) {
    //Singleton instance of DB settings.
    var DBSettings = new PouchDB("SunoCf_Settings", { adapter: 'idb', revs_limit: 1 });
    return {
        getPouchDBInstance: function (type, name) {
            if (type == 'setting') {
                return DBSettings;
            }
            else if (type == 'table') {
                //Instance of DB tables 
                var DBTables = new PouchDB("SunoCf_Tables_" + name, { adapter: 'idb', revs_limit: 1 });
                ////Don't need to return a Promise because in route Pos always call API to get Bootloader therefore createIndex actions will complete before it will be used.
                //Create indexes 
                return Promise.all([
                    DBTables.createIndex({ index: { fields: ['store'] } }),
                    DBTables.createIndex({ index: { fields: ['tableId'] } }),
                    DBTables.createIndex({ index: { fields: ['store', 'tableId'] } }),
                    DBTables.createIndex({ index: { fields: ['store', 'tableUuid'] } }),
                    //DBTables.createIndex({ index: { fields: ['store', 'tableId', 'tableUuid'] } })
                ]).then(function (result) {
                    //log for debug if catch error when creating Indexes.
                    //console.log(result);
                    return DBTables;
                })
                .catch(function (e) {
                    console.log(e);
                    return e;
                })
            }
            else if (type == 'item') {
                var DBItems = new PouchDB("SunoCf_Items_" + name, { adapter: 'idb', revs_limit: 1 });
                return Promise.all([
                    DBItems.createIndex({ index: { fields: []}})
                ])
            }
            else if (type == 'customer') {
                var DBCustomer = new PouchDB("SunoCf_Customers_" + name, { adapter: 'idb', revs_limit: 1 });
            }
            else if (type == 'order') {
                var DBOrder = new PouchDB("SunoCf_Orders_" + name, { adapter: 'idb', revs_limit: 1 });
            }
            else if (type == 'category') {
                var DBCategory = new PouchDB("SunoCf_Categories_" + name, { adapter: 'idb', revs_limit: 1 });
            }
            else {
                return null;
            }
        }
    }
}])

.factory('Auth', ['SunoPouchDB', function (SunoPouchDB) {
    var DB = SunoPouchDB.getPouchDBInstance('setting', null);
    var userID = 'user';
    var tokenID = 'token';
    var refreshTokenID = 'rftoken';
    var client = 'clientId';
    var accID = 'account';
    var settingID = 'setting';
    var storeID = 'store';
    var bootloader = 'bootloader';
    var sessionID = 'session';


    var AuthAPI = {
        isLoggedIn: function () {
            return this.getUser().then(function (data) {
                return data.docs.length == 0 ? false : true;
            })
        },
        getStoreList: function () {
            return DB.$getDocByID({ _id: storeID })
                .then(function (data) {
                    return data;
                });
        },
        setStoreList: function (store) {
            return DB.$getDocByID({ _id: storeID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: storeID, store: store, _rev: data.docs[0]._rev })
                }
                else {
                    return DB.$addDoc({ _id: storeID, store: store });
                }
            });
        },
        getBootloader: function () {
            return DB.$getDocByID({ _id: bootloader })
                .then(function (data) {
                    return data;
                });
        },
        setBootloader: function (data) {
            return DB.$getDocByID({ _id: bootloader }).then(function (result) {
                if (result.docs.length > 0) {
                    return DB.$addDoc({ _id: bootloader, bootloader: data, _rev: result.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: bootloader, bootloader: data });
                }
            });
        },
        getSetting: function () {
            return DB.$getDocByID({ _id: settingID })
                .then(function (data) {
                    return data;
                });
        },
        setSetting: function (setting) {
            return DB.$getDocByID({ _id: settingID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: settingID, setting: setting, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: settingID, setting: setting });
                }
            });
        },
        getUser: function () {
            return DB.$getDocByID({ _id: userID })
                .then(function (data) {
                    return data;
                });
        },
        setUser: function (user) {
            return DB.$getDocByID({ _id: userID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: userID, user: user, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: userID, user: user });
                }
            });
        },
        getAccount: function () {
            return DB.$getDocByID({ _id: accID })
            then(function (data) {
                return data;
            });
        },
        setAccount: function (acc) {
            return DB.$getDocByID({ _id: accID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: accID, account: acc, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: accID, account: acc });
                }
            });
        },
        getToken: function () {
            return DB.$getDocByID({ _id: tokenID })
                .then(function (data) {
                    return data;
                });
        },
        setToken: function (token) {
            return DB.$getDocByID({ _id: tokenID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: tokenID, token: token, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: tokenID, token: token });
                }
            });
        },
        setSessionId: function (session) {
            return DB.$getDocByID({ _id: sessionID }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: sessionID, session: session, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: sessionID, session: session });
                }
            });
        },
        getSessionId: function () {
            return DB.$getDocByID({ _id: sessionID })
                .then(function (data) {
                    return data;
                });
        },
        setSunoGlobal: function (global) {
            return DB.$getDocByID({ _id: 'SunoGlobal' }).then(function (data) {
                if (data.docs.length > 0) {
                    return DB.$addDoc({ _id: 'SunoGlobal', SunoGlobal: global, _rev: data.docs[0]._rev });
                }
                else {
                    return DB.$addDoc({ _id: 'SunoGlobal', SunoGlobal: global });
                }
            });
        },
        getSunoGlobal: function () {
            return DB.$getDocByID({ _id: 'SunoGlobal' })
                .then(function (data) {
                    return data;
                });
        },
        deleteAuth: function () {
            return Promise.all([
                DB.$removeDoc({ _id: userID }),
                DB.$removeDoc({ _id: tokenID }),
                DB.$removeDoc({ _id: accID }),
                DB.$removeDoc({ _id: settingID }),
                DB.$removeDoc({ _id: bootloader }),
                DB.$removeDoc({ _id: storeID })
            ]);
        }
    };

    return AuthAPI;
}]);
