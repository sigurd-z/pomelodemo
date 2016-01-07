/**
 * Created by aGoo on 14-5-19.
 */

var utils = module.exports;

utils.toSimpleJson = function(obj){
  if(!obj || typeof(obj) !== 'object'){
    return obj;
  }
  var out = {};
  for(var key in obj){
    if(typeof(obj[key]) == 'object'){
      out[key] = '[object Object]';
    } else {
      out[key] = obj[key];
    }
  }
  return JSON.stringify(out);
};