'use strict';

// 1. Requerimientos estándar para extender un controlador
var server = require('server');
var page = module.superModule;
var Logger = require('dw/system/Logger');

server.extend(page);

// 2. Importamos el Logger, la herramienta de depuración de Salesforce

/**
 * Usamos server.prepend() para que nuestro código se ejecute ANTES del código original.
 * Es ideal para inspeccionar la petición antes de que cause un error.
 */
server.prepend('SubmitPayment', function (req, res, next) {
  // 3. Creamos un logger personalizado para encontrar fácilmente nuestros mensajes.
  // El primer parámetro es el nombre del archivo de log (custom-PaymentDebug-...).
  // El segundo es la categoría dentro del log.
  var logger = Logger.getLogger('int_acuotaz', 'acuotaz');

  // 4. ¡La línea clave! Registramos todo el contenido del formulario.
  // El objeto 'req.form' contiene todos los datos enviados desde el navegador.
  // Usamos JSON.stringify para convertir el objeto en un texto legible.
  // Usamos .warn() para que el mensaje se destaque en los logs.
  logger.info('Payload recibido en CheckoutServices-SubmitPayment: {0}', JSON.stringify(req.form));

  // 5. ¡MUY IMPORTANTE! Llamamos a next() para continuar con el flujo normal.
  // Si no incluyes esta línea, el proceso de checkout se detendrá aquí mismo.
  return next();
});

// 6. Exportamos el controlador modificado.
module.exports = server.exports();
