/**
 * TCP Socket wrapper
 * Collect the package from socket and emit a completed package with 'data' event.
 * Support using a Message Queue to emit message event only after the last event has been processed
 *
 * Created by aGoo on 14-5-27.
 */
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Package = require('./protocol.js').Package;

var handlers = {};

handlers[Package.TYPE_HEARTBEAT] = function(libSocket, pkg) {
  //TODO -- Heartbeat logic
  console.log('[LibSocket]', 'Heartbeat from ' + libSocket.remoteAddress.ip + ':' + libSocket.remoteAddress.port);
};

handlers[Package.TYPE_DATA] = function(libSocket, pkg) {
  if(libSocket.state === ST_CLOSED) {
    return;
  }
  libSocket.emit('message', pkg);
  libSocket._WAITING_RESPONSE = true;
};

//SocketStatus
var ST_HEAD = 1;      // wait for head
var ST_BODY = 2;      // wait for body
var ST_CLOSED = 3;    // closed

var Socket = function(id, socket, opts) {
//Socket must emit these events for pomelo
// emit('disconnect'): when user close socket
// emit('error'): when socket error
// emit('message'): when get data from socket
  EventEmitter.call(this);
  this.id = id;
  this.socket = socket;
  this.remoteAddress = {
    ip: socket.remoteAddress,
    port: socket.remotePort
  };
  this.state = ST_HEAD;
  this.messageQueue = [];
  this.closeTimeout = opts.closeTimeout || 0;
  this.useLongConnection = false;
  this.useMsgQueue = opts.useMessageQueue ? true : false;
  this.socketNoDelay = opts.setNoDelay ? true : false;

  this.headSize = opts.headSize || 4;
  this.headBuffer = new Buffer(this.headSize);
  this.headHandler = opts.headHandler || headHandler;

  this.headOffset = 0;
  this.packageOffset = 0;
  this.packageSize = 0;
  this.packageBuffer = null;

  this._WAITING_RESPONSE = false;

//socket delay
  socket.setNoDelay(this.socketNoDelay);

//tcp socket event dealer
  socket.on('data', onData.bind(null, this));
  socket.on('end', onEnd.bind(null, this));
  socket.on('timeout', onTimeout.bind(null, this));
  socket.on('drain', onDrain.bind(null, this));
  socket.on('error', onError.bind(null, this));
  socket.once('close', onClose.bind(null, this));//close trigger only once

};

util.inherits(Socket, EventEmitter);

module.exports = Socket;

Socket.prototype.useMessageQueue = function(useQueue){
  this.useMsgQueue = useQueue ? true : false;
};

Socket.prototype.sendRaw = function(msg) {
  this.socket.write(msg, {binary: true});
};

/**
 * Send package to client, for Pomelo connector protocol
 * @param {Object} msg    data from connector.encode {id:xx, body:buffer}
 */
Socket.prototype.send = function(msg) {
  console.log('[LibSocket]', 'send begin');
  if(this.state === ST_CLOSED || !msg) {
    console.log('[LibSocket]', 'socket was closed OR data to send is NULL,send abort','error');
    return;
  }
  if(!Buffer.isBuffer(msg.body)){//Buffer check
    if(typeof(msg.body) === 'string' || msg.body instanceof String) {//string or String
      msg.body = new Buffer(msg.body);
    } else {//object
      var str = JSON.stringify(msg.body);
      if(!!str){
        msg.body = new Buffer(str);
      }else{//msg is not object
        console.log('[LibSocket]', 'Unknown message format(should be {id:number,body:buffer})','error');
        return;
      }
    }
  }
  this.sendRaw(Package.encode(Package.TYPE_DATA,msg.body));

  if(msg.id && msg.id>0 && this._WAITING_RESPONSE){//system message's id is null or 0
  //this is a response to client
  //so we can deal with (emit) next message
    this._WAITING_RESPONSE = false;
    this.nextMessage();
  }
  console.log('[LibSocket]', 'send end');
};

