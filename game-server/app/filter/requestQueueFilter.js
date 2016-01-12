/**
 * Created by cheyb on 15-3-20.
 */

var logger = require('pomelo-logger').getLogger('website', __filename);

var apiFilterWaitCountLowLimit = 30;//运行的request超过30后 添加进队列

module.exports = function (maxCount) {
  return new Filter(maxCount);
};

var Filter = function (maxCount) {
  this.requestQueue = [];
  this.apiFilterWaitCountHighLimit = maxCount || Number.MAX_VALUE;
  this.apiFilterWaitCount = 0;//运行的request数
};

Filter.prototype.handlerQueue = function () {
  if(this.requestQueue.length <= 0){
    return;
  }
  var handlerQueueCount = apiFilterWaitCountLowLimit - this.apiFilterWaitCount;
  logger.info("waitCount : %s,handlerQueueCount : %s", this.apiFilterWaitCount, handlerQueueCount);
  for (var i = 0; i < handlerQueueCount && i < this.requestQueue.length; i++) {
    var handlerNextItem = this.requestQueue.shift();
    logger.info("requestQueue.length : %s", this.requestQueue.length);
    this.apiFilterWaitCount++;
    process.nextTick(function () {
      handlerNextItem.next();
    });
  }
};

Filter.prototype.before = function (msg, session, next) {
  if (this.apiFilterWaitCount < this.apiFilterWaitCountHighLimit) {//push to api
    this.apiFilterWaitCount++;
    logger.info("[direct]apiFilterWaitCount++ : %s", this.apiFilterWaitCount);
    next();
  } else {//push to queue
    this.requestQueue.push({ next: next });
    this.handlerQueue();
  }
};

Filter.prototype.after = function (err, msg, session, resp, next) {
  this.apiFilterWaitCount--;
  this.handlerQueue();
  next(err, msg);
};