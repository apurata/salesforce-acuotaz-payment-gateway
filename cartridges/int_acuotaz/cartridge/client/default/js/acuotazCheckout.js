'use strict';

/* Acuotaz Payment front-end integration
 * -------------------------------------
 * Redirige al usuario a la URL devuelta por Acuotaz después de un PlaceOrder
 * exitoso, siempre y cuando el método de pago seleccionado sea ACUOTAZ_PM.
 */
$(document).ready(function () {
    /* eslint-disable no-console */
    console.log('Acuotaz Payment - script inicializado');

    function isAcuotazSelected() {
        // 1) Resumen de pago ya renderizado (después de PlaceOrder)
        var fromSummary = $('.payment-information').data('payment-method-id');
        if (fromSummary) {
            return fromSummary === 'ACUOTAZ_PM';
        }

        // 2) Navegación de pestañas (markup como <li data-method-id="ACUOTAZ_PM" class="active">)
        var $activeTab = $('li[data-method-id].active');
        if ($activeTab.length) {
            return $activeTab.data('method-id') === 'ACUOTAZ_PM';
        }

        // 3) Radios tradicionales (antes de que se re-renderice la section)
        var fromRadio = $('input[name$="_paymentMethod"]:checked').val();
        return fromRadio === 'ACUOTAZ_PM';
    }

    // Overlay spinner para feedback visual
    function showRedirectOverlay() {
        if ($('#acuotaz-redirect-overlay').length) return;
        var html = [
            '<div id="acuotaz-redirect-overlay"',
            '     style="position:fixed;inset:0;z-index:10000;',
            '            background:rgba(255,255,255,.85);',
            '            display:flex;flex-direction:column;',
            '            align-items:center;justify-content:center;">',
            '  <div class="spinner-border" role="status"',
            '       style="width:3rem;height:3rem;"></div>',
            '  <p class="mt-3 h5">Redirigiendo al proveedor de pago…</p>',
            '</div>'
        ].join('');
        $('body').append(html);
    }


    // 1. Evento que podría lanzar algún cartridge (no presente en SFRA base)
    $('body').on('checkout:placeOrderSuccess', function (e, data) {
        console.log('PlaceOrder success event', data);
        if (isAcuotazSelected() && data && data.acuotazRedirectUrl) {
            showRedirectOverlay();
                    setTimeout(function () {
                        window.location.href = data.acuotazRedirectUrl;
                    }, 300);
        }
    });

    // 2. Fallback universal: escuchamos todas las respuestas AJAX al endpoint
    //    CheckoutServices-PlaceOrder y buscamos el campo acuotazRedirectUrl.
    $(document).ajaxSuccess(function (event, xhr, settings, responseData) {
        console.log(responseData, 'responseData');
        if (
            settings.url &&
            settings.url.indexOf('CheckoutServices-PlaceOrder') !== -1
        ) {
            try {
                var json = typeof responseData === 'string'
                    ? JSON.parse(responseData)
                    : responseData;

                if (json && json.acuotazRedirectUrl) {
                    console.log('[Acuotaz] Redireccionando a', json.acuotazRedirectUrl);
                    showRedirectOverlay();
                    setTimeout(function () {
                        window.location.href = json.acuotazRedirectUrl;
                    }, 300);
                }
            } catch (err) {
                console.error('Acuotaz - error parseando respuesta', err);
            }
        }
    });
});