/**
 * Private API, deal with package
 * @param pkg
 */
Socket.prototype.handlePackage = function(pkg) {
  if(!!pkg){
    var handler = handlers[pkg.type];
    if(!!handler) {
      handler(this, pkg);
    }	else {
      console.log('[LibSocket]', 'Unknown package type ' + pkg.type + '.', 'error');
      this.disconnect();
    }
  }
};

/**
 * Private API, deal with message queue
 */
Socket.prototype.nextMessage = function() {
  if( !this._WAITING_RESPONSE && this.useMsgQueue && this.messageQueue.length>0){
    console.log('[LibSocket]', 'trigger next message');
    this.handlePackage(Package.decode(this.messageQueue.shift()));
  }
};

/**
 * Disconnect client socket, for Pomelo connector protocol
 */
Socket.prototype.disconnect = function() {
  console.log('[LibSocket]', 'disconnect');
  if(this.state === ST_CLOSED) {
    return;
  }
  this.messageQueue = null;
  this.state = ST_CLOSED;
  this.socket.end();
};

/**
 * Send multi packages to client in batch.
 * @param {Buffer} msgs   byte data
 */
Socket.prototype.sendBatch = function(msgs) {
  var rs = [];
  var hasRspToClient = false;
  for(var i=0; i<msgs.length; i++) {
    var src = Package.encode(Package.TYPE_DATA, msgs[i]['body']);
    rs.push(src);
    if(msgs[i]['id'] && msgs[i]['id']>0) hasRspToClient = true;//response to client
  }
  this.sendRaw(Buffer.concat(rs));
  if(hasRspToClient && this._WAITING_RESPONSE){
    //have response to client
    //so we can deal with (emit) next request message
    this._WAITING_RESPONSE = false;
    this.nextMessage();
  }
};

