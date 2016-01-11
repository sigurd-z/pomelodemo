/**
 * Created by aGoo on 14-5-22.
 */

module.exports = function(app){
  return new Handler(app);
};

var Handler = function(app){
  this.app = app;
};