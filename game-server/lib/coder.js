/**
 * Created by aGoo on 14-5-28.
 */
var libProtocol = require('./protocol.js');
var libMessage = libProtocol.Message;

/**
 * Encode for pomelo
 * @param {String} aesKey  secretKey for AES
 * @param {Number} reqId
 * @param {Number} routeId
 * @param {Object} msgBody {compress:0/1,data:''}
 * @returns {Object}       Message data used for Package.encode()
 */
var encode = function(aesKey, reqId, routeId, msgBody){
  if(!!reqId) {//RESPONSE
    if(!msgBody) {
      return null;
    }
    return libMessage.encode(aesKey, reqId, null, msgBody);
  } else {//PUSH
    if(!routeId || !msgBody){
      return null;
    }
    return libMessage.encode(aesKey, null, routeId, msgBody);
  }
};

/**
 * Decode for pomelo
 * @param {String}        aesKey secretKey for AES
 * @param {Object|Buffer} msgBuf Package.decode as {type:x,body:x} || directly Package.decode.body
 * @returns {Object}             {id: number, route: number, compress:boolean, body: buffer}
 */
var decode = function(aesKey, msgBuf){
  if(typeof msgBuf === 'object' && !Buffer.isBuffer(msgBuf)){
    msgBuf = msgBuf.body;
  }
  var result;
  try{//decode may have error when use decipher
    result = libMessage.decode(aesKey, msgBuf);//get real message
  }
  catch(err) {//decode fail
    result = null;
  }
  return result;
};

module.exports = {
  encode: encode,
  decode: decode
};