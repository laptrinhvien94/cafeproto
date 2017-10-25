function SunoRequest () {
    this.options = {
        'url': '',
        'method': 'GET',
        'headers': {
            'content-type': 'application/json'
        },
        'json': true,
        'body': null
    };
};
SunoRequest.prototype.createCORSRequest = function() {
    var xhr = null;
    if(window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
    }
    else if (typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
    }
    else if (window.ActiveXObject) {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    return xhr;
}; 
SunoRequest.prototype.makeJsonRequest = function(url, method, data) {
    var self = this;
    var _request = self.createCORSRequest();
    self.options.url = url;
    self.options.method = method;
    
    if (data != null) {
        if (method == 'GET' || method == 'get' || method == 'Get') {
            self.options.url += '?' + SunoGlobal.querystring(data);
        }
        else {
            self.options.body = JSON.stringify(data);
        }
    }

    return new Promise(function(resolve, reject) {
        _request.open(self.options.method, self.options.url, true);
        if (self.options.headers != null) {
            Object.getOwnPropertyNames(self.options.headers).forEach(function(key, idx, array){
                _request.setRequestHeader(key, self.options.headers[key]);
            });
        }
        _request.onload = function(){
            if (_request.status == 200) {
                resolve(_request.response ? JSON.parse(_request.response) : '');
            }
            else if (_request.status == 401 && SunoGlobal.isContains(_request.responseText, 'expired')) {
                self.refreshToken(function(){
                    self.options.headers['authorization'] = 'Bearer ' + SunoGlobal.token.accessToken;
                    self.makeJsonRequest(url, method, data);
                });
            }
            else if (_request.status == 401 && SunoGlobal.isContains(_request.responseText, 'Missing access token')) {
                reject('Vui lòng đăng nhập.');
            }
            else if (_request.status == 403 && SunoGlobal.isContains(_request.responseText, 'insufficient_scope')) {
                reject('Bạn chưa được phân quyền để sử dụng tính năng này.');
            }
            else {
                reject(_request.responseText);
            }
        };
        _request.onerror = function(error){
            reject(error);
        };

        _request.send(self.options.body);
    });
};
SunoRequest.prototype.makeRestful = function(url, method, data) {
    var self = this;
    self.options.headers['authorization'] = 'Bearer ' + SunoGlobal.token.accessToken;
    return self.makeJsonRequest(url, method, data);
};
SunoRequest.prototype.refreshToken = function(callback){
    var request = self.createCORSRequest();
    var refreshData = { format: 'json', clientId: SunoGlobal.userProfile.sessionId, token: SunoGlobal.token.refreshToken };
    var url = SunoGlobal.authService.domain + SunoGlobal.authService.refreshTokenUrl + '?' + SunoGlobal.querystring(refreshData);
    request.open('GET', url, true);
    request.onload = function() {
        if (request.response){
            var result = JSON.parse(request.response);
            SunoGlobal.token.refreshToken = result.refreshToken;
            SunoGlobal.token.accessToken = result.accessToken;
        }
        if (callback && typeof callback === 'function'){
            callback();
        }
    };
    request.onerror = function(error) {
        console.log('refreshToken', request.response);
    };

    request.send();
};
