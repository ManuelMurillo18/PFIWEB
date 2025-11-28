//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// This module define the http Response wrapper class
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
import * as serverVariables from "./serverVariables.js";
import CachedRequests from "./cachedRequestsManager.js";
let hideHeadRequest = serverVariables.get("main.hideHeadRequest");

export default class Response {
    constructor(HttpContext) {
        if (HttpContext == null) {
            throw new Error("Cannot instantiate class Response without a valid HttpContext.");
        }
        this.HttpContext = HttpContext;
        this.res = HttpContext.res;
        this.errorContent = "";
    }
    hiddenRequest() {
        return (hideHeadRequest && this.HttpContext.req.method === 'HEAD');
    }
    status(number, errorMessage = '') {
        if (errorMessage) {
            this.res.writeHead(number, { 'content-type': 'application/json' });
            this.errorContent = { "error_description": errorMessage };
            return this.end(JSON.stringify(this.errorContent));
        } else {
            this.res.writeHead(number, { 'content-type': 'text/plain' });
            return this.end();
        }
    }
    end(content) {
        if (content)
            this.res.end(content);
        else
            this.res.end();
        if (!this.hiddenRequest()) {
            if (this.res.statusCode >= 200 && this.res.statusCode < 300)
                console.log(Reset + BgGreen + FgWhite, "Response status:", this.res.statusCode, this.errorContent);
            else
                console.log(Reset + BgRed + FgWhite, "Response status:", this.res.statusCode, this.errorContent);
        }
        return true;
    }

    /////////////////////////////////////////////// 200 ///////////////////////////////////////////////////////

    ok() { return this.status(200); }       // ok status
    ETag(ETag) {
        this.res.writeHead(204, { 'ETag': ETag });
        this.end();
    }

    addInRequestsCache(jsonObj, ETag, requiredAuthorizations) {
        if (this.HttpContext.isCacheable)
            CachedRequests.add(this.HttpContext.req.url, jsonObj, ETag, requiredAuthorizations);
    }
    JSON(obj, ETag = "", fromCache = false, requiredAuthorizations = null) {   // ok status with content
        if (ETag !== "")
            this.res.writeHead(200, { 'content-type': 'application/json', 'ETag': ETag });
        else
            this.res.writeHead(200, { 'content-type': 'application/json' });

        if (obj != null) {
            if (!fromCache)
                this.addInRequestsCache(obj, ETag, requiredAuthorizations)
            let content = JSON.stringify(obj);
            console.log(FgCyan + Bright, "Response payload -->", content.toString().substring(0, 75) + "...");
            return this.end(content);
        } else
            return this.end();
    }
    
    HTML(content) {
        this.res.writeHead(200, { 'content-type': 'text/html' });
        return this.end(content);
    }
    accepted(obj = null) {
        this.res.writeHead(202, { 'content-type': 'application/json' });
        return (obj != null ? this.end(JSON.stringify(obj)) : this.end());
    } // accepted status
    deleted() { return this.status(202); }  // accepted status
    created(obj) {                      // created status
        this.res.writeHead(201, { 'content-type': 'application/json' });
        return this.end(JSON.stringify(obj));
    }
    content(contentType, content) {         // let the browers cache locally the receiverd content
        this.res.writeHead(200, { 'content-type': contentType, "Cache-Control": "public, max-age=31536000" });
        return this.end(content);
    }
    noContent() { return this.status(204); }       // no content status
    updated() { return this.status(204); }         // no content status

    /////////////////////////////////////////////// 400 ///////////////////////////////////////////////////////

    badRequest(errormessage = '') { return this.status(400, errormessage); }      // bad request status
    unAuthorized(errormessage = '') { return this.status(401, errormessage); }    // unAuthorized status
    forbidden(errormessage = '') { return this.status(403, errormessage); }       // forbidden status
    notFound(errormessage = '') { return this.status(404, errormessage); }        // not found status
    notAloud(errormessage = '') { return this.status(405, errormessage); }        // Method not aloud status
    conflict(errormessage = '') { return this.status(409, errormessage); }        // Conflict status
    unsupported(errormessage = '') { return this.status(415, errormessage); }     // Unsupported Media Type status
    unprocessable(errormessage = '') { return this.status(422, errormessage); }   // Unprocessable Entity status

    // Custom status
    unverifiedUser(errormessage = '') { return this.status(480, errormessage); }  // custom bad request status
    userNotFound(errormessage = '') { return this.status(481, errormessage); }    // custom bad request status
    wrongPassword(errormessage = '') { return this.status(482, errormessage); }   // custom bad request status

    /////////////////////////////////////////////// 500 ///////////////////////////////////////////////////////

    internalError(errormessage = '') { return this.status(500, errormessage); }   // internal error status
    notImplemented(errormessage = '') { return this.status(501, errormessage); }  // Not implemented
}