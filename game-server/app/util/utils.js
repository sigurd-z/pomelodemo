/**
 * Created by aGoo on 14-5-19.
 */

//core modules
var crypto = require('crypto');
var fs = require('fs');
var zlib = require('zlib');
var util = require('util');
//public modules from npm
var validator = require('validator');
var routeDict = require('../../config/routeDict.json');
//your own modules from file
//...

var utils = module.exports;

utils.MSG_DATA_COMPRESS_LIMIT = 480;
utils.CONFIG_REFRESH_INTERVAL = 60*1000;//milliseconds

/**
 * Make Signature Of Text
 * @param {String}    text  text to sign
 * @param {String}    key   private key
 * @returns {String}        signature
 */
utils.sha1 = function(text, key) {
  return crypto.createHmac('sha1', key).update(text,'utf8').digest('hex');
};

/**
 * Make MD5 Of Text
 * @param {String}    text  text to sign
 * @returns {String}
 */
utils.md5 = function(text){
  return crypto.createHash('md5').update(text).digest('hex');
};

/**
 * Get UnixTimeStamp
 * @returns {Number}
 */
utils.now = utils.unixNow = function(){
  return  Math.floor(Date.now()/1000);
};
/**
 * Get UnixTimeStamp
 * @returns {Number}
 */
utils.strtotime = utils.timeToUnix = function(dateString){
  var date = new Date(dateString);
  return  Math.floor(date.getTime()/1000);
};

/**
 * same as php function "date", reference to https://github.com/kvz/phpjs/blob/master/functions/datetime/date.js
 * @param {String} format
 * @param {Number} [timestamp=utils.unixNow()]
 * @returns {String}
 */
utils._datePlugin = function(format, timestamp){
  this.format = format;
  this.jsdate = (timestamp === undefined ? new Date() : // Not provided
    (timestamp instanceof Date) ? new Date(timestamp) : // JS Date()
      new Date(timestamp * 1000) // UNIX timestamp (auto-convert to int)
    );
};
utils._datePlugin.prototype.txt_words = [
  'Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
utils._datePlugin.prototype._pad = function (n, c) {
  n = String(n);
  while (n.length < c) {
    n = '0' + n;
  }
  return n;
};
utils._datePlugin.prototype.formatChr = /\\?(.?)/gi;
utils._datePlugin.prototype.formatChrCb = function (t, s) {
  return this.f[t] ? this.f[t].call(this) : s;
};
utils._datePlugin.prototype.date = function () {
  return this.format.replace(this.formatChr, this.formatChrCb.bind(this));
};
utils._datePlugin.prototype.f = {
  // Day
  d: function () {
    // Day of month w/leading 0; 01..31
    return this._pad(this.f.j.call(this), 2);
  },
  D: function () {
    // Shorthand day name; Mon...Sun
    return this.f.l.call(this)
      .slice(0, 3);
  },
  j: function () {
    // Day of month; 1..31
    return this.jsdate.getDate();
  },
  l: function () {
    // Full day name; Monday...Sunday
    return this.txt_words[this.f.w.call(this)] + 'day';
  },
  N: function () {
    // ISO-8601 day of week; 1[Mon]..7[Sun]
    return this.f.w.call(this) || 7;
  },
  S: function () {
    // Ordinal suffix for day of month; st, nd, rd, th
    var j = this.f.j.call(this);
    var i = j % 10;
    if (i <= 3 && parseInt((j % 100) / 10, 10) == 1) {
      i = 0;
    }
    return ['st', 'nd', 'rd'][i - 1] || 'th';
  },
  w: function () {
    // Day of week; 0[Sun]..6[Sat]
    return this.jsdate.getDay();
  },
  z: function () {
    // Day of year; 0..365
    var a = new Date(this.f.Y.call(this), this.f.n.call(this) - 1, this.f.j.call(this));
    var b = new Date(this.f.Y.call(this), 0, 1);
    return Math.round((a - b) / 864e5);
  },

  // Week
  W: function () {
    // ISO-8601 week number
    var a = new Date(this.f.Y.call(this), this.f.n.call(this) - 1, this.f.j.call(this) - this.f.N.call(this) + 3);
    var b = new Date(a.getFullYear(), 0, 4);
    return this._pad(1 + Math.round((a - b) / 864e5 / 7), 2);
  },

  // Month
  F: function () {
    // Full month name; January...December
    return this.txt_words[6 + this.f.n.call(this)];
  },
  m: function () {
    // Month w/leading 0; 01...12
    return this._pad(this.f.n.call(this), 2);
  },
  M: function () {
    // Shorthand month name; Jan...Dec
    return this.f.F.call(this)
      .slice(0, 3);
  },
  n: function () {
    // Month; 1...12
    return this.jsdate.getMonth() + 1;
  },
  t: function () {
    // Days in month; 28...31
    return (new Date(this.f.Y.call(this), this.f.n.call(this), 0))
      .getDate();
  },

  // Year
  L: function () {
    // Is leap year?; 0 or 1
    var j = this.f.Y.call(this);
    return j % 4 === 0 & j % 100 !== 0 | j % 400 === 0;
  },
  o: function () {
    // ISO-8601 year
    var n = this.f.n.call(this);
    var W = this.f.W.call(this);
    var Y = this.f.Y.call(this);
    return Y + (n === 12 && W < 9 ? 1 : n === 1 && W > 9 ? -1 : 0);
  },
  Y: function () {
    // Full year; e.g. 1980...2010
    return this.jsdate.getFullYear();
  },
  y: function () {
    // Last two digits of year; 00...99
    return this.f.Y.call(this)
      .toString()
      .slice(-2);
  },

  // Time
  a: function () {
    // am or pm
    return this.jsdate.getHours() > 11 ? 'pm' : 'am';
  },
  A: function () {
    // AM or PM
    return this.f.a.call(this)
      .toUpperCase();
  },
  B: function () {
    // Swatch Internet time; 000..999
    var H = this.jsdate.getUTCHours() * 36e2;
    // Hours
    var i = this.jsdate.getUTCMinutes() * 60;
    // Minutes
    // Seconds
    var s = this.jsdate.getUTCSeconds();
    return this._pad(Math.floor((H + i + s + 36e2) / 86.4) % 1e3, 3);
  },
  g: function () {
    // 12-Hours; 1..12
    return this.f.G.call(this) % 12 || 12;
  },
  G: function () {
    // 24-Hours; 0..23
    return this.jsdate.getHours();
  },
  h: function () {
    // 12-Hours w/leading 0; 01..12
    return this._pad(this.f.g.call(this), 2);
  },
  H: function () {
    // 24-Hours w/leading 0; 00..23
    return this._pad(this.f.G.call(this), 2);
  },
  i: function () {
    // Minutes w/leading 0; 00..59
    return this._pad(this.jsdate.getMinutes(), 2);
  },
  s: function () {
    // Seconds w/leading 0; 00..59
    return this._pad(this.jsdate.getSeconds(), 2);
  },
  u: function () {
    // Microseconds; 000000-999000
    return this._pad(this.jsdate.getMilliseconds() * 1000, 6);
  },

  // Timezone
  e: function () {
    // Timezone identifier; e.g. Atlantic/Azores, ...
    throw 'Not supported (see source code of date() for timezone on how to add support)';
  },
  I: function () {
    // DST observed?; 0 or 1
    // Compares Jan 1 minus Jan 1 UTC to Jul 1 minus Jul 1 UTC.
    // If they are not equal, then DST is observed.
    var a = new Date(this.f.Y.call(this), 0);
    // Jan 1
    var c = Date.UTC(this.f.Y.call(this), 0);
    // Jan 1 UTC
    var b = new Date(this.f.Y.call(this), 6);
    // Jul 1
    // Jul 1 UTC
    var d = Date.UTC(this.f.Y.call(this), 6);
    return ((a - c) !== (b - d)) ? 1 : 0;
  },
  O: function () {
    // Difference to GMT in hour format; e.g. +0200
    var tzo = this.jsdate.getTimezoneOffset();
    var a = Math.abs(tzo);
    return (tzo > 0 ? '-' : '+') + this._pad(Math.floor(a / 60) * 100 + a % 60, 4);
  },
  P: function () {
    // Difference to GMT w/colon; e.g. +02:00
    var O = this.f.O.call(this);
    return (O.substr(0, 3) + ':' + O.substr(3, 2));
  },
  T: function () {
    return 'UTC';
  },
  Z: function () {
    // Timezone offset in seconds (-43200...50400)
    return -this.jsdate.getTimezoneOffset() * 60;
  },

  // Full Date/Time
  c: function () {
    // ISO-8601 date.
    return 'Y-m-d\\TH:i:sP'.replace(this.formatChr, this.formatChrCb.bind(this));
  },
  r: function () {
    // RFC 2822
    return 'D, d M Y H:i:s O'.replace(this.formatChr, this.formatChrCb.bind(this));
  },
  U: function () {
    // Seconds since UNIX epoch
    return this.jsdate / 1000 | 0;
  }
};

utils.date = function(format, timestamp){
  var datePlugin = new utils._datePlugin(format, timestamp);
  return datePlugin.date();
};

/**
 * Add values into origin object
 * @param {Object}  origin
 * @param {Object}  add
 * @param {Object}  [boolOnlyExistKey=false] 是否只覆盖origin存在的key,默认false
 * @returns {*}
 */
utils.extendObject = function(origin, add, boolOnlyExistKey) {
  var bool = boolOnlyExistKey || false;
  if(!origin || !utils.isObject(origin) || !add || !utils.isObject(add)) return;
  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    if(!add.hasOwnProperty(keys[i]) || (bool && !origin.hasOwnProperty(keys[i]))) continue;
    if(this.isString(add[keys[i]]) || this.isNumeric(add[keys[i]])){
      origin[keys[i]] = add[keys[i]];
    }else{
      origin[keys[i]] = utils.simpleClone(add[keys[i]]);
    }
  }
};

