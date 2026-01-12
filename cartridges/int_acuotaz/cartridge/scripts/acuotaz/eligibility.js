'use strict';

var apurataSvc   = require('*/cartridge/scripts/acuotaz/apurataService');
var Logger       = require('dw/system/Logger').getLogger('int_acuotaz', 'acuotaz');

var landingConfigCache = null;

/**
 * Retrieves landing config from Apurata API and caches the result during the request lifecycle.
 * @returns {Object|null}
 */
function getLandingConfig() {
    if (landingConfigCache) {
        return landingConfigCache;
    }
    var result = apurataSvc.makeRequestApurata('GET', '/pos/client/landing_config');
    if (!result || result.ok === false || !result.response_json) {
        Logger.warn('Falling back to default limits (no landing_config). Response status: {0}', result ? result.statusCode : 'n/a');
        landingConfigCache = { min_amount: 0, max_amount: 999999999 };
        return landingConfigCache;
    }
    landingConfigCache = result.response_json;
    return landingConfigCache;
}

/**
 * Determines if current basket qualifies for aCuotaz payment method.
 * Follows rules similar to WooCommerce plugin: HTTPS, currency PEN, and amount within min/max.
 * @param {dw.order.Basket} basket - The current basket
 * @returns {boolean} true if eligible, false otherwise
 */
function isEligible(basket) {
    if (!basket) {
        return false;
    }
    // Currency must be PEN, PENDING
    // if (basket.currencyCode !== 'PEN') {
    //     return false;
    // }
    var landingCfg = getLandingConfig();
    if (!landingCfg) {
        return false;
    }
    var total = 0;
    try {
        total = basket.totalGrossPrice ? basket.totalGrossPrice.value : 0;
    } catch (e) {
        total = 0;
    }

    if (total <= 0) {
        return false;
    }

    if (landingCfg.min_amount > total || landingCfg.max_amount < total) {
        return false;
    }
    return true;
}

module.exports = {
    isEligible: isEligible
};
