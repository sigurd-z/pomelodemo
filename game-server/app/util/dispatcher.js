/**
 * Created by aGoo on 14-5-19.
 */

var crc = require('crc');

var exp = module.exports;

exp.hashDispatch = function(uid, connectors) {
  if(!connectors || connectors.length ===0)
    return null;
  var index = Math.abs( crc.crc32(uid) ) % connectors.length;
  return connectors[index];
};