utils.genInviteCode = function(){
  return '';
};

utils.zlibNext = function(err, response, cb){
  var bufResponse = new Buffer(JSON.stringify(response));
  var res = {compress:false, body:bufResponse};
  if(bufResponse.length > utils.MSG_DATA_COMPRESS_LIMIT){
    res.compress = true;
    zlib.deflate(bufResponse, function(err, buffer){
      res.body = buffer;
      cb(err, res);
    });
  }else{
    cb(err, res);
  }
};

/**
 * Convert IPv4 to INT
 * @param {String}    ip   ipv4 string
 * @returns {Number}
 */
utils.ipToLong = function(ip){
  var ipl=0;
  ip.split('.').forEach(function( octet ) {
    ipl<<=8;
    ipl+=parseInt(octet);
  });
  return(ipl >>>0);
};

/**
 * Load Config JSON From File
 * @param {Object}  confObj  configObject to save data
 * @param {Boolean} [force]    force reload or not
 */
utils.loadConfig = function(confObj, force){
  var reloaded = false;
  force = !!force;
  var now = Date.now();//milliseconds
  var lastRefresh = confObj.lastRefresh || 0;
  var lastModify = confObj.lastModify || 0;
  var refreshInterval = confObj.refreshInterval || utils.CONFIG_REFRESH_INTERVAL;
  if(force || (now - lastRefresh > refreshInterval)){
    if(!fs.existsSync(confObj.path))
      return reloaded;
    var fsStat = fs.statSync(confObj.path);
    var fileMTime = fsStat.mtime.getTime();
    if(fileMTime > lastModify){
      var resData = fs.readFileSync(confObj.path, {encoding:'utf8'});
      if(resData && resData.length>0){
        confObj.data = JSON.parse(resData);
        confObj.lastRefresh = now;
        confObj.lastModify = fileMTime;
        reloaded = true;
      }
    }
  }
  return reloaded;
};

/**
 * Load Config JSON From File aSync
 * @param {Object}  confObj configObject to save data
 * @param {Boolean} force   force reload or not
 * @param {Function} next
 */
