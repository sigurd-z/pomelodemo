/**
 * Created by aGoo on 14-5-27.
 */
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var libSocket = require('./socket.js');
var libCoder = require('./coder.js');
var libDictionary = require('./dictionary.js');

// logger
var logger = require('pomelo-logger').getLogger('socket', __filename);

var DEFAULT_ROUTE_PATH = 'default.defaultHandler.defaultRoute';
var DEFAULT_ERR_ROUTE = 'default.defaultHandler.defaultError';

var DEFAULT_ROUTE_ID = 0;

var curId = 1;
var MAX_INT = Math.pow(2,53)-1000;
//NODE INT.MAX is 2^53
//WE LIMIT MAX to INT.MAX-1000 for SAFETY
//1,000,000 USERS * 10,000 REQ/DAY
//MAX_INT can afford 2000+ years

var MAX_ARRAY_LENGTH = 0xFFFFFFFF-2;
//NODE ARRAY.MAX_LENGTH is 2^32-1
//WE LIMIT MAX to ARRAY.MAX_LENGTH -1 for SAFETY
//IF 1,000,000 USERS * 10,000 REQ/DAY IN 1 MACHINE
//MAX_ARRAY_LENGTH can afford 4 days

var Connector = function(port, host, opts) {
  if (!(this instanceof Connector)) {
    return new Connector(port, host, opts);
  }

  EventEmitter.call(this);

  this.opts = opts || {};
  this.port = port;
  this.host = host;
  this.tcpServer = null;
  this.defaultRouteId = opts.defaultRouteId || DEFAULT_ROUTE_ID;
  this.defaultRoute = opts.defaultRoute || DEFAULT_ROUTE_PATH;
  this.defaultErrRoute = opts.defaultErrRoute || DEFAULT_ERR_ROUTE;
  this.useDict = true;//force use dictionary component
  this.useStaticDict = opts.useStaticDict || false;
  this.aesKey = opts.aesKey;//if undefined, the default value will be used in protocol
  this.useMessageQueue = opts.useMessageQueue ? true : false;
  this.closeTimeout = opts.closeTimeout || 0;//milliseconds, 0: do not check timeout
};

util.inherits(Connector, EventEmitter);

module.exports = Connector;

Connector.prototype.start = function(cb) {
  var self = this;
  var app = require('pomelo').app;
  if(!!this.useStaticDict){
    this.dictionary = new libDictionary(app);
  }else{
    this.dictionary = app.components.__dictionary__;//dictionary component
  }
  this.tcpServer = net.createServer(this.opts);
  this.tcpServer.listen(this.port, this.host);
  this.tcpServer.on("connection", function(socket){
    var libsocket = new libSocket(curId++, socket, self.opts);
    if(curId > MAX_ARRAY_LENGTH){
      curId = 1;
    }
    libsocket.useMessageQueue(self.useMessageQueue);//libsocket will emit 'message' event when data comes
    if(self.closeTimeout){//socket will be end after idle last for closeTimeout milliseconds
      libsocket.socket.setTimeout(self.closeTimeout);
    }
    libsocket.on('closing', function(reason) {
      logger.debug('on socket %s closing, reason:%s err', libsocket.id, reason);
    });
    self.emit('connection', libsocket);//all connector must emit this event to pomelo
  });

  this.tcpServer.on("error", function(err){
    if (err.code == 'EADDRINUSE') {//err: {code:'', errno:'', syscall:''}
      logger.debug('Address in use, retrying...');
      setTimeout(function () {
        self.tcpServer.close();
        self.tcpServer.listen(self.port, self.host);
      }, 1000);
    }
    logger.error('Server Error: [%s] %s', err.code, err.message);
  });

  this.tcpServer.on("close", function(){
    logger.debug('libConnector on socket close');
  });

  process.nextTick(cb);
};

Connector.prototype.stop = function(force, cb) {
  this.tcpServer.close();

   process.nextTick(cb);
};

Connector.encode = Connector.prototype.encode = function(reqId, route, msg){//msg:{} from serverHandler
  var routeId = 0;
  if(!!reqId) {//RESPONSE
  } else {//PUSH
    if(!route || !msg){
      logger.error('route or message is need for server push');
      return null;
    }
    var dict = this.dictionary.getDict();//format as {'serverType.Handler.action': index,...} index starts from 1
    if(dict && !!dict[route]) {
      routeId = dict[route];
    }else{
      logger.error('EncodeError. routeId %s not found', route);
      return null;
    }
  }
  msg.routeId = routeId;
  msg.aesKey = this.aesKey;
  return msg;
};

Connector.decode = Connector.prototype.decode = function(msg){//msg:{type:xx, body:xx} from pomelo
  if(!(msg.body)){
    return null;
  }
  msg = libCoder.decode(this.aesKey, msg.body);
  if(!msg){
    logger.error('decode failed');
    return null;
  }
  var routeId = msg.route;//number
  if(routeId == this.defaultRouteId){//default query for all route
    return {
      id: msg.id,
      route: this.defaultRoute,
      body: {
        compress: msg.compress,
        body: msg.body
      }
    }
  }
//MAP routeId to routeString
  var abbrs = this.dictionary.getAbbrs();//format as {index:'serverType.Handler.action',...} index starts from 1
  if(!abbrs || (!!abbrs && !abbrs[routeId])) {
    logger.error('DecodeError. routeId %s not found, use defaultError handler', routeId);
    msg.route = this.defaultErrRoute;
    msg.compress = 0;
    msg.body = null;
  }else{
    msg.route = abbrs[routeId];
  }

  return {
    id: msg.id,
    route: msg.route,
    body:{
      compress: msg.compress,
      body: msg.body
    }
  };
};