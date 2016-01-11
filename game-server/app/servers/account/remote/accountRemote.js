/**
 * Created by aGoo on 14-7-2.
 */

var Code = require('../../../consts/code.js');

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

Handler.prototype.getPlayerInfo = function(uuid, accountId, worldId, params, callback) {
  callback(null, {code: Code.OK, data:params});
};