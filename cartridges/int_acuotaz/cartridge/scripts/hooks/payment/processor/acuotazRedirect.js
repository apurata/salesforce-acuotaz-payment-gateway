'use strict';

var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');

var log = Logger.getLogger('int_acuotaz', 'acuotaz');
/**
 * Handle the payment processing
 * @param {dw.order.Basket} basket - Current basket
 * @param {Object} paymentInformation - Payment information
 * @returns {Object} Object with error information
 */
function Handle(basket) {
  var currentBasket = basket;
  var paymentInstruments;
  var iterator;

  log.info('aCuotaz Payment - Handle - DEBUG: INICIANDO Handle para basket {0}', basket.UUID);

  try {
    Transaction.wrap(function () {
      log.debug('aCuotaz Payment - Handle - Removing existing payment instruments');
      paymentInstruments = currentBasket.getPaymentInstruments();
      iterator = paymentInstruments.iterator();
      while (iterator.hasNext()) {
        currentBasket.removePaymentInstrument(iterator.next());
      }

      log.debug('aCuotaz Payment - Handle - Creating new payment instrument ACUOTAZ_PM');
      currentBasket.createPaymentInstrument('ACUOTAZ_PM', currentBasket.totalGrossPrice);
    });

    log.info('aCuotaz Payment - Handle - DEBUG: Payment instrument created successfully');

    var result = { error: false };
    log.info('aCuotaz Payment - Handle - DEBUG: Retornando resultado: {0}', JSON.stringify(result));

    return result;
  } catch (e) {
    log.error('aCuotaz Payment - Handle - Error creating payment instrument: {0}', e.message);
    return {
      error: true,
      serverErrors: [Resource.msg('error.technical', 'checkout', null)],
    };
  }
}

/**
 * Authorize the payment
 * @param {string} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor - The payment processor
 * @returns {Object} Object with error information
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
  log.info('Acuotaz - Authorize iniciado para order {0}', orderNumber);

  var OrderMgr = require('dw/order/OrderMgr');
  var URLUtils = require('dw/web/URLUtils');
  var apurataSvc = require('*/cartridge/scripts/acuotaz/apurataService');

  var order = OrderMgr.getOrder(orderNumber);
  if (!order) {
    log.error('Acuotaz - no se encontró la orden {0}', orderNumber);
    return { error: true };
  } else {
    log.info('Acuotaz – order: {0}', JSON.stringify(order));
  }

  log.info('Acuotaz – order: {0}', JSON.stringify(order));
  var posClientId = Site.getCurrent().getCustomPreferenceValue('acuotazPosClientId');

  var payload = {
    amount: order.totalGrossPrice.value,
    order_id: order.orderNo,
    pos_client_id: posClientId,
    description: 'Order #' + order.orderNo,
    url_redir_on_canceled: URLUtils.https('Checkout-Failure', 'orderID', order.orderNo).toString(),
    url_redir_on_rejected: URLUtils.https('Checkout-Failure', 'orderID', order.orderNo).toString(),
    url_redir_on_success: URLUtils.https('Checkout-ThankYou', 'orderID', order.orderNo).toString(),
    customer_data: {
      address: order.billingAddress.address1,
      dni: order.customerNo || '',
      email: order.customerEmail,
      name: order.billingAddress.fullName,
      phone: order.billingAddress.phone,
      billing_city: order.billingAddress.city,
    },
  };

  var apiRes = apurataSvc.makeRequestApurata('POST', '/pos/order/create', payload);

  if (!(apiRes.ok && apiRes.response_json && apiRes.response_json.redirect_to)) {
    log.error('Acuotaz - Error creando orden vía API. Status: {0} Body: {1}', apiRes.statusCode, apiRes.response_raw);
    return { error: true };
  }

  var redirectURL = apiRes.response_json.redirect_to;
  log.info('Acuotaz - redirect URL obtenida: {0}', redirectURL);

  var Order = require('dw/order/Order');
  Transaction.wrap(function () {
    order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);

    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
    paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

    // Guarda la URL generada por aCuotaz (custom.redirectURL debe existir en Business Manager)
    order.custom.redirectURL = redirectURL;
  });

  log.info('Acuotaz - redirectURL guardada: {0}', redirectURL);

  return {
    authorized: true,
    acuotazRedirectUrl: redirectURL,
  };
}

module.exports = {
  Handle: Handle,
  Authorize: Authorize,
};
