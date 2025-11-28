
/////////////////////////////////////////////////////////////////////
// This module handle cross origin verifications protocol
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
/////////////////////////////////////////////////////////////////////
import {log} from "./log.js";

//Inject in response header the necessary keys to allow anonymous access
function allowAllAnonymousAccess(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
}

// This function select access control
function accessControlConfig(httpContext) {
    allowAllAnonymousAccess(httpContext.res);
}

export function handleCORSPreflight(httpContext) {
    accessControlConfig(httpContext);
    return new Promise(resolve => {
        // Check if client request is a CORS request
        if (httpContext.req.method === 'OPTIONS') {
            console.log('[CORS preflight verifications]');
            // Send the response
            httpContext.res.end();
            // The request has been handled
            resolve(true);
        }
         // The request was not handled
        resolve(false);
    });
}