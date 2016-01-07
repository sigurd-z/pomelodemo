/**
 * Created by aGoo on 14-6-2.
 */

var zlib = require('zlib');

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
  console.log('[zlibFilter DEBUG] received msg: ', msg)
  var compress = msg.compress;
  if(!Buffer.isBuffer(msg.body)){
    msg.body = new Buffer(msg.body);
  }
  if(!!compress){
    zlib.inflate(msg['body'], function(err, buffer){
      delete msg['compress'];
      delete msg['body'];
      if(!!err){
        console.log('[zlibFilter ERROR] zlib inflate failed: ', err)
        next(err);
      }else{
        console.log('[zlibFilter DEBUG] zlib inflated: ', parseJSON(buffer))
        extendObject(msg,parseJSON(buffer));
        next();
      }
    });
  }else {//NO compress,
    console.log('[zlibFilter DEBUG] no compress')
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