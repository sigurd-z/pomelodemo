/**
 * Created by aGoo on 14-6-2.
 */
var zlib = require('zlib');
var Code = require('../../../consts/code.js');
var dispatcher = require('../../../util/dispatcher.js');
var utils = require('../../../util/utils.js');
var libDictionary = require('../../../../lib/dictionary.js');

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app){
  this.app = app;
};

/**
 * List all API as [apiName: apiNo,...]
 * @param msg
 * @param session
 * @param next
 */
Handler.prototype.listRoute = function(msg, session, next){
  var dict = null;
  var dynamic = msg.dynamic || false;
  if(!dynamic && this.app.get('STATIC_ROUTE')){
    var myDict = new libDictionary(this.app);
    dict = myDict.getDict();
  }else{
    var myDic = this.app.components.__dictionary__;
    dict = myDic.getDict();
  }
  body = zlib.deflateSync(JSON.stringify(dict));
  next(null,{code:Code.OK, body:body, compress:true});
};

/**
 * API not found, come with coding error or attack usually
 * @param msg
 * @param session
 * @param next
 */
Handler.prototype.errRoute = function(msg, session, next){
  next(null,{code:Code.API_ROUTE_NOT_FOUND});
};