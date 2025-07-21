'use strict';

var Logger = require('dw/system/Logger');
var log = Logger.getLogger('int_acuotaz', 'payment');

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
  var viewData = viewFormData;

  log.debug('aCuotaz Payment - Form processor - Start processing form');
  log.debug('aCuotaz Payment - Form processor - Payment method: {0}', paymentForm.paymentMethod.value);

  viewData.paymentMethod = {
    value: paymentForm.paymentMethod.value,
    htmlName: paymentForm.paymentMethod.htmlName
  };

  log.debug('aCuotaz Payment - Form processor - Form processing completed successfully');
  return {
    error: false,
    viewData: viewData
  };
}

/**
 * Save the credit card information to login account if save card option is selected
 */
function savePaymentInformation() {
  log.debug('aCuotaz Payment - Form processor - No payment information to save');
}

exports.processForm = processForm;
exports.savePaymentInformation = savePaymentInformation;
