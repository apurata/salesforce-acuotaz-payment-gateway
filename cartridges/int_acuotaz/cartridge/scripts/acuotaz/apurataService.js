"use strict";

var Site   = require("dw/system/Site");
var Logger = require("dw/system/Logger").getLogger("int_acuotaz", "acuotaz");
var HTTPClient = require("dw/net/HTTPClient");

/**
 * @param {string} method  - HTTP method (GET, POST, etc.)
 * @param {string} path    - URL path starting with '/' (e.g. '/pos/client/landing_config')
 * @param {Object|null} payload - Body to send for POST/PUT (will be JSON.stringify)
 * @returns {{ok:boolean,statusCode:number,response_raw:string,response_json:Object|null,errorMessage:string|null}}
 */
function makeRequestApurata(method, path, payload) {
    var baseUrl     = "https://apurata.com";
    var bearerToken = Site.getCurrent().getCustomPreferenceValue('acuotazBearerToken');
    var url = baseUrl.replace(/\/$/, "") + (path && path.charAt(0) !== "/" ? "/" + path : path || "");
    var client = new HTTPClient();
    client.setTimeout(5000);

    try {
        client.open(method, url);
        client.setRequestHeader("Content-Type", "application/json");
        if (bearerToken) {
            client.setRequestHeader("Authorization", "Bearer " + bearerToken);
        }

        if (payload && (method === "POST" || method === "PUT" || method === "PATCH")) {
            client.send(JSON.stringify(payload));
        } else {
            client.send();
        }
    } catch (e) {
        Logger.error("HTTPClient error calling Apurata: {0}", e.message);
        return { ok: false, statusCode: 0, response_raw: "", response_json: null, errorMessage: e.message };
    }

    var raw = client.text;
    var json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        Logger.error("Error parsing JSON from Apurata: {0}", e.message);
        json = null;
    }

    var ok = client.statusCode >= 200 && client.statusCode < 300;

    if (!ok) {
        Logger.warn("Apurata responded with status {0}: {1}", client.statusCode, raw);
    }
    Logger.info('response_json: {0}', JSON.stringify(json));
    return {
        ok: ok,
        statusCode: client.statusCode,
        response_raw: raw,
        response_json: json,
        errorMessage: ok ? null : raw
    };
}

module.exports = {
    makeRequestApurata: makeRequestApurata
};
