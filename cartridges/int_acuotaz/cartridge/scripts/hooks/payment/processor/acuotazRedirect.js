'use strict';

var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger');
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

  log.debug(
    'aCuotaz Payment - Handle - Start processing payment for basket {0}',
    basket.UUID
  );

  try {
    Transaction.wrap(function () {
      log.debug(
        'aCuotaz Payment - Handle - Removing existing payment instruments'
      );
      paymentInstruments = currentBasket.getPaymentInstruments();
      iterator = paymentInstruments.iterator();
      while (iterator.hasNext()) {
        currentBasket.removePaymentInstrument(iterator.next());
      }

      log.debug(
        'aCuotaz Payment - Handle - Creating new payment instrument ACUOTAZ_PM'
      );
      currentBasket.createPaymentInstrument(
        'ACUOTAZ_PM',
        currentBasket.totalGrossPrice
      );
    });

    log.debug(
      'aCuotaz Payment - Handle - Payment instrument created successfully'
    );
    return { error: false };
  } catch (e) {
    log.error(
      'aCuotaz Payment - Handle - Error creating payment instrument: {0}',
      e.message
    );
    return {
      error: true,
      serverErrors: [Resource.msg('error.technical', 'checkout', null)]
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
  log.debug(
    'aCuotaz Payment - Authorize - Start authorization for order {0}',
    orderNumber
  );

  try {
    Transaction.wrap(function () {
      log.debug('aCuotaz Payment - Authorize - Setting transaction data');
      paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
      paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
    });

    log.debug([
      'aCuotaz Payment - Authorize - Authorization successful,',
      'redirecting to apurata.com'
    ].join(' '));

    return {
      error: false,
      redirectUrl: 'https://apurata.com'
    };
  } catch (e) {
    log.error(
      'aCuotaz Payment - Authorize - Error during authorization: {0}',
      e.message
    );
    return {
      error: true,
      serverErrors: [Resource.msg('error.technical', 'checkout', null)]
    };
  }
}

module.exports = {
  Handle: Handle,
  Authorize: Authorize
};
