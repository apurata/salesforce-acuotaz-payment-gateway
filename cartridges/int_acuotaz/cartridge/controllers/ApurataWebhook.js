'use strict';

var server      = require('server');
var Logger      = require('dw/system/Logger');
var OrderMgr    = require('dw/order/OrderMgr');
var Order       = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var COHelpers   = require('*/cartridge/scripts/checkout/checkoutHelpers');

/**
 * Handles the Apurata event and updates the order accordingly.
 * @param {dw.order.Order} order   - Salesforce Order
 * @param {Object}         payload - Webhook data (orderId, event, status, ...)
 * @param {string}         localeID- Locale ID for emails
 * @returns {{success: boolean, message: string, action: string}}
 */
function handleApurataEvent(order, payload, localeID) {
    var log = Logger.getLogger('int_acuotaz', 'acuotaz');
    var result = { success: false, message: '', action: payload.event };

    try {
        Transaction.wrap(function () {
            switch (payload.event.toLowerCase()) {
                case 'funded':
                    log.info('Apurata Webhook - FUNDED: Procesando pago confirmado para orden {0}', order.orderNo);
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);

                    if (order.status.value === Order.ORDER_STATUS_CREATED) {
                        var placeOrderResult = COHelpers.placeOrder(order, { status: true });
                        if (!placeOrderResult.error) {
                            COHelpers.sendConfirmationEmail(order, localeID);
                        } else {
                            log.warn('Apurata Webhook - Error en placeOrder para orden {0}: {1}', order.orderNo, JSON.stringify(placeOrderResult));
                        }
                    }
                    order.addNote('Apurata Webhook', 'PAGO CONFIRMADO - listo para fulfillment');
                    result.message = 'Pago confirmado';
                    break;

                case 'rejected':
                case 'canceled':
                case 'expired':
                    log.info('Apurata Webhook - {0}: Cancelando orden {1}', payload.event.toUpperCase(), order.orderNo);
                    OrderMgr.cancelOrder(order);
                    order.addNote('Apurata Webhook', 'Orden cancelada: ' + payload.event);
                    result.message = 'Orden cancelada: ' + payload.event;
                    break;

                case 'created':
                case 'validated':
                case 'approved':
                case 'onhold':
                    order.addNote('Apurata Webhook', 'Estado actualizado: ' + payload.event);
                    result.message = 'Estado actualizado: ' + payload.event;
                    break;

                default:
                    log.error('Apurata Webhook - Evento no reconocido: {0} para orden {1}', payload.event, order.orderNo);
                    result.message = 'Evento no reconocido: ' + payload.event;
                    return;
            }

            result.success = true;
        });
    } catch (e) {
        log.error('Apurata Webhook - Error procesando orden {0}: {1}', order.orderNo, e.message);
        result.message = 'Error interno procesando orden: ' + e.message;
    }

    return result;
}

/**
 * POST /ApurataWebhook-Process
 * Endpoint para recibir notificaciones de Apurata.
 * Content-Type: application/json
 */
server.post('Process', server.middleware.https, function (req, res, next) {
    var log = Logger.getLogger('int_acuotaz', 'acuotaz');
    var startTime = Date.now();

    var bodyStr = req.httpParameterMap.getRequestBodyAsString();
    if (!bodyStr) {
        res.setStatusCode(400);
        res.json({ error: true, message: 'Body JSON requerido' });
        return next();
    }

    var payload;
    try {
        payload = JSON.parse(bodyStr);
    } catch (e) {
        res.setStatusCode(400);
        res.json({ error: true, message: 'Formato JSON inválido' });
        return next();
    }

    if (!payload.orderId || !payload.event) {
        res.setStatusCode(400);
        res.json({ error: true, message: 'orderId y event son requeridos' });
        return next();
    }

    var order = OrderMgr.getOrder(payload.orderId);
    if (!order) {
        res.setStatusCode(404);
        res.json({ error: true, message: 'Orden no encontrada', orderId: payload.orderId });
        return next();
    }

    var localeID = req.locale ? req.locale.id : 'en_US';
    var result = handleApurataEvent(order, payload, localeID);
    if (!result.success) {
        res.setStatusCode(500);
        res.json({ error: true, message: result.message, orderId: payload.orderId });
        return next();
    }

    Transaction.wrap(function () {
        order.addNote('Apurata Webhook - Payload', JSON.stringify(payload));
    });

    res.setStatusCode(200);
    res.json({
        error: false,
        message: 'Webhook procesado',
        orderId: payload.orderId,
        event  : payload.event,
        action : result.action,
    });
    return next();
});

module.exports = server.exports();