utils.loadConfigAsync = function(confObj, force, next){
  var loaded = false;
  force = !!force;
  var now = Date.now();//milliseconds
  var lastRefresh = confObj.lastRefresh || 0;
  var lastModify = confObj.lastModify || 0;
  var refreshInterval = confObj.refreshInterval || utils.CONFIG_REFRESH_INTERVAL;
  if(force || (now - lastRefresh > refreshInterval)){
    fs.exists(confObj.path, function(exists){
      if(exists){
        fs.stat(confObj.path, function(err, fsStat){
          if(!err){
            var fileMTime = fsStat.mtime.getTime();
            if(fileMTime > lastModify) {
              fs.readFile(confObj.path, {encoding:'utf8'}, function(err, resData){
                if(!err){
                  confObj.data = JSON.parse(resData);
                  confObj.lastRefresh = now;
                  confObj.lastModify = fileMTime;
                  loaded = true;
                }
                utils.invokeCallback(next, err, loaded);
              });
            }else{
              loaded = true;
              utils.invokeCallback(next, null, loaded);
            }
          }else{
            utils.invokeCallback(next, err, loaded);
          }
        });
      }else{
        utils.invokeCallback(next, null, loaded);
      }
    });
  }else{
    loaded = true;
    utils.invokeCallback(next, null, loaded);
  }
};

/**
 * Object Property Check
 *  Sample: {name:{required:1, rule: 'isIn', params:[[0,1,2]]} will call isIn(name, [0,1])
 * @param {Object}  dataObject  as {key: value, key:value...}
 * @param {Object}    rules       as {name:{required:1, rule:'xxxx'[, params:[xxxx]},...}
 *        {bool}    rules.name.required check exists or not
 *          if false, do NOT check rule when name is not exists in dataObject
 *        {String}  rules.name.rule   same as validator support
 *        see https://github.com/chriso/validator.js
 *        {Array}   rules.name.params params for calling rule func
 * @param {Object}  [opts]        as {stopWhenError: true/false}
 * @returns {Object}            {errorCount: xx, errorMessage: [xxx,xxx]}
*/
utils.checkParams = function(dataObject, rules, opts){
  if(!opts){
    opts = {};
  }
  var options = {
    stopWhenError: opts.stopWhenError ? true : false
  };
  var errorCnt = 0;
  var errorMsg = [];
  for(var field in rules){
    if(rules.hasOwnProperty(field)){
      var check = rules[field];
      if(check.required){
        if(!dataObject.hasOwnProperty(field)
          || (dataObject.hasOwnProperty(field) && dataObject[field].length ===0)
        ){
          errorCnt++;
          errorMsg.push('FIELD ' + field + ' NOT EXISTS');
          if(options.stopWhenError) break;
        }
      }
      if(check.rule){
        var method = check.rule;
        if( dataObject.hasOwnProperty(field) ){
          var result = false;
          if(check.params){
            var realParam = utils.arrayMerge([dataObject[field]], check.params);
            if(!!validator[method]){
              result = validator[method].apply(null,realParam);
            }else{
              result = utils[method].apply(null, realParam);
            }
          } else {
            if(!!validator[method]){
              result = validator[method](dataObject[field]);
            }else{
              result = utils[method](dataObject[field]);
            }
          }
          if(!result){
            errorCnt++;
            errorMsg.push('CHECK ' + method + '( ' + field + ') FAILED');
            if(options.stopWhenError) break;
          }
        }
      }
    }
  }
  return {errorCount: errorCnt, errorMessage: errorMsg};
};

/**
 * Format FatalError Output
 *
 * @param err   Error(message,id)
 * @param msg   Original msg send from client
 * @param resp  Server Response Object
 * @param session Session
 * @param next  callback
 */
utils.fatalError = function(err, msg, resp, session, next) {
  var errCode = err.code || 500;
  next(null,{code: errCode, message: err.message});
};

/**
 * Check and invoke callback function
 * @param {Function} cb  callback function
 */
utils.invokeCallback = function(cb) {
  if(!!cb && typeof cb === 'function') {
    cb.apply(null, Array.prototype.slice.call(arguments, 1));
  }
};

utils.filterServerByWorld = function(servers, group){
  var groupServer = [];
  for(var i=0; i<servers.length; i++){
    var ids = servers[i].id.split('_');
    if(!!ids && ids.length === 3 && ids[1] == group){//[type,group,id]
      groupServer.push(servers[i]);
    }
  }
  return groupServer;
};

utils.groupServers = function(servers){
  var groupServer = {};
  for(var i=0; i<servers.length; i++){
    var ids = servers[i].id.split('_');
    if(!!ids && ids.length === 3){//[type,group,id]
      if(groupServer.hasOwnProperty(ids[1])){
        groupServer[ids[1]].push(servers[i]);
      }else{
        groupServer[ids[1]] = [servers[i]];
      }
    }
  }
  return groupServer;
};

utils.findWorldIdInServerId = function(strServerId){//[serverType_serverGroup_serverID]
  var result = null;
  if(!!strServerId){
    var ids = strServerId.split('_');
    if(!!ids && ids.length === 3){
      result = ids[1];
    }
  }
  return result;
};

utils.keys = function(obj){
  if(!obj || typeof(obj) !== 'object'){
    return [];
  }
  var keys = Object.keys(obj);
  if(keys){
    return keys;
  }
  keys = [];
  for(var key in obj){
    if(obj.hasOwnProperty(key)){
      keys.push(key);
    }
  }
  return keys;
};

utils.size = function(obj) {
  return utils.keys(obj).length;
};
utils.isEven = function(val){
  return (val % 2);
};
utils.isOdd = function(val){
  return !(val % 2);
};
utils.rand = function(min, max){
  if(min > max){
    return utils.rand(max, min);
  }
  return (min + Math.floor(Math.random() * (max - min + 1)));
};
/**
 * @param {Number} percent - percent
 * @param {Number} [scale]
 */
