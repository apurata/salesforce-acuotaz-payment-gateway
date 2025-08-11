# Guía de Webhook de Apurata

## Endpoint

**URL:** `https://[tu-dominio]/on/demandware.store/Sites-[SiteID]-Site/es/LoggerTest-ApurataWebhook`  
**Método:** `POST`  
**Content-Type:** `application/json`  
**Timeout:** 45 segundos

## Estructura del Payload

### Webhook de Apurata
```json
{
  "orderId": "12345",
  "event": "funded",
  "status": "funded", 
  "clientId": "salesforce_client_123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "platform": "APURATA",
    "version": "1.0"
  },
  "extra": {
    // Datos adicionales opcionales
  }
}
```

## Estados y Eventos Soportados

### Estados Críticos (con acciones en SFCC)
| Evento | Descripción | Acción en SFCC |
|--------|-------------|----------------|
| `funded` | ✅ **CRÍTICO**: Dinero transferido | `PAYMENT_STATUS_PAID` + Fulfillment |
| `rejected` | ❌ Crédito rechazado | `OrderMgr.cancelOrder()` |
| `canceled` | ❌ Orden cancelada | `OrderMgr.cancelOrder()` |
| `expired` | ❌ Orden expirada | `OrderMgr.cancelOrder()` |

### Estados Informativos (solo tracking)
| Evento | Descripción | Acción en SFCC |
|--------|-------------|----------------|
| `validated` | Orden validada inicialmente | Solo nota + log |
| `approved` | Crédito aprobado, pendiente de pago | Solo nota + log |
| `on_hold` | En espera de validación adicional | Solo nota + log |

## Respuestas HTTP

### Éxito (200)
```json
{
  "error": false,
  "message": "Webhook de Apurata procesado exitosamente",
  "orderId": "12345",
  "orderNo": "00000605", 
  "event": "funded",
  "status": "funded",
  "action": "funded",
  "processingTimeMs": 150,
  "timestamp": "2024-01-15T10:30:00.500Z"
}
```

### Error 400 - Datos Inválidos
```json
{
  "error": true,
  "message": "Datos inválidos",
  "details": ["orderId es requerido", "event es requerido"]
}
```

### Error 404 - Orden No Encontrada
```json
{
  "error": true,
  "message": "Orden no encontrada",
  "orderId": "12345"
}
```

### Error 500 - Error Interno
```json
{
  "error": true,
  "message": "Error interno del servidor"
}
```

## Logging

Todos los eventos se registran en el logger `int_acuotaz` con categoría `acuotaz`. Los logs incluyen:

- Recepción de webhooks
- Validación de payload
- Procesamiento de órdenes
- Errores y advertencias
- Tiempo de procesamiento

## Notas en Órdenes

El sistema automáticamente agrega notas a las órdenes con:
- Detalles del evento procesado
- Payload completo del webhook (para auditoría)
- Metadatos de Apurata

## Campos Utilizados

### Campos Nativos de SFCC (principales)
- `order.paymentStatus` - Estado de pago (`PAYMENT_STATUS_PAID`, etc.)
- `order.status` - Estado de la orden (`ORDER_STATUS_CANCELLED`, etc.)
- `order.notes` - Notas de auditoría con detalles de eventos

### Campo Personalizado (mínimo)
- `order.custom.apurataLastEvent` - Último evento procesado (para referencia)

## Ejemplo de Fulfillment (evento "funded")

Cuando se recibe el evento `funded`:

1. ✅ Orden marcada como `PAYMENT_STATUS_PAID`
2. ✅ Si la orden está en estado `CREATED`, se procesa con `placeOrder()`
3. ✅ Se envía email de confirmación
4. ✅ Orden lista para fulfillment

## Consideraciones Técnicas

- **Uso de campos nativos**: Principalmente utiliza estados estándar de SFCC
- **Mínimos campos custom**: Solo `apurataLastEvent` para referencia
- **Estados críticos**: Solo `funded` realiza acciones (pago), otros 3 cancelan
- **Estados informativos**: `validated`, `approved`, `on_hold` solo agregan notas
- **Transacciones**: Todos los cambios dentro de transacciones SFCC
- **Logging**: Comprensivo para auditoría y debugging
- **Performance**: Tiempo de procesamiento monitoreado

## Testing

### Webhook de Apurata
```bash
curl -X POST "https://tu-dominio/on/demandware.store/Sites-SiteID-Site/es/LoggerTest-ApurataWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "00000605",
    "event": "funded",
    "status": "funded",
    "clientId": "salesforce_client_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "platform": "APURATA", 
      "version": "1.0"
    }
  }'
```

### Ejemplos de Diferentes Eventos
```bash
# Evento: validated
curl -X POST "https://tu-dominio/on/demandware.store/Sites-SiteID-Site/es/LoggerTest-ApurataWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "00000605",
    "event": "validated",
    "status": "validated",
    "clientId": "salesforce_client_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {"platform": "APURATA", "version": "1.0"}
  }'

# Evento: rejected
curl -X POST "https://tu-dominio/on/demandware.store/Sites-SiteID-Site/es/LoggerTest-ApurataWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "00000605",
    "event": "rejected",
    "status": "rejected",
    "clientId": "salesforce_client_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {"platform": "APURATA", "version": "1.0"}
  }'
```
