/**
 * YinzerFlow Main Barrel File
 *
 * This file uses named exports rather than wildcard exports
 * to ensure optimal tree shaking by bundlers.
 */

// Constants exports
export { HttpMethod, HttpStatus, HttpStatusCode, ContentType } from 'constants/index.ts';

// Types exports - using 'type' keyword for better tree shaking
export type { IRoute, TErrorFunction, THttpStatusCode, TResponseBody, TJsonData, IMultipartFormData, IServerOptions } from 'types/index.ts';

// Core components - export selectively from the core barrel file
export { YinzerFlow, Context, Request, Response, RequestHandler, ConnectionManager, HooksManager } from 'core/index.ts';

// Route components - export selectively from the route barrel file
export { RouteRegistry, RouteFinder } from 'core/Route/index.ts';

// Route methods - export selectively from the route methods barrel file
export { addGetRoute, addPostRoute, addPutRoute, addDeleteRoute, addPatchRoute } from 'core/Route/methods/index.ts';

// Request parsers - export selectively from the request parsers barrel file
export { parseMultipartFormData, parseApplicationJson, parseYaml } from 'core/Request/index.ts';

// Request guards - export selectively from the request guards barrel file
export { isJsonData, isMultipartFormData } from 'core/Request/index.ts';


