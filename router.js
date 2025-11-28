

import AccountsController from "./controllers/AccountsController.js";

global.registeredRoutes = [];

export default class RouteRegister {
    static add(method, controllerName, actionName = "index") {
        registeredRoutes.push({
            method,
            controllerName,
            actionName
        });
    }
    static find(httpContext) {
        let path = httpContext.path;
        let foundRoute = null;
        registeredRoutes.forEach(route => {
            if (route.method == httpContext.req.method) {
                if (path.model != undefined && path.model.toLowerCase() == route.controllerName.toLowerCase()) {
                    if (path.action != undefined && path.action == route.actionName) {
                        route.id = path.id;
                        foundRoute = route;
                    }
                }
            }
        });
        return foundRoute;
    }
}

export const Registered_EndPoint = function (HttpContext) {
    return new Promise(async resolve => {
        let route = RouteRegister.find(HttpContext);
        if (route != null) {
            try {
                const { default: Controller } =
                    await import('./controllers/' + HttpContext.path.controllerName + '.js');
                let controller = new Controller(HttpContext);
                if (route.method === 'POST' || route.method === 'PUT') {
                    if (HttpContext.payload)
                        controller[route.actionName](HttpContext.payload);
                    else
                        HttpContext.response.unsupported();
                }
                else {
                    controller[route.actionName](route.id);
                }
                resolve(true);
            } catch (error) {
                console.log(BgRed + FgWhite, "Registered_EndPoint Error message: \n", error.message);
                console.log(FgRed, "Stack: \n", error.stack);
                HttpContext.response.notFound();
                resolve(true);
            }
        } else
            resolve(false);
    })
}

export const API_EndPoint = function (HttpContext) {
    return new Promise(async resolve => {
        if (!HttpContext.path.isAPI) {
            resolve(false);
        } else {
            let controllerName = HttpContext.path.controllerName;
            if (controllerName != undefined) {
                try {
                    // dynamically import the targeted controller
                    // if the controllerName does not exist the catch section will be called
                    const { default: Controller } = (await import('./controllers/' + controllerName + '.js'));

                    // instanciate the controller       
                    let controller = new Controller(HttpContext);
                    switch (HttpContext.req.method) {
                        case 'HEAD':
                            controller.head();
                            resolve(true);
                            break;
                        case 'GET':
                            controller.get(HttpContext.path.id);
                            resolve(true);
                            break;
                        case 'QUERY':
                            HttpContext.path.params = HttpContext.payload; // query in payload, querystring params overwritten
                            controller.get(HttpContext.path.id);
                            resolve(true);
                            break;
                        case 'POST':
                            if (HttpContext.payload)
                                controller.post(HttpContext.payload);
                            else
                                HttpContext.response.unsupported();
                            resolve(true);
                            break;
                        case 'PUT':
                            if (HttpContext.payload)
                                controller.put(HttpContext.payload);
                            else
                                HttpContext.response.unsupported();
                            resolve(true);
                            break;
                        case 'DELETE':
                            controller.remove(HttpContext.path.id);
                            resolve(true);
                            break;
                        default:
                            HttpContext.response.notImplemented();
                            resolve(true);
                            break;
                    }
                } catch (error) {
                    console.log(FgWhite + BgRed, "API_EndPoint Error message:", `${error.message}`);
                    console.log(Reset + FgRed, "Stack: \n", error.stack);
                    HttpContext.response.notFound();
                    resolve(true);
                }
            } else {
                // not an API endpoint
                // must be handled by another middleware
                resolve(false);
            }
        }
    })
}

export const TOKEN_EndPoint = function (HttpContext) {
    if (HttpContext.req.url == '/token' && HttpContext.req.method == "POST") {
        try {
            let accountsController = new AccountsController(HttpContext);
            if (HttpContext.payload)
                accountsController.login(HttpContext.payload);
            else
                HttpContext.response.badRequest();
            return true;
        } catch (error) {
            console.log("Token_EndPoint Error message: \n", error.message);
            console.log("Stack: \n", error.stack);
            HttpContext.response.notFound();
            return true;
        }
    }
    // request not consumed
    // must be handled by another middleware
    return false;

}
