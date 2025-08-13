'use strict';

var server = require('server');
var OrderMgr = require('dw/order/OrderMgr');
var URLUtils = require('dw/web/URLUtils');
var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');

var eligibilityHelper = require('*/cartridge/scripts/acuotaz/eligibility');

var Logger = require('dw/system/Logger').getLogger('int_acuotaz', 'acuotaz');

server.extend(module.superModule);

server.get('ThankYou', server.middleware.https, function (req, res, next) {
  var orderID = req.querystring.orderID || req.querystring.order_id;
  if (!orderID) {
    Logger.warn('Checkout-ThankYou → orderID faltante');
    res.redirect(URLUtils.https('Home-Show'));
    return next();
  }
  var order = OrderMgr.getOrder(orderID);
  if (!order) {
    Logger.error('Checkout-ThankYou → orden {0} no encontrada', orderID);
    res.redirect(URLUtils.https('Home-Show'));
    return next();
  }
  res.render('checkout/thankYou.isml', {
    orderID: order.orderNo,
    orderToken: order.orderToken,
  });
  return next();
});

server.get('Failure', server.middleware.https, function (req, res, next) {
  var orderID = req.querystring.orderID || req.querystring.order_id;
  if (!orderID) {
    res.redirect(URLUtils.https('Checkout-Begin'));
    return next();
  }
  var order = OrderMgr.getOrder(orderID);
  if (order) {
    Transaction.wrap(function () {
      var newBasket = BasketMgr.getCurrentOrNewBasket();
      var plis = order.productLineItems.toArray();
      plis.forEach(function (pli) {
        newBasket.createProductLineItem(
          pli.productID,
          newBasket.defaultShipment
        ).setQuantityValue(pli.quantityValue);
      });
      newBasket.defaultShipment.shippingMethod = order.defaultShipment.shippingMethod;
      var pis = newBasket.getPaymentInstruments().toArray();
      pis.forEach(function (pi) {
        newBasket.removePaymentInstrument(pi);
      });
    });
  }
  res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment'));
  return next();
});

server.append('Begin', server.middleware.https, function (req, res, next) {
  var basket = BasketMgr.getCurrentBasket();
  var acuotazAllowed = eligibilityHelper.isEligible(basket);
  res.setViewData({ acuotazAllowed: acuotazAllowed });
  return next();
});

module.exports = server.exports();
