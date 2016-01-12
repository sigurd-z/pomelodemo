var pomelo = require('pomelo');

// 自定义 socket (aes加密, zlib压缩)
var libConnector= require('./lib/connector.js');
var libZlibFilter = require('./lib/zlibfilter.js');
var libScheduler = require('./lib/pushscheduler.js');
var utils = require('./app/util/utils.js');

// 日志扩展
var pomeloLogger = require('pomelo-logger');

var accessLogFilter = require('./app/filter/accessLogFilter.js');
/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'pomelodemo');

// 用log4js.json 配置log
app.configureLogger(pomeloLogger);

var afterStart = function(){};

// default close debug
app.set('DEBUG', false);
app.set('STATIC_ROUTE', true);

// debug in development
app.configure('development', function(){
  app.set('DEBUG', true);
});

// app configuration
app.configure('production|development',function(){
  // 打开系统监控
  app.enable('systemMonitor');

  // socket 数据解压
  app.filter(libZlibFilter());
  app.filter(accessLogFilter({slowTime:1000}));//record access log and execute time

  // scheduler组件的具体调度策略配置, 有缓冲并且定时刷新的调度策略, 默认的是直接将响应发给客户端(仅仅被前端服务器加载)
  app.set('pushSchedulerConfig', {
    scheduler: libScheduler
  });
  //set route for multi server here
  app.route('account', function(session, msg, app, cb) {
    var routes = app.getServersByType(msg.serverType);
    cb(null, routes[0].id);
  });//shared by all group
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

// route account configuration
app.configure('production|development', 'account', function(){
});

// start app
app.start(afterStart);

var logger = pomeloLogger.getLogger('website', __filename);
// catch exceptions
process.on('uncaughtException', function (err) {
  logger.error('catch err: %s', err.stack);
});

// test logger
logger.debug('This\'s debug log');
logger.info('This\'s info log');
logger.warn('This\'s warn log');
logger.error('This\'s error log');
logger.trace('This\'s trace log');
logger.fatal('This\'s fatal log');