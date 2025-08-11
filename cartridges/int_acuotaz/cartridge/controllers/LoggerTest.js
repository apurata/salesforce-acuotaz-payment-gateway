'use strict';

var server      = require('server');
var Logger      = require('dw/system/Logger');
var OrderMgr    = require('dw/order/OrderMgr');
var Order       = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var Resource    = require('dw/web/Resource');
var COHelpers   = require('*/cartridge/scripts/checkout/checkoutHelpers');



/**
 * Valida el payload del webhook de Apurata
 * @param {Object} payload - Datos del webhook
 * @returns {Object} - {valid: boolean, errors: Array}
 */
function validateApurataPayload(payload) {
    var errors = [];
    
    if (!payload) {
        errors.push('Payload vacío');
        return { valid: false, errors: errors };
    }
    
    // Validaciones requeridas
    if (!payload.orderId) {
        errors.push('orderId es requerido');
    }
    
    if (!payload.event) {
        errors.push('event es requerido');
    }
    
    if (!payload.status) {
        errors.push('status es requerido');
    }
    
    if (!payload.clientId) {
        errors.push('clientId es requerido');
    }
    
    if (!payload.timestamp) {
        errors.push('timestamp es requerido');
    }
    
    // Validar eventos permitidos
    var validEvents = ['funded', 'approved', 'rejected', 'canceled', 'on_hold', 'validated', 'expired'];
    if (payload.event && validEvents.indexOf(payload.event) === -1) {
        errors.push('Evento no válido: ' + payload.event);
    }
    
    // Validar estados permitidos
    var validStatuses = ['funded', 'approved', 'rejected', 'canceled', 'on_hold', 'validated', 'expired'];
    if (payload.status && validStatuses.indexOf(payload.status) === -1) {
        errors.push('Estado no válido: ' + payload.status);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Procesa la orden según el evento específico de Apurata
 * @param {dw.order.Order} order - Orden de Salesforce
 * @param {Object} payload - Datos del webhook de Apurata
 * @param {string} localeID - ID del locale
 * @returns {Object} - Resultado del procesamiento
 */
function processOrderByEvent(order, payload, localeID) {
    var log = Logger.getLogger('int_acuotaz', 'acuotaz');
    var result = { success: false, message: '', action: payload.event };
    
    try {
        Transaction.wrap(function () {
            switch (payload.event.toLowerCase()) {
                case 'funded':
                    // ✅ CRÍTICO: Dinero transferido - Orden confirmada y pagada
                    log.info('Apurata Webhook - FUNDED: Procesando pago confirmado para orden {0}', order.orderNo);
                    
                    // Marcar orden como pagada usando estado nativo de SFCC
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    
                    // Si la orden está en estado CREATED, procesarla completamente
                    if (order.status.value === Order.ORDER_STATUS_CREATED) {
                        var placeOrderResult = COHelpers.placeOrder(order, { status: true });
                        if (!placeOrderResult.error) {
                            COHelpers.sendConfirmationEmail(order, localeID);
                            log.info('Apurata Webhook - Email de confirmación enviado para orden {0}', order.orderNo);
                        } else {
                            log.warn('Apurata Webhook - Error al procesar placeOrder para orden {0}: {1}', order.orderNo, JSON.stringify(placeOrderResult));
                        }
                    }
                    
                    order.addNote('Apurata Webhook', 'PAGO CONFIRMADO - Dinero transferido. Orden lista para fulfillment.');
                    result.message = 'Pago confirmado - Orden procesada para fulfillment';
                    break;
                    
                case 'rejected':
                case 'canceled':
                case 'expired':
                    // ❌ Estados de cancelación - usar función nativa de SFCC
                    log.info('Apurata Webhook - {0}: Cancelando orden {1}', payload.event.toUpperCase(), order.orderNo);
                    OrderMgr.cancelOrder(order);
                    order.addNote('Apurata Webhook', 'Orden cancelada: ' + payload.event);
                    result.message = 'Orden cancelada por: ' + payload.event;
                    break;
                    
                case 'validated':
                case 'approved': 
                case 'on_hold':
                    // Estados informativos - solo registrar progreso
                    order.addNote('Apurata Webhook', 'Estado actualizado: ' + payload.event);
                    result.message = 'Estado actualizado: ' + payload.event;
                    break;
                    
                default:
                    log.error('Apurata Webhook - Evento no reconocido: {0} para orden {1}', payload.event, order.orderNo);
                    result.message = 'Evento no reconocido: ' + payload.event;
                    return;
            }
            
            // Solo guardar el último evento para referencia (mínimo necesario)
            order.custom.apurataLastEvent = payload.event;
            
            result.success = true;
        });
        
        log.info('Apurata Webhook - Orden {0} procesada exitosamente para evento: {1}', order.orderNo, payload.event);
        
    } catch (error) {
        log.error('Apurata Webhook - Error procesando orden {0} para evento {1}: {2}', order.orderNo, payload.event, error.message);
        result.message = 'Error interno procesando orden: ' + error.message;
    }
    
    return result;
}

// Endpoint simple para probar logs
server.get('Start', function (req, res, next) {
    var log = Logger.getLogger('int_acuotaz', 'acuotaz');
    log.info('Probando logs desde LoggerTest-Start');
    res.json({ status: 'ok' });
    next();
});



/**
 * POST /LoggerTest-ApurataWebhook
 * Endpoint para recibir notificaciones de eventos de pago desde Apurata
 * 
 * Content-Type: application/json
 * Timeout: 45 segundos
 * 
 * Payload esperado de Apurata:
 * {
 *   "orderId": "12345",
 *   "event": "funded|approved|rejected|canceled|on_hold|validated|expired",
 *   "status": "funded|approved|rejected|canceled|on_hold|validated|expired",
 *   "clientId": "salesforce_client_123",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "metadata": { "platform": "APURATA", "version": "1.0" },
 *   "extra": {}
 * }
 */
server.post('ApurataWebhook', server.middleware.https, function (req, res, next) {
    var log = Logger.getLogger('int_acuotaz', 'acuotaz');
    var startTime = new Date();
    
    log.info('Apurata Webhook - Iniciando procesamiento');

    try {
        // 1. Parsear body JSON
        var bodyStr = req.httpParameterMap.getRequestBodyAsString();
        if (!bodyStr) {
            log.warn('Apurata Webhook - Body JSON faltante');
            res.setStatus(400);
            res.json({ 
                error: true, 
                code: 'MISSING_BODY',
                message: 'Body JSON requerido' 
            });
            return next();
        }

        var payload;
        try {
            payload = JSON.parse(bodyStr);
        } catch (parseError) {
            log.error('Apurata Webhook - JSON parse error: {0}', parseError.message);
            res.setStatus(400);
            res.json({ 
                error: true, 
                code: 'INVALID_JSON',
                message: 'Formato JSON inválido' 
            });
            return next();
        }

        // 2. Validar payload de Apurata
        var validation = validateApurataPayload(payload);
        if (!validation.valid) {
            log.warn('Apurata Webhook - Payload inválido: {0}', validation.errors.join(', '));
            res.setStatus(400);
            res.json({ 
                error: true, 
                code: 'INVALID_PAYLOAD',
                message: 'Datos inválidos', 
                details: validation.errors 
            });
            return next();
        }

        // 3. Log del evento recibido
        log.info('Apurata Webhook - Evento recibido: {0} para orden {1}', payload.event, payload.orderId);
        log.debug('Apurata Webhook - Payload completo: {0}', JSON.stringify(payload, null, 2));

        // 4. Buscar la orden en Salesforce
        var order = OrderMgr.getOrder(payload.orderId);
        if (!order) {
            log.warn('Apurata Webhook - Orden no encontrada: {0}', payload.orderId);
            res.setStatus(404);
            res.json({ 
                error: true, 
                code: 'ORDER_NOT_FOUND',
                message: 'Orden no encontrada',
                orderId: payload.orderId
            });
            return next();
        }

        // 5. Procesar la orden según el evento
        var localeID = req.locale ? req.locale.id : 'en_US';
        var processResult = processOrderByEvent(order, payload, localeID);
        
        if (!processResult.success) {
            log.error('Apurata Webhook - Error procesando orden {0}: {1}', payload.orderId, processResult.message);
            res.setStatus(500);
            res.json({ 
                error: true, 
                code: 'PROCESSING_ERROR',
                message: processResult.message,
                orderId: payload.orderId
            });
            return next();
        }
        
        // 6. Guardar el webhook completo como nota en la orden
        Transaction.wrap(function () {
            order.addNote('Apurata Webhook - Payload', JSON.stringify(payload, null, 2));
        });
        
        // 7. Respuesta exitosa
        var processingTime = new Date() - startTime;
        log.info('Apurata Webhook - Procesamiento exitoso para orden {0} en {1}ms', 
                 order.orderNo, processingTime);
        
        res.setStatus(200);
        res.json({
            error: false,
            message: 'Webhook de Apurata procesado exitosamente',
            orderId: payload.orderId,
            orderNo: order.orderNo,
            event: payload.event,
            status: payload.status,
            action: processResult.action,
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        // Manejo de errores inesperados
        log.error('Apurata Webhook - Error inesperado: {0}', error.message);
        res.setStatus(500);
        res.json({ 
            error: true, 
            code: 'INTERNAL_ERROR',
            message: 'Error interno del servidor' 
        });
    }

    return next();
});

module.exports = server.exports();