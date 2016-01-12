/**
 * Created by aGoo on 14-6-3.
 */
var utils = require('../app/util/utils.js');
var zlib = require('zlib');
var libCoder = require('./coder.js');

var Service = function(app, opts) {
  if (!(this instanceof Service)) {
    return new Service(app, opts);
  }

  opts = opts || {};
  this.app = app;
};

module.exports = Service;

Service.prototype.schedule = function(reqId, route, msg, recvs, opts, cb) {
  opts = opts || {};
  var self = this;
  var aesKey = msg.aesKey;
  var routeId = msg.routeId;
  delete msg['aesKey'];
  delete msg['routeId'];
  var bufResponse = new Buffer(JSON.stringify(msg));
  var res = {compress:false, body:bufResponse};
  if(bufResponse.length > utils.MSG_DATA_COMPRESS_LIMIT) {
    res.compress = true;
    zlib.deflate(bufResponse, function (err, buffer) {
      res.body = buffer;
      self._doEncodeAndCB(aesKey, reqId, routeId, res, recvs, opts, cb);
    });
  }else{
    self._doEncodeAndCB(aesKey, reqId, routeId, res, recvs, opts, cb);
  }
};

Service.prototype._doEncodeAndCB = function(aesKey, reqId, routeId, res, recvs, opts, cb){
  var msg = libCoder.encode(aesKey, reqId, routeId, res);
  if (opts.type === 'broadcast') {
    doBroadcast(this, msg, opts.userOptions);
  } else {
    doBatchPush(this, msg, recvs);
  }
  if (cb) {
    process.nextTick(function () {
      utils.invokeCallback(cb);
    });
  }
};

var doBroadcast = function(self, msg, opts) {
  var channelService = self.app.get('channelService');
  var sessionService = self.app.get('sessionService');
  if(opts.binded) {
    sessionService.forEachBindedSession(function(session) {
      if(channelService.broadcastFilter &&
        !channelService.broadcastFilter(session, msg, opts.filterParam)) {
        return;
      }

      sessionService.sendMessageByUid(session.uid, msg);
    });
  } else {
    sessionService.forEachSession(function(session) {
      if(channelService.broadcastFilter &&
        !channelService.broadcastFilter(session, msg, opts.filterParam)) {
        return;
      }

      sessionService.sendMessage(session.id, msg);
    });
  }
};

var doBatchPush = function(self, msg, recvs) {
  var sessionService = self.app.get('sessionService');
  for(var i=0, l=recvs.length; i<l; i++) {
    sessionService.sendMessage(recvs[i], msg);
  }
};
