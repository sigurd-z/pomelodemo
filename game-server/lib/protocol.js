/**
 * Created by aGoo on 14-5-29.
 */
var crypto = require('crypto');

var Protocol = module.exports;

var Package = Protocol.Package = {};
var Message = Protocol.Message = {};

var PKG_HEAD_BYTES = 4;

var MSG_HEAD_BYTES = 5;
var MSG_DATA_COMPRESS = 0x01;
var MSG_DATA_NOCOMPRESS = 0x00;
var MSG_DATA_COMPRESS_LIMIT = 480;

var AES_ALGORITHM = 'aes-256-cbc';
var AES_DEFAULT_KEY = 'ImportantThingsAreToBeRepeated3T';//32
var AES_DEFAULT_IV = 'ThisAESDefaultIV';//16

Package.TYPE_HANDSHAKE = 1;
Package.TYPE_HANDSHAKE_ACK = 2;
Package.TYPE_HEARTBEAT = 3;
Package.TYPE_DATA = 4;
Package.TYPE_KICK = 5;

Message.TYPE_REQUEST = 0;
Message.TYPE_NOTIFY = 1;
Message.TYPE_RESPONSE = 2;
Message.TYPE_PUSH = 3;

/**
 * Package protocol encode.
 * format as pomelo:
 * +------+-------------+------------------+
 * | type | body length |       body       |
 * +------+-------------+------------------+
 *
 * Head: 4bytes
 *   0: package type,
 *      1 - handshake,
 *      2 - handshake ack,
 *      3 - heartbeat,
 *      4 - data
 *      5 - kick
 *   1~3: big-endian body length
 * Body: body length bytes
 *  Format: see Message.encode
 * @param  {Number}  type   package type
 * @param  {Buffer}  body   body content in bytes
 * @return {Buffer}         new byte array that contains encode result
 */
Package.encode = function(type, body){
  type = type || 4;
  var length = body ? body.length : 0;
  var buffer = new Buffer(PKG_HEAD_BYTES + length);
  var index = 0;
  buffer[index++] = type & 0xff;
  buffer[index++] = length & 0xff;
  buffer[index++] = (length >> 8) & 0xff;
  buffer[index++] = (length >> 16) & 0xff;

  if(body) {
    copyArray(buffer, index, body, 0, length);
  }
  return buffer;
};

/**
 * Package protocol decode.
 * See encode for package format.
 * @param  {Buffer} buffer    byte array containing package content
 * @return {Object}           {type: package type, body: body byte array}
 */
Package.decode = function(buffer){
  var offset = 0;
  var bytes = new Buffer(buffer);
  var length = 0;
  var remainLength = bytes.length;
  var rs = [];
  while(offset < bytes.length) {
    var type = bytes[offset++];
    length = ( bytes[offset++] | (bytes[offset++]) << 8 | (bytes[offset++]) << 16 ) >>> 0;
    remainLength = bytes.length - offset;
    if(remainLength<length){
      break;//package error
    }
    if(!!length){
      var body = new Buffer(length);
      copyArray(body, 0, bytes, offset, length);
      rs.push({'type': type, 'body': body});
    }else{
      rs.push({'type': type, 'body': null});//NO body
    }
    offset += length;
  }
  return rs.length === 1 ? rs[0]: rs;
};

/**
 * Message protocol encode.
 *
 * Message Body format:
 * +------+---------+-----------+------------------+
 * | id   |   route | zip flag  |       body       |
 * +------+---------+-----------+------------------+
 * Head: 5Bytes
 *  0~1: requestId  2ByteInt
 *  2~3: route   int  use route hash to make map
 *  4 :  body data use compress or not
 *    0x00: no, 0x01:yes
 * Body: length - 5
 *  Real Message Data
 *
 * @param  {String} aesKey            key for AES
 * @param  {Number} reqId             message id
 * @param  {Number|String} routeId    route id
 * @param  {Object} msg               format as {compress:0/1, body:Buffer/or json string}
 * @param  {boolean} msg.compress
 * @param  {Buffer} msg.body
 * @return {Object}                   encode result {id:xx, body:xx} body is for package.encode
 */
