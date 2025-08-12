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
  var HTTPClient = require('dw/net/HTTPClient');

  // --- 1. Recupera la orden ---
  var order = OrderMgr.getOrder(orderNumber);
  if (!order) {
    log.error('Acuotaz - no se encontró la orden {0}', orderNumber);
    return { error: true };
  } else {
    log.info('Acuotaz – order: {0}', JSON.stringify(order));
  }

  log.info('Acuotaz – order: {0}', JSON.stringify(order));
  var bearerToken = Site.getCurrent().getCustomPreferenceValue('acuotazBearerToken');
  var posClientId = Site.getCurrent().getCustomPreferenceValue('acuotazPosClientId');

  // --- 2. Construye el payload para la API de Apurata ---
  var payload = {
    amount: order.totalGrossPrice.value,
    order_id: order.orderNo,
    pos_client_id: posClientId,
    description: 'Order #' + order.orderNo,
    url_redir_on_canceled: URLUtils.https('Checkout-Failure', 'orderID', order.orderNo).toString(),
    url_redir_on_rejected: URLUtils.https('Checkout-Failure', 'orderID', order.orderNo).toString(),
    url_redir_on_success: URLUtils.https('Checkout-ThankYou', 'orderID', order.orderNo).toString(),
    url_redir_on_order_detail: URLUtils.https('Checkout-ThankYou', 'orderID', order.orderNo).toString(),
    url_redir_on_downpayment: URLUtils.https('Checkout-ThankYou', 'orderID', order.orderNo).toString(),
    customer_data: {
      address: order.billingAddress.address1,
      dni: order.customerNo || '',
      email: order.customerEmail,
      name: order.billingAddress.fullName,
      phone: order.billingAddress.phone,
      billing_city: order.billingAddress.city,
    },
  };

  // --- 3. Llama a Apurata ---
  var client = new HTTPClient();
  client.setTimeout(10000);
  log.info('Acuotaz - bearerToken: {0}', bearerToken);
  client.open('POST', 'https://apurata.com/pos/order/create');
  client.setRequestHeader('Content-Type', 'application/json');
  if (bearerToken) {
    client.setRequestHeader('Authorization', 'Bearer ' + bearerToken);
  } else {
    log.warn('aCuotaz Payment - Handle - Bearer token no configurado en preferencias.');
  }
  client.send(JSON.stringify(payload));

  if (client.statusCode !== 200) {
    log.error('Acuotaz - error HTTP {0}: {1}', client.statusCode, client.text);
    return { error: true };
  }

  var redirectURL;
  try {
    var responseObj = JSON.parse(client.text);
    log.info('Acuotaz - responseObj: {0}', JSON.stringify(responseObj.redirect_to));
    redirectURL = responseObj.redirect_to;
  } catch (e) {
    log.error('Acuotaz - no se pudo parsear la respuesta: {0}', e.message);
    return { error: true };
  }

  if (!redirectURL) {
    log.error('Acuotaz - la respuesta no contiene redirect_url');
    return { error: true };
  }

  // --- 4. Marca la orden como NO PAGADA y asigna la transacción ---
  var Order = require('dw/order/Order');
  Transaction.wrap(function () {
    order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);

    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
    paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

    // Guarda la URL generada por aCuotaz (custom.redirectURL debe existir o elimínalo)
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
