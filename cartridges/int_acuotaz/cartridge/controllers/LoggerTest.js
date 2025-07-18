'use strict';

var server = require('server');
var Logger = require('dw/system/Logger');

server.get('Start', function (req, res, next) {
  var logger = Logger.getLogger('int_acuotaz', 'acuotaz');
  logger.info('Probando logs directamente desde el controller');
  logger.error('Probando logs de error');
  logger.debug('Probando logs de debug');
  logger.warn('Probando logs de warning');
  res.json({ status: 'ok test asdas' });
  next();
});

module.exports = server.exports();