Message.encode = function(aesKey, reqId, routeId, msg){
  var useCompress = msg.compress ? MSG_DATA_COMPRESS : MSG_DATA_NOCOMPRESS;
  aesKey = aesKey || AES_DEFAULT_KEY;
  reqId = reqId || 0;
  routeId = routeId || 0;
  if(typeof(msg.body) === 'undefined'){
    return null;
  }
//1: TO BUFFER
  if(!Buffer.isBuffer(msg.body)){//Buffer check
    if(typeof(msg.body) === 'string' || msg.body instanceof String) {//string or String
      msg.body = new Buffer(msg.body);
    } else {//object
      var str = JSON.stringify(msg.body);
      if(!!str){
        msg.body = new Buffer(str);
      }else{//body is not object
        return null;
      }
    }
  }
//2: AES
  var iv = getIvFromIds(reqId, routeId);
  var key = new Buffer(aesKey);
  var cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  var body = [cipher.update(msg.body)];//input/output both buffer
  body.push(cipher.final());
  body = Buffer.concat(body);
//3: FORMAT AS ID+ID+ROUTE+ROUTE+COMPRESS+BODY
  var length = body ? body.length : 0;
  var buffer = new Buffer(MSG_HEAD_BYTES + length);
  var index = 0;
  buffer[index++] = reqId & 0xff;          //0 is id lower8bit
  buffer[index++] = (reqId >> 8) & 0xff;   //1 is id higher8bit
  buffer[index++] = routeId & 0xff;       //2 is id lower8bit
  buffer[index++] = (routeId >> 8) & 0xff;//3 is id higher8bit
  buffer[index++] = useCompress & 0xff; //4 is compress bit
  if(body) {
    copyArray(buffer, index, body, 0, length);
  }
//4: RETURN AS OBJECT
  return {'id': reqId, 'body':buffer};
};

/**
 * Message protocol decode.
 *
 * @param  {String} aesKey              key for AES
 * @param  {Buffer|Uint8Array} buffer   message bytes
 * @return {Object}                     message object
 */
Message.decode = function(aesKey, buffer){
  var requestId = 0;
  var routeId = 0;
  var useCompress = 0;
  var body = null;
  if(!buffer){
    return {'id': requestId, 'route': routeId, 'compress': useCompress, 'body': body};
  }
//1: PARSE FORMAT
  if(typeof buffer === 'object' && !Buffer.isBuffer(buffer)){//deal with pass package.decode result
    buffer = buffer.body;
  }
//1.0 FORMAT CHECK
  var offset = 0;
  var bytes = new Buffer(buffer);
  var dataLength = bytes.length;
  if(dataLength < MSG_HEAD_BYTES){//FORMAT ERROR, OUTPUT DEFAULT
    return {'id': requestId, 'route': routeId, 'compress': useCompress, 'body': body};
  }
//1.1 HEADER PARSE
  requestId = ( bytes[offset++] | (bytes[offset++]) << 8 ) >>> 0;
  routeId = ( bytes[offset++] | (bytes[offset++]) << 8 ) >>> 0;
  useCompress = bytes[offset++];

//1.2 BODY PARSE
  var bodyLength = dataLength - MSG_HEAD_BYTES; //>=0
  body = bodyLength ? new Buffer(bodyLength) : null;
  if(body){
//2: DE-AES
    copyArray(body, 0, bytes, offset, bodyLength);
    var key = new Buffer(aesKey);
    var iv = getIvFromIds(requestId, routeId);
    var deCipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    body = [deCipher.update(body)];
    body.push(deCipher.final());
    body = Buffer.concat(body);
  }
//3: RETURN AS OBJECT
  return {'id': requestId, 'route': routeId, 'compress': useCompress, 'body': body};
};

var copyArray = function(dest, doffset, src, soffset, length) {
  src.copy(dest, doffset, soffset, soffset + length);//Buffer
};

var getIvFromIds = function(reqId, routeId){
  var buf = new Buffer(16);
  var n = (reqId & 0xffff) + (routeId & 0xffff);
  var k = 1509088093;
  k = (k * n) % 2147483648 - (Math.floor(k * n / 2147483648) % 2) * 2147483648;
  var v = [ k & 0xff, (k >> 8) & 0xff, (k >> 16) & 0xff, (k >> 24) & 0xff ];
  var iv = [89, 6, 109, 174, 60, 223, 46, 227, 146, 168, 111, 27, 228, 107, 143, 113];
  for(var i = 0; i < 16; i++){
    buf[i] =  iv[i] ^ v[i % 4];
  }
  return buf;
};