utils.isPercentHit = function(percent, scale){
  if(0 == percent){
    return false;
  }
  scale = scale || 1;
  var randVal = utils.rand(1, 100*scale);
  if(randVal <= percent*scale){
    return true;
  }
  return false;
};
/**
 * @param {Number} numerator
 * @param {Number} dominator
 * @param {Number} [scaleFactor=1]
 * @returns {Boolean}
 */
utils.isChanceHit = function(numerator, dominator, scaleFactor){
  if(0 == numerator || 0 == dominator){
    return false;
  }
  scaleFactor = scaleFactor || 1;
  var randVal = utils.rand(1, dominator * scaleFactor);
  if(randVal <= numerator * scaleFactor){
    return true;
  }
  return false;
};
utils.isObject = function(obj){
  return (obj !== null && toString.call(obj) === '[object Object]' && !utils.isArray(obj) && !utils.isFunction(obj));
};
utils.isArray = function(obj){
  return (toString.call(obj) === '[object Array]');
};
utils.isFunction = function(obj){
  return (typeof obj === 'function');
};
utils.isBool = function(obj){
  return (toString.call(obj) === '[object Boolean]');
};
utils.isString = function(obj){
  return (toString.call(obj) === '[object String]');
};
utils.isNumeric = function(obj){
  return (isFinite(obj) && !isNaN(parseFloat(obj)));
};
utils.isInt = function(obj){
  return (this.isNumeric(obj) && (obj % 1) === 0);
};
utils.isUndefined = function(obj){
  return (obj === void 0);
};
utils.isDefined = function(obj){
  return (obj !== void 0);
};
utils.isEmpty = function(obj){
  return (false === obj || 0 === obj ||  "0" === obj || "" === obj || null === obj || undefined === obj || (utils.isArray(obj) && 0 === obj.length) || (utils.isObject(obj) && 0 === utils.size(obj)));
};
utils.isIntOrArray = function(obj){
  return utils.isInt(obj) || utils.isArray(obj);
};

/**
 * deep copy an object
 * @param {Object} obj - input object
 * @returns {Object}
 */
utils.cloneObj = function(obj){
  var newObj;
  if(obj && typeof obj === 'object'){
    if(obj instanceof Date){
      newObj = new Date();
      newObj.setTime(obj.getTime());
    }else{
      newObj = utils.isArray(obj) ? [] : {};
      for(var prop in obj){
        if(obj.hasOwnProperty(prop)){
          newObj[prop] = utils.cloneObj(obj[prop]);
        }
      }
    }
  }else{
    newObj = obj;
  }
  return newObj;
};

/**
 * deep copy a simple nested json/array, which only contains number or string
 * @param {(Object|Array)} obj - input object
 * @returns {(Object|Array)}
 */
utils.simpleClone = function(obj){
  if(utils.isDefined(obj)){
    return JSON.parse(JSON.stringify(obj));
  }
  return obj;
};

/**
 * deep copy a simple un-nested/one-dimensional array, which only contains number or string
 * @param {Array} arr - input array
 * @returns {Array}
 */
utils.cloneSimpleArray = function(arr){
  return arr.slice();
};

/**
 * deep freeze an object to make it unchangeable
 * @params {*} obj - input object
 */
utils.deepFreezeObj = function(obj){
  if(null === obj || typeof obj !== "object"){
    return;
  }
  if(!Object.isFrozen(obj)){
    Object.freeze(obj);
  }
  if(obj){
    for(var prop in obj){
      if (obj.hasOwnProperty(prop)) {
        utils.deepFreezeObj(obj[prop]);
      }
    }
  }
};

/** ========== array utils start ========== */
/**
 * find the first occurrence of the specified value in array
 * @param {Array} arr - input array
 * @param {Array} element
 * @returns {Number} the occurrence pos - positive integer if found | -1 if not found
 */
utils.arraySearch = function(arr, element){
  var boolNumeric = utils.isNumeric(element);
  //for performance, write two similar loops
  if(boolNumeric){
    for(var i = 0, len = arr.length; i < len; ++i){
      if(element == arr[i]){
        return i;
      }
    }
  }else{
    for(var i = 0, len = arr.length; i < len; ++i){
      if(element === arr[i]){
        return i;
      }
    }
  }
  return -1;
};

/**
 * check whether an array contains the specified value
 * @param {Array} arr - input array
 * @param {*} element
 * @returns {Boolean}
 */
utils.arrayContains = function(arr, element){
  return (utils.arraySearch(arr, element) !== -1);
};
utils.arrayLike = function(arr, element){
  for(var i in arr){
    if(element.indexOf(arr[i]) != -1){
      return true;
    }
  }
  return false;
};
/**
 * remove duplicate values from an array
 * @param {Array} arr - input array
 * @returns {Array}
 */
utils.arrayUnique = function(arr){
  var json = {};
  for(var i = 0, len = arr.length; i < len ;++i){
    json[arr[i]] = 1;
  }
  return Object.keys(json);
};

/**
 * add a value into an array at specified index
 * this method will change the original passed array
 * @param {Array} arr - input array
 * @param {*} element
 * @param {Number} index
 * @returns {Array}
 */
utils.arrayAddAt = function(arr, element, index){
  arr.splice(index, 0, element);
};

/**
 * remove a value from an array
 * this method will change the original passed array
 * @param {Array} arr - input array
 * @param {Number} index
 */
utils.arrayRemoveAt = function(arr, index){
  arr.splice(index, 1);
};

/**
 * remove element of the specified index from an array
 * this method only remove the first-found element
 * @param {Array} arr - input array
 * @param {*} element
 */
utils.arrayRemove = function(arr, element){
  var index = utils.arraySearch(arr, element);
  if (index !== -1) {
    utils.arrayRemoveAt(arr, index);
  }
};

/**
 * calculate the intersection set of multiple(at least 2) arrays
 * @param {...Array} argumentList - input array list
 * @returns {Array}
 */
utils.arrayIntersect = function(argumentList){
  var arrList = Array.prototype.slice.call(arguments, 0);
  if(arrList.length < 2){
    return [];
  }
  var firstArr = arrList[0];
  return arrList.reduce(function(result, element){
    return  result.filter(function(v){
      return utils.arrayContains(element, v);
    });
  }, firstArr);
};

