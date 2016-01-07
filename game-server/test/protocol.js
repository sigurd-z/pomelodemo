/**
 * Created by aGoo on 14-6-2.
 */
var net = require('net');//.Socket;
var assert = require('assert');
var zlib = require('zlib');
var libProtocol = require('../lib/protocol.js');
var reqId = 1;
var routeId = 0;//listRoute
var aesKey = 'HuJb4NqADyiGcHTfzhQXv9HKrfDqJcXu';

var msg = {compress:false, body:JSON.stringify({uuid:'agoo',account:1,osType:0})};
msg.compress = true;
msg.body = zlib.deflateSync(msg.body);
describe('libConnector', function(){
  var socket;
  describe('#connect+request', function() {
    it('should get server response', function (done) {
      console.log('\n\t======REQUEST LOG======');
      socket = net.connect({port: 3010, host: '127.0.0.1'}, function () {
        console.log('\tConnected\t' + Date.now());
        var buf = libProtocol.Message.encode(aesKey, reqId, routeId, msg);
        var pkg = libProtocol.Package.encode(libProtocol.Package.TYPE_DATA, buf.body);
        socket.write(pkg);
        console.log('\tRequestSent\t' + Date.now());
      });
      socket.on('error', function(err){
        done(err);
      });
      socket.on('data', function (data) {
        console.log('\tResponse\t' + Date.now());
        var buf = libProtocol.Package.decode(data);
        var msg = libProtocol.Message.decode(aesKey, buf);
        if (msg.compress) {
          zlib.inflate(msg.body, function (err, buffer) {
            if (!!err) {
              console.log(err.message);
            } else {
              dumpResult(JSON.parse(buffer),done);
            }
          });
        } else {
          dumpResult(JSON.parse(msg.body),done);
        }
        socket.end();//no end call will test timeout feature of server
      });
    });
  });
});

var dumpResult = function(res,done){
  console.log(res);
  console.log('\t======REQUEST LOG======\n');
  done();
};

var done = function(){};