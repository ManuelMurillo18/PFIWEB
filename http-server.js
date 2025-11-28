/////////////////////////////////////////////////////////////////////
// This module is the starting point of the http server
/////////////////////////////////////////////////////////////////////
import APIServer from "./api-server.js";

import RouteRegister from './router.js';
RouteRegister.add('GET', 'Bookmarks', 'list');

let server = new APIServer();
server.start();

RouteRegister.add('POST', 'accounts', 'register');
RouteRegister.add('GET', 'accounts', 'verify');
RouteRegister.add('GET', 'accounts', 'logout');
RouteRegister.add('PUT', 'accounts', 'modify');
RouteRegister.add('GET', 'accounts', 'remove');
RouteRegister.add('GET', 'accounts', 'conflict');
RouteRegister.add('POST', 'accounts', 'block');
RouteRegister.add('POST', 'accounts', 'promote');