/**
 * calculate the difference set of two arrays
 * @param {Array} arr1
 * @param {Array} arr2
 * @returns {Array} an array contains elements which exist in arr1 but not in arr2
 */
utils.arrayDiff = function(arr1, arr2){
  return arr1.filter(function(element){
    return !utils.arrayContains(arr2, element);
  });
};

/**
 * merge multiple arrays
 * @param {...Array} argumentList - input array list
 * @returns {Array}
 */
utils.arrayMerge = function(argumentList){
  var arrList = Array.prototype.slice.call(arguments, 0);
  return arrList.reduce(function(prevArr, curArr){
    return prevArr.concat(curArr);
  });
};

/**
 * creates a json by using one array for keys and another for its values
 * @param {Array} keys
 * @param {Array} values
 * @returns {Object}
 */
utils.arrayCombine = function(keys, values){
  var result = {};
  for(var i = 0, len = keys.length; i < len; ++i){
    result[keys[i]] = values[i];
  }
  return result;
};

/**
 * generate an array containing {count} number of {value}
 * @param {*} value
 * @param {Number} count
 * @returns {Array}
 */
utils.arrayRepeat = function(value, count){
  var retArr = [];
  for(var i = 0; i < count; ++i){
    retArr.push(value);
  }
  return retArr;
};

/**
 * calculate the sum of elements in an array
 * @param {Array} arr - input array
 * @returns {Number}
 */
utils.arraySum = function(arr){
  if(0 === arr.length){
    return 0;
  }
  return arr.reduce(function(prevVal, curVal){
    return (parseFloat(prevVal) + parseFloat(curVal));
  });
};

/**
 * calculate the product of elements in an array
 * @param {Array} arr - input array
 * @returns {Number}
 */
utils.arrayProduct = function(arr){
  if(0 === arr.length){
    return 0;
  }
  return arr.reduce(function (prevVal, curVal){
    return (prevVal * curVal);
  });
};

/**
 * calculate the maximum value of elements in an array
 * @param {Array} arr - input array
 * @returns {Number}
 */
utils.arrayMax = function(arr){
  return Math.max.apply(null, arr);
};

/**
 * calculate the minimum value of elements in an array
 * @param {Array} arr - input array
 * @returns {Number}
 */
utils.arrayMin = function(arr){
  return Math.min.apply(null, arr);
};

/**
 * generate an array containing a range of elements
 * @param {Number} start
 * @param {Number} end
 * @param {Number} [step=1]
 * @returns {Array}
 */
utils.arrayRange = function(start, end, step){
  var startNum = utils.toNumber(start);
  var endNum = utils.toNumber(end);
  if(startNum == endNum){
    return [start];
  }
  step = step || 1;
  var retArr = [];
  if(startNum < endNum){
    for(var i = startNum; i <= endNum; i += step){
      retArr.push(i);
    }
  }else{
    for(var i = startNum; i >= endNum; i -= step){
      retArr.push(i);
    }
  }
  return retArr;
};

/**
 * get random element from an array
 * @param {Array} arr - input array
 * @param {Object} [opts={}] - options, keys as
 * {
 *   count {Number} default to 1
 *   weightColumn {String} default to null
 *   randScale {Number} default to 1
 *   boolMutualExclusive {Boolean} default to true
 *   boolRetIdx {Boolean} default to false
 *   totalWeight {Number} default to undefined - for internal use, passed if weightColumn is passed & boolMutualExclusive=true
 * }
 * @returns {*}
 */
utils.arrayRand = function(arr, opts){
  opts = opts || {};
  var count = opts['count'] || 1;
  count = Math.min(count, arr.length);
  var weightColumn = utils.isDefined(opts['weightColumn']) ? opts['weightColumn'] : null;
  var randScale = opts['randScale'] || 1;
  var boolMutualExclusive = utils.isDefined(opts['boolMutualExclusive']) ? opts['boolMutualExclusive'] : true;
  var boolRetIdx = opts['boolRetIdx'] || false;
  if(!count){
    return (boolRetIdx ? -1 : null);
  }
  if(1 === count){
    var randIdx = null;
    if(weightColumn !== null){
      var totalWeight = (!boolMutualExclusive || opts['totalWeight']) ? opts['totalWeight'] : randScale * arr.reduce(function(prevVal, curVal){
        return ((parseInt(prevVal, 10) + parseInt(curVal[weightColumn], 10)));
      }, 0);
      var randVal = utils.rand(1, totalWeight);
      var min = 0;
      var max = arr[0][weightColumn] * randScale;
      for(var i = 0, len = arr.length; i < len; ++i){
          if(randVal > min && randVal <= max){
            randIdx = i; break;
          }
          if(i < len - 1) {
            var addVal = arr[i + 1][weightColumn] * randScale;
            min = max; max += addVal;
          }
        }
    }else{
      randIdx = utils.rand(0, arr.length-1);
    }
    return (boolRetIdx ? randIdx : arr[randIdx]);
  }
  var newArr = boolMutualExclusive ? utils.cloneSimpleArray(arr) : arr;
  var retArr = [];
  if(weightColumn !== null && !boolMutualExclusive){
    totalWeight = randScale * arr.reduce(function(prevVal, curVal){
      return (prevVal + curVal[weightColumn]);
    }, 0);
  }
  for(var i = 0; i < count; ++i){
    var randIdx = utils.arrayRand(newArr, {count:1, weightColumn:weightColumn, randScale:randScale, boolMutualExclusive:boolMutualExclusive, boolRetIdx:true, totalWeight:totalWeight});
    retArr.push((boolRetIdx ? randIdx : newArr[randIdx]));
    if(boolMutualExclusive && i < count-1){
      utils.arrayRemoveAt(newArr, randIdx);
    }
  }
  var retVal = (count > 1) ? retArr : retArr[0];
  return retVal;
};
/**
 * shuffle an array
 * @param {Array} arr - input array
 * @returns {Array}
 */
