'use strict';

/*
 * Controller puente para flujos de pago aCuotaz.
 * Recibe al shopper tras la redirección del PSP y lo reenvía por POST a
 * Order-Confirm.  Solo necesita `orderID` (obtiene el orderToken desde la
 * propia orden), de modo que el PSP puede redirigir con un único parámetro.
 */

var server       = require('server');
server.extend(module.superModule);  // conserva rutas estándar

var OrderMgr     = require('dw/order/OrderMgr');
var URLUtils     = require('dw/web/URLUtils');
var Logger       = require('dw/system/Logger').getLogger('int_acuotaz', 'acuotaz');

/* GET /Checkout-ThankYou?orderID=00000605 */
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
        orderID   : order.orderNo,
        orderToken: order.orderToken
    });
    return next();
});

/* GET /Checkout-Failure?orderID=00000605 */
server.get('Failure', server.middleware.https, function (req, res, next) {
    var OrderMgr    = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    var orderID = req.querystring.orderID || req.querystring.order_id;
    if (!orderID) {
        res.redirect(URLUtils.https('Checkout-Begin'));
        return next();
    }

    var order = OrderMgr.getOrder(orderID);
    var BasketMgr  = require('dw/order/BasketMgr');
    var ProductFactory = require('*/cartridge/scripts/factories/product');

    if (order) {
        var Order = require('dw/order/Order');
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true); // FAILED + restock
            order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        });

        // Recrear cesta con los mismos productos (sin helper externo)
        var newBasket;
        Transaction.wrap(function () {
            newBasket = BasketMgr.getCurrentOrNewBasket();
            var pliIter = order.getProductLineItems().iterator();
            while (pliIter.hasNext()) {
                var pli = pliIter.next();
                var newPLI = newBasket.createProductLineItem(pli.product, newBasket.defaultShipment);
                newPLI.setQuantityValue(pli.quantity.value);
            }
        });

    }

    res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment', 'acuotazfail', '1'));
    return next();
});

module.exports = server.exports();
