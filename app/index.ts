// Main barrel file for YinzerFlow

// Export the main YinzerFlow class and core components
export { YinzerFlow } from './core/YinzerFlow.ts';
export {
  RouteRegistry,
  RouteFinder,
  MiddlewareManager,
  MiddlewareExecutor,
  RequestHandler,
  RequestParser,
  ResponseFormatter,
  ConnectionManager,
  HttpRequest,
  HttpResponse,
} from './core/index.ts';

// Export HTTP constants
export { HttpStatusCode, HttpStatus, HttpMethod, ContentType } from './constants/http.ts';

// Export types
export type { IRoute, TResponseFunction, TUndefinableResponseFunction } from './types/Route.ts';
export type { TMiddleware, IExcludeMiddleware, IIncludeMiddleware } from './types/Middleware.ts';
export type { TErrorFunction } from './types/Response.ts';
export type { Enum } from './types/Common.ts';
export type { IRequest, THttpMethod, TRequestParams, TRequestQuery } from './types/http/Request.ts';
export type { IResponse, THttpStatus, THttpStatusCode, TResponseBody, IHeaders } from './types/http/Response.ts';

// TODO - Write tests for this file

// TODO - Write automation to ensure the version is updated in the package.json file before publishing
// TODO - Write automation to publish to npm and also create a release in GitHub