utils.arrayShuffle = function(arr){
  var retArr = [];
  for(var i = 0, len = arr.length; i < len; ++i){
    var randIdx = utils.rand(0, i);
    if(randIdx != i){
      retArr[i] = retArr[randIdx];
    }
    retArr[randIdx] = arr[i];
  }
  return retArr;
};

/**
 * convert an array to a map(or called JSON) using {column} as the key
 * @param {Array} arr - input array
 * @param {String|Number} column
 * @returns {Object}
 */
utils.arrayToMapByColumn = function(arr, column){
  if(0 === arr.length){
    return {};
  }
  return arr.reduce(function(result, element){
    var key = element[column];
    if(key){
      delete element[column];
      result[key] = element;
      return result;
    }
  }, {});
};
utils.jsonListToArrayByColumn = function(arr, column){
  if(0 === arr.length){
    return [];
  }
  return arr.reduce(function(result, element){
    var key = element[column];
    if(utils.isDefined(key)){
      result.push(key);
      return result;
    }
  }, []);
};

/**
 * chunks an array into arrays with [size] elements. The last chunk may contain less than [size] elements
 * @param {Array} arr - input array
 * @param {Number} size
 * @returns {Array}
 */
utils.arrayChunk = function(arr, size){
  if(size <= 0){
    return [utils.cloneSimpleArray(arr)];
  }
  var offset = 0, maxLen = arr.length, result = [];
  while(offset < maxLen){
    result.push(arr.slice(offset, offset+size));
    offset += size;
  }
  return result;
};
/** ========== array utils end ========== */

/** ========== string utils start ========== */
/**
 * @constant string pad types
 */
utils.STR_PAD = {
  LEFT : 1,
  RIGHT : 2,
  BOTH : 3
};
/**
 * make a string's first character upper case
 * @param {String} str
 * @returns {String}
 */
utils.strUcFirst = function(str){
  if(str.length > 0){
    return (str[0] ? (str[0].toUpperCase() + str.slice(1)) : '');
  }
  return '';
};
/**
 * make a string's first character lower case
 * @param {String} str - input string
 * @returns {String}
 */
utils.strLcFirst = function(str){
  if(str.length > 0){
    return (str[0] ? (str[0].toLowerCase() + str.slice(1)) : '');
  }
  return '';
};

/**
 * repeat a string
 * @param {String} str - input string
 * @param {Number} count
 * @returns {String}
 */
utils.strRepeat = function(str, count){
  var arr = [];
  for(var i = 0; i < count; ++i){
    arr.push(str);
  }
  return arr.join('');
};

/**
 * generate a padded string
 * @param {String} str - input string
 * @param {Number} padLength - should be greater than the length of input string
 * @param {String} [padStr=' ']
 * @param {utils.STR_PAD} [padType=utils.STR_PAD.RIGHT]
 * @returns {String}
 */
utils.strPad = function(str, padLength, padStr, padType){
  var diffLength = padLength - str.toString().length;
  if(diffLength < 0){
    return str;
  }
  padStr = padStr || ' ';
  var padStrRepeatCount = Math.ceil(diffLength / padStr.length);
  var strToPad = '';
  if(padType !== utils.STR_PAD.BOTH){
    strToPad = utils.strRepeat(padStr, padStrRepeatCount).substr(0, diffLength);
    if(strToPad.length > diffLength){
      strToPad = strToPad.substr(0, diffLength);
    }
  }
  if(padType === utils.STR_PAD.LEFT){//padding left
    return strToPad.concat(str);
  }else if(padType === utils.STR_PAD.RIGHT || padType !== utils.STR_PAD.BOTH){//padding right, default case
    return str.concat(strToPad);
  }else{//padding both sides
    var leftPadStrRepeatCount = Math.floor(padStrRepeatCount / 2);
    var rightPadStrRepeatCount = padStrRepeatCount - leftPadStrRepeatCount;
    var leftStrToPad = utils.strRepeat(padStr, leftPadStrRepeatCount);
    var rightStrToPad = utils.strRepeat(padStr, rightPadStrRepeatCount);
    var leftPadLength = Math.floor(diffLength / 2);
    var rightPadLength = diffLength - leftPadLength;
    if(leftStrToPad.length > leftPadLength){
      leftStrToPad = leftStrToPad.substr(0, leftPadLength);
    }
    if(rightStrToPad.length > rightPadLength){
      rightStrToPad = rightStrToPad.substr(0, rightPadLength);
    }
    return [leftStrToPad, str, rightStrToPad].join('');
  }
};

/**
 * randomly shuffles a string
 * @param {String} str - input string
 * @returns {String}
 */
utils.strShuffle = function(str){
  return utils.arrayShuffle(str.split('')).join('');
};
/** ========== string utils end ========== */

/** ========== number utils start ========== */
/**
 * clamp a value to [min, +infinity)
 * @param {Number} value - input number
 * @param {Number} min
 * @returns {Number}
 */
utils.clampMinValue = function(value, min){
  return Math.max(value, min);
};
/**
 * clamp a value to (-infinity, max]
 * @param {Number} value - input number
 * @param {Number} min
 * @returns {Number}
 */
utils.clampMaxValue =function(value, max){
  return Math.min(value, max);
};
/**
 * clamp a value to [min, max]
 * @param {Number} value - input number
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
utils.clampValue = function(value, min, max){
  if(max > min){
    return utils.clampMaxValue(utils.clampMinValue(value, min), max);
  }else if(max < min){
    return utils.clampMaxValue(utils.clampMinValue(value, max), min);
  }else{
    return value;
  }
};

/**
 * convert value to an integer
 * @param {*} value
 * @returns {Number} - if NaN, then return 0
 */
utils.toInt = function(value){
  var result = parseInt(value, 10) || 0;
  return result;
};

/**
 * convert value to a number
 * @param {*} value
 * @returns {Number} - if NaN, then return 0
 */
utils.toNumber = function(value){
  var result = parseFloat(value) || 0;
  return result;
};

/**
 * convert a decimal number to an n-ary notation
 * @param {Number} value
 * @param {Number} radix
 * @returns {String}
 */
