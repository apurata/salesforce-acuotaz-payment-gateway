'use strict';

var Logger = require('dw/system/Logger');
var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');

// Initialize logger for Acuotaz payment processor
var acuotazLogger = Logger.getLogger('int_acuotaz', 'acuotaz');

/**
 * Verifies the required amount and currency for processing
 * @param {dw.order.Order} order - The order object
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument
 * @returns {Object} Verification result
 */
function verifyPaymentData(order, paymentInstrument) {
  var result = {
    success: true,
    errorMessage: '',
  };
  var amount;
  var currency;

  acuotazLogger.info('Starting payment data verification for order: ' + order.orderNo);

  try {
    if (!order) {
      result.success = false;
      result.errorMessage = 'Order object is null or undefined';
      acuotazLogger.error('Payment verification failed: ' + result.errorMessage);
      return result;
    }

    if (!paymentInstrument) {
      result.success = false;
      result.errorMessage = 'Payment instrument is null or undefined';
      acuotazLogger.error('Payment verification failed: ' + result.errorMessage);
      return result;
    }

    amount = paymentInstrument.paymentTransaction.amount;
    currency = order.currencyCode;

    acuotazLogger.info('Payment data verification - Amount: ' + amount + ', Currency: ' + currency);

    if (amount <= 0) {
      result.success = false;
      result.errorMessage = 'Invalid payment amount: ' + amount;
      acuotazLogger.error('Payment verification failed: ' + result.errorMessage);
      return result;
    }

    // Log successful verification
    acuotazLogger.info('Payment data verification successful for order: ' + order.orderNo + ', Amount: ' + amount + ', Currency: ' + currency);
  } catch (error) {
    result.success = false;
    result.errorMessage = 'Error during payment verification: ' + error.message;
    acuotazLogger.error('Payment verification exception: ' + error.message + ', Stack: ' + error.stack);
  }

  return result;
}

/**
 * Handles the payment authorization process
 * @param {dw.order.Order} order - The order object
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument
 * @returns {Object} Authorization result
 */
function Handle(order, paymentInstrument) {
  var result = {
    success: false,
    error: false,
  };
  var verification;
  var amount;
  var currency;
  var orderNo;
  var paymentMethod;
  var paymentProcessor;

  acuotazLogger.info('=== Starting Acuotaz Payment Handle Process ===');
  acuotazLogger.info('Processing payment for order: ' + order.orderNo);

  try {
    // Verify payment data
    verification = verifyPaymentData(order, paymentInstrument);
    if (!verification.success) {
      acuotazLogger.error('Handle process failed during verification: ' + verification.errorMessage);
      result.error = true;
      return result;
    }

    // Get payment details
    amount = paymentInstrument.paymentTransaction.amount;
    currency = order.currencyCode;
    orderNo = order.orderNo;

    acuotazLogger.info('Handle process - Order Number: ' + orderNo + ', Amount: ' + amount + ', Currency: ' + currency);

    // Validate payment method configuration
    paymentMethod = PaymentMgr.getPaymentMethod('ACUOTAZ_PM');
    if (!paymentMethod) {
      acuotazLogger.error('Payment method ACUOTAZ_PM not found or not configured in Business Manager');
      result.error = true;
      result.errorMessage = 'Payment method ACUOTAZ_PM not configured';
      return result;
    }

    paymentProcessor = paymentMethod.getPaymentProcessor();
    if (!paymentProcessor) {
      acuotazLogger.error('Payment processor for ACUOTAZ_PM not found or not configured in Business Manager');
      result.error = true;
      result.errorMessage = 'Payment processor for ACUOTAZ_PM not configured';
      return result;
    }

    acuotazLogger.info('Payment method and processor validated successfully');

    Transaction.wrap(function () {
      // Set payment transaction as pending
      paymentInstrument.paymentTransaction.transactionID = orderNo + '_' + Date.now();
      paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;

      acuotazLogger.info('Payment transaction ID set: ' + paymentInstrument.paymentTransaction.transactionID);
    });

    result.success = true;
    acuotazLogger.info('Handle process completed successfully for order: ' + orderNo);
  } catch (error) {
    acuotazLogger.error('Handle process exception: ' + error.message + ', Stack: ' + error.stack);
    result.error = true;
    result.success = false;
  }

  acuotazLogger.info('=== Acuotaz Payment Handle Process Completed ===');
  return result;
}

/**
 * Authorizes the payment and redirects to Acuotaz
 * @param {string} orderNo - Order number
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument
 * @param {dw.order.PaymentProcessor} paymentProcessor - The payment processor
 * @returns {Object} Authorization result
 */
function Authorize(orderNo, paymentInstrument, paymentProcessor) {
  var result = {
    authorized: false,
    error: false,
    redirectUrl: '',
  };
  var amount;
  var transactionId;
  var baseUrl;
  var redirectUrl;

  acuotazLogger.info('=== Starting Acuotaz Payment Authorization ===');
  acuotazLogger.info('Authorizing payment for order: ' + orderNo);

  try {
    amount = paymentInstrument.paymentTransaction.amount;
    transactionId = paymentInstrument.paymentTransaction.transactionID;

    acuotazLogger.info('Authorization details - Order: ' + orderNo + ', Amount: ' + amount + ', Transaction ID: ' + transactionId);

    // Build redirect URL with parameters
    baseUrl = 'https://apurata.com/pos/crear-orden-y-continuar';
    redirectUrl = baseUrl + '?order_id=' + encodeURIComponent(orderNo) + '&amount=' + encodeURIComponent(amount.toFixed(2));

    acuotazLogger.info('Generated redirect URL: ' + redirectUrl);

    Transaction.wrap(function () {
      // Set payment transaction status
      paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

      // Mark as authorized for redirect
      result.authorized = true;
      result.redirectUrl = redirectUrl;

      acuotazLogger.info('Payment marked as authorized for redirect');
    });

    acuotazLogger.info('Authorization completed successfully. Redirect URL: ' + redirectUrl);
  } catch (error) {
    acuotazLogger.error('Authorization exception: ' + error.message + ', Stack: ' + error.stack);
    result.error = true;
    result.authorized = false;
  }

  acuotazLogger.info('=== Acuotaz Payment Authorization Completed ===');
  return result;
}

exports.Handle = Handle;
exports.Authorize = Authorize;