var onData = function(libSocket, chunk) {
  console.log('[LibSocket]', 'on data');
  if(libSocket.state === ST_CLOSED) {
    console.log('[LibSocket]', 'socket had been closed');
    return true;
  }
  if(typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {//format error, close socket
    console.log('[LibSocket]', 'invalid data' + libSocket.remoteAddress.ip + ', close socket!', 'error');
    libSocket.socket.end();
    return true;
  }
  if(typeof chunk === 'string') {
    chunk = new Buffer(chunk);
  }
  if(libSocket.state === ST_HEAD && libSocket.packageBuffer === null && !acceptableTypeData(chunk[0])){//data type unknown, close socket
    console.log('[LibSocket]', 'invalid data format from ' + libSocket.remoteAddress.ip + ', close socket!', 'error');
    libSocket.disconnect();
    return true;
  }

  //Deal With Package Divide
  //message will be emit in readBody
  var offset = 0, end = chunk.length;
  while(offset < end) {
    if(libSocket.state === ST_HEAD) {
      offset = readHead(libSocket, chunk, offset);
      if(offset < 0){//bad package
        console.log('[LibSocket]', 'invalid body from ' + libSocket.remoteAddress.ip + ', close socket!', 'error');
        libSocket.disconnect();
        break;
      }
    }
    if(libSocket.state === ST_BODY) {
      offset = readBody(libSocket, chunk, offset);
    }
  }

  return true;
};

var onDrain = function(libSocket){
//When socket.write returns false, this mean system stream is full
//So check drain event
//And drain will be fired when stream is empty
  console.log('[LibSocket]', 'on drain(empty output stream)');
};

var onEnd = function(libSocket, chunk) {
  console.log('[LibSocket]', 'on end');
  if(chunk) {
    libSocket.sendRaw(Package.encode(chunk));
  }
  libSocket.messageQueue = null;
  reset(libSocket);
  libSocket.state = ST_CLOSED;
  libSocket.emit('end');
  destroy(libSocket);
};

var onTimeout = function(libSocket) {
  if(!libSocket.useLongConnection){
    console.log('[LibSocket]', 'on close timeout' + libSocket.closeTimeout + '. close socket.');
    reset(libSocket);
    libSocket.socket.end();
    destroy(libSocket);
  }
};

var onError = function(libSocket, err){
  console.log('[LibSocket]', 'on error');
  reset(libSocket);
  libSocket.emit('error', err);
  destroy(libSocket);
};

var onClose = function(libSocket){
  console.log('[LibSocket]', 'on close');
  reset(libSocket);
  libSocket.emit('disconnect');//emit distinct when user close socket
  libSocket.emit('close');
  destroy(libSocket);
};

var acceptableTypeData = function(type) {
  return type === Package.TYPE_HANDSHAKE || type === Package.TYPE_HANDSHAKE_ACK || type === Package.TYPE_HEARTBEAT || type === Package.TYPE_DATA || type === Package.TYPE_KICK;
};

var headHandler = function(headBuffer) {//little endian
  return (headBuffer[3] << 16 | headBuffer[2] << 8 | headBuffer[1]) >>> 0;
};

/**
 * Read head segment from data to socket.headBuffer.
 *
 * @param  {Object} socket libSocket instance
 * @param  {Object} data   Buffer instance
 * @param  {Number} offset offset read star from data
 * @return {Number}        new offset of data after read/ -1:error
 */
var readHead = function(libSocket, data, offset) {
  var hlen = libSocket.headSize - libSocket.headOffset;//remain max length
  var dlen = data.length - offset;//data length
  var len = Math.min(hlen, dlen);//read length
  var dend = offset + len;//end of read position

  data.copy(libSocket.headBuffer, libSocket.headOffset, offset, dend);
  libSocket.headOffset += len;

  if(libSocket.headOffset === libSocket.headSize) {
    // if head segment finished
    var size = libSocket.headHandler(libSocket.headBuffer);
    if(size < 0) {
      //size error, return false
      //throw new Error('invalid body size');
      return -1;
    }
    libSocket.packageSize = size + libSocket.headSize;
    libSocket.packageBuffer = new Buffer(libSocket.packageSize);
    libSocket.headBuffer.copy(libSocket.packageBuffer, 0, 0, libSocket.headSize);
    libSocket.packageOffset = libSocket.headSize;
    libSocket.state = ST_BODY;
  }

  return dend;
};

/**
 * Read body segment from data buffer to socket.packageBuffer;
 *
 * @param  {Object} socket libSocket instance
 * @param  {Object} data   Buffer instance
 * @param  {Number} offset offset read star from data
 * @return {Number}        new offset of data after read
 */
var readBody = function(libSocket, data, offset) {
  var blen = libSocket.packageSize - libSocket.packageOffset;//remain max length
  var dlen = data.length - offset;//data length
  var len = Math.min(blen, dlen);//read need length
  var dend = offset + len;//end of read position

  data.copy(libSocket.packageBuffer, libSocket.packageOffset, offset, dend);
  libSocket.packageOffset += len;

  if(libSocket.packageOffset === libSocket.packageSize) {
    // if all the package finished
    var buffer = libSocket.packageBuffer;
    if(libSocket.useMsgQueue && libSocket._WAITING_RESPONSE){
      libSocket.messageQueue.push(buffer);
    }else{
      libSocket.handlePackage(Package.decode(buffer));//Package format is type:1byte,length:3byte,data:length
    }
    reset(libSocket);
  }

  return dend;
};

var reset = function(libSocket) {
  libSocket.headOffset = 0;
  libSocket.packageOffset = 0;
  libSocket.packageSize = 0;
  libSocket.packageBuffer = null;
  libSocket.state = ST_HEAD;
};

var destroy = function(libSocket){
  if(libSocket && libSocket.socket){
    try {
      libSocket.socket.destroy();
    } catch (e) {
    }
  }
};