utils.decToNary = function(value, radix){
  return (value).toString(radix);
};

/**
 * convert an n-ary notation to a decimal integer (radix refers to the "n" in n-ary)
 * @param {Number|String} value
 * @param {Number} radix
 * @returns {Number}
 */
utils.naryToDec = function(value, radix){
  return parseInt(value, radix);
};
/** ========== number utils end ========== */

/** ========== JSON utils start ========== */
/**
 * get random element from a json object
 * @param {Object} json - input json object
 * @param {Object} [opts={}] - options, keys as
 * {
 *   count {Number} default to 1
 *   weightColumn {String} default to null
 *   randScale {Number} default to 1
 *   boolMutualExclusive {Boolean} default to true
 *   boolRetIdx {Boolean} default to false
 * }
 * @returns {*}
 */
utils.jsonRand = function(json, opts){
  opts = opts || {};
  var count = opts['count'] || 1;
  var weightColumn = utils.isDefined(opts['weightColumn']) ? opts['weightColumn'] : null;
  var randScale = opts['randScale'];
  var boolRetIdx = opts['boolRetIdx'] || false;
  var boolMutualExclusive = opts['boolMutualExclusive'];
  var keys = Object.keys(json);
  var randKeys = [];
  var result = [];
  if(weightColumn !== null){
    var keysForRand = [];
    var idx = 0;
    for(var i in json){
      if(json.hasOwnProperty(i)){
        keysForRand.push({key:keys[idx], w:json[i][weightColumn]});
        ++idx;
      }
    }
    randKeys = utils.arrayRand(keysForRand, {count:count, weightColumn:'w', randScale:randScale, boolMutualExclusive:boolMutualExclusive});
    if(1 == count){
      result = boolRetIdx ? randKeys['key'] : json[randKeys['key']];
    }else{
      for(var i = 0, len = randKeys.length; i < len; ++i){
        result.push(boolRetIdx ? randKeys[i]['key'] : json[randKeys[i]['key']]);
      }
    }
  }else{
    randKeys = utils.arrayRand(keys, {count:count, randScale:randScale, boolMutualExclusive:boolMutualExclusive});
    if(1 == count){
      result = boolRetIdx ?  randKeys : json[randKeys];
    }else{
      for(var i = 0, len = randKeys.length; i < len; ++i){
        result.push(boolRetIdx ? randKeys[i] : json[randKeys[i]]);
      }
    }
  }
  return result;
};

/**
 * flip keys and values of a json object
 * @param {Object} json - input json object
 * @returns {Object}
 */
utils.jsonFlip = function(json){
  var result = {};
  for(var i in json){
    if(json.hasOwnProperty(i)){
      result[json[i]] = i;
    }
  }
  return result;
};
/**
 * merge multiple json
 * @param {...Object} argumentList - input json list
 * @returns {Object}
 */
utils.jsonMerge = function(argumentList){
  var arrList = Array.prototype.slice.call(arguments, 0);
  return arrList.reduce(function(prevArr, curArr){
    return util._extend(prevArr,curArr);
  });
};

/**
 * remove empty elements of a json object
 * this method will change the original passed json object
 * @param {Object} json - input json object
 * @returns {Object}
 */
utils.jsonSimplify = function(json){
  for(var key in json){
    if(json.hasOwnProperty(key) && utils.isEmpty(json[key])){
      delete json[key];
    }
  }
  return json;
};

/** ========== JSON utils end ========== */

/**
 * 通过route获取对应的Id,可以自己指定type,但是必须>10000，防止和routeDict冲突
 * @param msg {Object} 格式为handler中的msg,
 * @returns {*}
 */
utils.getRouteId = function(msg){
  msg = msg || {};
  var actionName = msg.__route__ || utils.findCurrentHandler();
  if(actionName && routeDict[actionName]){
    return routeDict[actionName];
  }
  if(msg.type && msg.type >=10000){
    return msg.type;
  }
  return 0;
};

/**
 * Find a caller stack of a function
 * @param {Function}  [belowFunc=null]
 * @param {Number}    [traceLevel=Infinity]
 * @returns {*}
 */
utils.getStackTrace = function(belowFunc, traceLevel){
  var oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = traceLevel || Infinity;

  var dummyObject = {};

  var v8Handler = Error.prepareStackTrace;
  Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
    return v8StackTrace;
  };
  Error.captureStackTrace(dummyObject, belowFunc || utils.getStackTrace);

  var v8StackTrace = dummyObject.stack;
  Error.prepareStackTrace = v8Handler;
  Error.stackTraceLimit = oldLimit;

  return v8StackTrace;
};

/**
 * Find the top level Handler's Name of a function's caller
 * @param {Function}  [belowFunc=null]
 * @param {Number}    [traceLevel=10]
 * @returns {*}                 as gate.routeHandler.listRoute or null
 */
utils.findCurrentHandler = function(belowFunc, traceLevel){
  traceLevel = traceLevel || 10;
  var trace = utils.getStackTrace(belowFunc, traceLevel);
  var apiName = null;
  for(var i=0; i<trace.length; i++){
    var fileName = trace[i].getFileName();
    var funcName = trace[i].getFunctionName();
    if(fileName && funcName){
      var fileM = /servers\/(.*)\/[a-zA-Z]+\/(.*).js$/i.exec(fileName);//0 is whole str, 1 is serverType, 2 is fileName
      var funcM = /[a-zA-Z]+\.(.*)$/i.exec(funcName);//0 is whole str, 1 is funcName
      if( fileM && funcM){
        apiName = fileM[1] + '.' + fileM[2] + '.' + funcM[1];
        break;
      }
    }
  }
  return apiName;
};

/**
 * convert an array to a json as {id1:count1, id2:count2, ...}
 * @param {Array} arr
 */
utils.convertArrayToIdCountMapping = function(arr){
  var result = {};
  for(var i = 0, len = arr.length; i < len; ++i){
    var ele = arr[i];
    if(utils.isDefined(result[ele])){
      ++result[ele];
    }else{
      result[ele] = 1;
    }
  }
  return result;
};

