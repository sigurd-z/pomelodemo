/**
 * Filter for toobusy.
 * if the process is toobusy, just skip the new request
 */
var conLogger = require('pomelo-logger').getLogger('website', __filename);
var toobusy = null;
var DEFAULT_MAXLAG = 70;


module.exports = function(maxLag) {
  return new Filter(maxLag || DEFAULT_MAXLAG);
};

var Filter = function(maxLag) {
  try {
    toobusy = require('toobusy');
  } catch(e) {
  }
  if(!!toobusy) {
    toobusy.maxLag(maxLag);
  }
};

Filter.prototype.before = function(msg, session, next) {
  if (!!toobusy && toobusy()) {
    conLogger.error('[TOOBUSY] LAG LIMIT ' + toobusy.maxLag() + 'ms. Reject Request msg: ' + msg);
    next({code: 503, message: 'SERVER TOO BUSY! PLEASE TRY AGAIN LATER!'});
  } else {
    next();
  }
};

Filter.prototype.after = function(err, msg, session, response, next) {
  next();
};
