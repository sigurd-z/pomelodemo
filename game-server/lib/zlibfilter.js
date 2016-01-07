/**
 * Created by aGoo on 14-6-2.
 */

var zlib = require('zlib');

// logger
var logger = require('pomelo-logger').getLogger('socket', __filename);
var utils = require('./utils');

module.exports = function() {
  return new Filter();
};

var Filter = function() {
};

Filter.prototype.before = function(msg, session, next){
  if(! msg.body ){
    delete msg['compress'];
    delete msg['body'];
    next();
    return;
  }
  logger.debug('received msg: %s', utils.toSimpleJson(msg));
  var compress = msg.compress;
  if(!Buffer.isBuffer(msg.body)){
    msg.body = new Buffer(msg.body);
  }
  if(!!compress){
    zlib.inflate(msg['body'], function(err, buffer){
      delete msg['compress'];
      delete msg['body'];
      if(!!err){
        logger.error('zlib inflate failed: %s', err);
        next(err);
      }else{
        logger.debug('zlib inflated: %s', buffer)
        extendObject(msg,parseJSON(buffer));
        next();
      }
    });
  }else {//NO compress,
    logger.debug('no compress')
    extendObject(msg,parseJSON(msg.body));
    delete msg['compress'];
    delete msg['body'];
    next();
  }
};

Filter.prototype.after = function(err, msg, session, response, next){
  next();
};

var extendObject = function(origin, add) {
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
};

var isObject = function(arg) {
  return typeof arg === 'object' && arg !== null;
};

var parseJSON = function(jsonData){
  var result = {};
  try{
    result = JSON.parse(jsonData);
  }catch (e){
    result = {};
  }
  return result;
};