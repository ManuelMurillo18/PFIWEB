
/////////////////////////////////////////////////////////////////////
// Class APIServer
/////////////////////////////////////////////////////////////////////
// Provide MVC support for API services
// Support middlewares pipeline for incoming requests including
// CORS
// Static ressources
// API services
// Produce detailed logs on the console for each incomming request
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
// 2025
/////////////////////////////////////////////////////////////////////
import * as os from "os";
import { createServer } from 'http';
import dateAndTime from 'date-and-time';
import * as serverVariables from "./serverVariables.js";
import HttpContext from './http-context.js';
import MiddlewaresPipeline from './middlewaresPipeline.js';
import { handleCORSPreflight } from './cors.js';
import { handleStaticResourceRequest } from './staticResourcesServer.js';
import * as router from './router.js';
import CachedRequests from "./cachedRequestsManager.js";

let api_server_version = serverVariables.get("main.api_server_version");
let api_server_release = serverVariables.get("main.api_server_release");
let hideHeadRequest = serverVariables.get("main.hideHeadRequest");

global.Server_UTC_Offset = new Date().getTimezoneOffset() / 60;

export default class APIServer {
    constructor(port = process.env.PORT || 5000) {
        this.port = port;
        this.initMiddlewaresPipeline();
        this.httpServer = createServer(async (req, res) => { this.handleHttpRequest(req, res) });
    }

    initMiddlewaresPipeline() {
        this.middlewaresPipeline = new MiddlewaresPipeline();

        // common middlewares
        this.middlewaresPipeline.add(handleCORSPreflight);
        this.middlewaresPipeline.add(handleStaticResourceRequest);

        // API middlewares
        this.middlewaresPipeline.add(CachedRequests.get);
        this.middlewaresPipeline.add(router.TOKEN_EndPoint);
        this.middlewaresPipeline.add(router.Registered_EndPoint);
        this.middlewaresPipeline.add(router.API_EndPoint);
    }

    async handleHttpRequest(req, res) {
        this.markRequestProcessStartTime();
        this.httpContext = await HttpContext.create(req, res);
        if (!this.hiddenRequest())
            this.showRequestInfo();
        if (!(await this.middlewaresPipeline.handleHttpRequest(this.httpContext)))
            this.httpContext.response.notFound('this end point does not exist...');
        if (!this.hiddenRequest()) {
            this.showRequestProcessTime();
            this.showMemoryUsage();
        }
    }

    markRequestProcessStartTime() {
        this.requestProcessStartTime = process.hrtime();
    }

    showRequestProcessTime() {
        let requestProcessEndTime = process.hrtime(this.requestProcessStartTime);
        console.log(FgGreen, "Response time: ", Math.round((requestProcessEndTime[0] * 1000 + requestProcessEndTime[1] / 1000000) / 1000 * 10000) / 10000, "seconds");
    }

    showMemoryUsage() {
        // for more info https://www.valentinog.com/blog/node-usage/
        const used = process.memoryUsage();
        console.log(Reset + FgMagenta, "Memory usage: ", "Process :", Math.round(used.rss / 1024 / 1024 * 100) / 100, "Mb |",
            "Heap :", Math.round(used.heapTotal / 1024 / 1024 * 100) / 100, "Mb ");
    }

    showRequestInfo() {
        let time = dateAndTime.format(new Date(), 'HH:mm:ss');
        console.log(FgGreen, '-------------------------', time, '-------------------------');
        console.log(FgGreen, `Request from ${this.httpContext.hostIp} --> [${this.httpContext.req.method}::${this.httpContext.req.url}]`);
        //console.log("User agent ", this.httpContext.req.headers["user-agent"]);
        //console.log("Host ", this.httpContext.hostIp.substring(0, 15), "::", this.httpContext.host);
        if (this.httpContext.payload)
            console.log(BgBlue + FgWhite, "Request payload -->", JSON.stringify(this.httpContext.payload).substring(0, 127) + "...");
    }

    hiddenRequest() {
        return (hideHeadRequest && this.httpContext.req.method === 'HEAD');
    }

    start() {
        this.httpServer.listen(this.port, () => { this.startupMessage() });
    }

    startupMessage() {
        console.log(FgCyan, "*************************************");
        console.log(FgCyan, `* API SERVER - ${api_server_version}                  *`);
        console.log(FgCyan, `* Release date: ${api_server_release}       *`);
        console.log(FgCyan, "*************************************");
        console.log(BgCyan + FgWhite, `HTTP Server running on ${os.hostname()} and listening port ${this.port}...`);
        console.log(BgCyan + FgWhite, `Server time zone UTC-${Server_UTC_Offset} `);
        this.showMemoryUsage();
    }

}