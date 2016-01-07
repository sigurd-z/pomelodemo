/**
 * Created by aGoo on 2014-08-07.
 */

var Dictionary = function(app){
  this.dict = {};
  this.abbrs = {};
  if(!!app){
    var dict = require(app.getBase() + '/config/routeDict.json');
    /* dict is format as:
    {
      serverType.handlerName.actionName : "routeId",
      ....
    }
    */
    var keys = Object.keys(dict);
    this.dict = dict;
    for(var i=0, l=keys.length; i<l; i++){
      this.abbrs[ dict[ keys[i] ] ] = keys[i];
    }
  }
};

module.exports = Dictionary;

Dictionary.prototype.getDict = function() {
  return this.dict;
};

Dictionary.prototype.getAbbrs = function() {
  return this.abbrs;
};