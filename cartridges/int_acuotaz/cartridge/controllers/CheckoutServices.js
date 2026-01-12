'use strict';

// 1. Requerimientos estándar para extender un controlador
var server = require('server');
var page = module.superModule;
var Logger = require('dw/system/Logger');

server.extend(page);

/**
 * Interceptamos PlaceOrder para manejar redirects de payment processors
 */
server.append('PlaceOrder', function (req, res, next) {
  var logger = Logger.getLogger('int_acuotaz', 'acuotaz');
  var OrderMgr = require('dw/order/OrderMgr');
  
  var viewData = res.getViewData();
  
  logger.info('aCuotaz Payment - PlaceOrder - DEBUG: Iniciando análisis');
  logger.info('aCuotaz Payment - PlaceOrder - DEBUG: viewData: {0}', JSON.stringify(viewData));
  
  // NUEVA ESTRATEGIA: Acceder directamente a la orden para verificar si es Acuotaz
  if (viewData && viewData.orderID && viewData.orderToken && !viewData.error) {
    logger.info('aCuotaz Payment - PlaceOrder - DEBUG: Orden exitosa, revisando payment instruments');
    
    try {
      // Obtener la orden directamente
      var order = OrderMgr.getOrder(viewData.orderID, viewData.orderToken);
      
      if (order) {
        logger.info('aCuotaz Payment - PlaceOrder - DEBUG: Orden obtenida exitosamente, order: {0}', JSON.stringify(order));
        
        var paymentInstruments = order.getPaymentInstruments();
        logger.info('aCuotaz Payment - PlaceOrder - DEBUG: Número de payment instruments: {0}', paymentInstruments.length);
        
        // Revisar cada payment instrument
        for (var i = 0; i < paymentInstruments.length; i++) {
          var paymentInstrument = paymentInstruments[i];
          logger.info('aCuotaz Payment - PlaceOrder - DEBUG: Payment instrument {0}: método = {1}', 
                     i, paymentInstrument.paymentMethod);
          
          // Si encontramos un payment instrument de Acuotaz, hacer redirect
          if (paymentInstrument.paymentMethod === 'ACUOTAZ_PM') {
            logger.info('aCuotaz Payment - PlaceOrder - DEBUG: ¡Acuotaz payment instrument encontrado!');
            
            // Obtiene la URL que Authorize dejó en la orden
            var redirect = order.custom.redirectURL || 'https://apurata.com';
            viewData.acuotazRedirectUrl = redirect;
            res.setViewData(viewData);
            logger.info('aCuotaz Payment - PlaceOrder - REDIRECT: Configurando redirect a {0}', redirect);
            break;
          }
        }
      } else {
        logger.info('aCuotaz Payment - PlaceOrder - DEBUG: No se pudo obtener la orden');
      }
    } catch (e) {
      logger.error('aCuotaz Payment - PlaceOrder - ERROR: {0}', e.message);
    }
  }
  
  // Continuar con el flujo normal
  return next();
});

// 6. Exportamos el controlador modificado.
module.exports = server.exports();