/**
 * evaluate an expression or a formula
 * @param {String} formula
 * @param {Object} [params]
 * @returns {*}
 */
utils.evalFormula = function(formula, params){
  if(!utils.isString(formula)){
    return formula;
  }
  params = params || {};
  params['utRound'] = 'utils.round';
  params['utRand'] = 'utils.rand';
  var regExp;
  for(var key in params){
    if(params.hasOwnProperty(key)){
      regExp = new RegExp(key, 'g');
      formula = formula.replace(regExp, params[key]);
    }
  }
  delete params['utRound'];
  delete params['utRand'];
  var result;
  eval('result = ' + formula + ';');
  return result;
};

/**
 * almost same as php function "round", reference to https://github.com/kvz/phpjs/blob/master/functions/math/round.js
 * remove parameter "mode" so as to be identical to php's "round"
 * @param {Number} value
 * @param {Number} [precision]
 * @returns {Number}
 */
utils.round = function(value, precision) {
  if(!precision){
    return Math.round(value);
  }
  var m, f, isHalf, sgn; // helper variables
  // making sure precision is integer
  precision |= 0;
  m = Math.pow(10, precision);
  value *= m;
  // sign of the number
  sgn = (value > 0) | -(value < 0);
  isHalf = value % 1 === 0.5 * sgn;
  f = Math.floor(value);

  if (isHalf) {
    value = f + (sgn > 0);
  }

  return (isHalf ? value : Math.round(value)) / m;
};

/**
 * @param objects
 * @param cb
 */
utils.ready = function(objects, cb){
  var length = utils.keys(objects).length;
  if(length == 0){
    cb();
    return;
  }
  var c = 0;
  var res = {};
  for(var i in objects){
    res[i] = objects[i];
    objects[i].on("ready", function() {
      c++;
      if(c >= length){
        cb(null,res);
      }
    });
  }
};
/**
 * get today time
 * @param {Number} [nowTime]
 * @returns {Number}
 */
utils.getTodayTime = function(nowTime){
  nowTime = nowTime || utils.now();
  return utils.strtotime(utils.date('Y-m-d', nowTime));
};
/**
 * get last daily time
 * @param {Number} dailyTime
 * @param {Number} [nowTime]
 * @returns {Number}
 */
utils.getLastDailyTime = function(dailyTime, nowTime){
  nowTime = nowTime || utils.now();
  var time = utils.strtotime(utils.date('Y-m-d '+dailyTime, nowTime));
  if(time > nowTime){
    time -= 86400;
  }
  return time;
};

/**
 * get next daily time
 * @param {Number} dailyTime
 * @param {Number} [nowTime]
 * @returns {Number}
 */
utils.getNextDailyTime = function(dailyTime, nowTime){
  var time =  utils.getLastDailyTime(dailyTime, nowTime) + 86400 - 1;
  if(time < nowTime){
    time += 86400;
  }
  return time;
};

/**
 * @param {String} time (format HH:ii:ss)
 * @return {Number}
 */
utils.expire = function(time) {
  var freshTime = time.split(":");
  var freshHour = parseInt(freshTime[0] || 0);
  var freshMinute = parseInt(freshTime[1] || 0);
  var freshSecond = parseInt(freshTime[2] || 0);
  var freshMillisecond = parseInt(freshTime[3] || 0);

  var now = utils.unixNow();
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var day = today.getDate();
  var todayRefreshTime = (new Date(year, month, day, freshHour, freshMinute, freshSecond, freshMillisecond)).getTime();
  var todayUnixRefreshTime = Math.round(todayRefreshTime / 1000);

  return now >= todayUnixRefreshTime ? todayUnixRefreshTime - now + 24 * 3600 : todayUnixRefreshTime - now;
};
/**
 * @param {Number} week (0~6),星期一开始算第一天
 * @param {String} time (format HH:ii:ss)
 * @return {Number}
 */
utils.getTimeByWeek = function(week,time) {
  var freshTime = time.split(":");
  var freshHour = parseInt(freshTime[0] || 0);
  var freshMinute = parseInt(freshTime[1] || 0);
  var freshSecond = parseInt(freshTime[2] || 0);
  var freshMillisecond = parseInt(freshTime[3] || 0);

  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var day = today.getDate();
  var myWeek = today.getDay();
  var diffDay = week - myWeek;
  if(week == 0 && diffDay != 0){
    diffDay = 7 - myWeek;
  }else if(myWeek == 0 && diffDay != 0){
    diffDay = week - 7;
  }
  var todayRefreshTime = (new Date(year, month, day, freshHour, freshMinute, freshSecond, freshMillisecond)).getTime();
  return Math.round(todayRefreshTime / 1000)+diffDay*86400;
};

/**
 * calculate drop count
 * @param {Number} rate
 * @param {Number} maxRate
 * @param {Number} [scaleFactor=1]
 * @returns {Number}
 */
utils.calcDropCount = function(rate, maxRate, scaleFactor){
  scaleFactor = scaleFactor || 1;
  var dropCount = Math.floor(rate / maxRate);
  var remainRate = rate - dropCount * maxRate;
  if(utils.isChanceHit(remainRate, maxRate, scaleFactor)){
    ++dropCount;
  }
  return dropCount;
};

/**
 * calculate date string (e.g. 2015-01-01 => 20150101)
 * @param {Number} time
 * @retirms {String}
 */
utils.calcDateString = function(time){
  time = time || utils.now();
  return utils.date('Ym', time);
};

utils.getWeekBeginTime = function(time){
  time = time || utils.now();
  var todayBeginTime = utils.getTodayTime(time);
  var weekDay = utils.date('N');
  weekDay = weekDay ? weekDay : 7;
  return (todayBeginTime - (weekDay-1)*86400);
};

utils.getWeekEndTime = function(time){
  return (utils.getWeekBeginTime(time) +7*86400);
};

utils.generateWeekScheduleId = function(time){
  return utils.date('Ymd', utils.getWeekBeginTime(time));
};