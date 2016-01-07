var pomelo = require('pomelo');
var libConnector= require('./lib/connector.js');
var libZlibFilter = require('./lib/zlibfilter.js');
var pomeloLogger = require('pomelo-logger');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'pomelodemo');

app.configureLogger(pomeloLogger);

var afterStart = function(){};

// default close debug
app.set('DEBUG', false);
app.set('STATIC_ROUTE', true);

app.configure('development', function(){
  app.set('DEBUG', true);
});

// app configuration
app.configure('production|development',function(){
  app.enable('systemMonitor');
  app.filter(libZlibFilter());
});

// route gate configuration
app.configure('production|development', 'gate', function(){
  app.set('connectorConfig',
    {
      connector : libConnector,
      useDict: true,//must set to use pomelo dictionary component
      useStaticDict: app.get('STATIC_ROUTE') || false,//set use static route map dictionary
      defaultRouteId: 0,//must set for routeid of defaultRoute, default 0
      defaultRoute: 'gate.routeHandler.listRoute',//must set for query route list, default default.defaultHandler.defaultRoute
      defaultErrRoute: 'gate.routeHandler.errRoute',//must set for unknown route path, default default.defaultHandler.defaultError
      useMessageQueue: true, //all request will be in a queue not parallel
      aesKey: 'HuJb4NqADyiGcHTfzhQXv9HKrfDqJcXu',
      closeTimeout: 10*1000, //close after socket idle for 10 second, DO NOT set it under long connection, 5rpc+5self
      setNoDelay: true //by default TCP connections use the Nagle algorithm (~200ms), setNoDelay will turn it off
    });
});

// start app
app.start(afterStart);

// catch exceptions & no crash
process.on('uncaughtException', function (err) {
  console.log('[Exception]: ', err.stack)
});

// test logger
var logger = pomeloLogger.getLogger('website', __filename);
logger.debug('This\'s debug log');
logger.info('This\'s info log');
logger.warn('This\'s warn log');
logger.error('This\'s error log');
logger.trace('This\'s trace log');
logger.fatal('This\'s fatal log');