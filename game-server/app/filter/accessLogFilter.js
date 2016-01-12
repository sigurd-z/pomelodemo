/**
 * Created by cheyb on 15:3:20.
 */

var logger = require('pomelo-logger').getLogger('access');
var pomelo = require('pomelo');

module.exports = function(opts) {
  return new Filter(opts);
};

var Filter = function(opts) {
  this.curId = 0;
  if(opts && opts.slowTime){
    this.slowLogger = require('pomelo-logger').getLogger('slowlog');
    this.slowTime = opts.slowTime;
  }
};

Filter.prototype.before = function(msg, session, next){
  this.curId++;
  session.__timestart__ = Date.now();
  var ip = session.get('clientIp');
  if(!ip){
    var sessionService = pomelo.app.get('sessionService');
    if(sessionService && typeof sessionService.getClientAddressBySessionId == 'function'){
      var client = sessionService.getClientAddressBySessionId(session.id);
      if(client){
        ip = client.ip;
      }
    }
  }
  session.__accessId__ = this.curId+',ip: '+ip+',uuid: '+msg.uuid;
  logger.debug('accessId:%s,[request] %j',session.__accessId__, msg);
  next();
};

Filter.prototype.after = function(err, msg, session, response, next){
  var execTime = Date.now() - session.__timestart__;
  logger.debug('accessId: %s,execTime: %sms,response: %j',
    session.__accessId__,
    execTime,
    response);
  if(this.slowLogger && execTime >= this.slowTime){
    this.slowLogger.warn('accessId: %s,execTime: %sms,request: %j',
      session.__accessId__,
      execTime,
      msg);
  }
  next();
};
