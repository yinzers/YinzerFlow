/**
 * Utility functions barrel file
 *
 * This file exports utility functions that are still needed but don't fit into
 * the core classes. These are primarily string manipulation and other general utilities.
 */

/**
 * Note: The following utilities have been moved to classes:
 *
 * String utilities:
 * - divideString -> moved to app/utils/classes/StringUtils.ts
 * - calculateContentLength -> moved to app/utils/classes/StringUtils.ts
 *
 * Request parsing utilities:
 * - parseRequestBody -> RequestParser.parseBody
 * - parseRequestHeaders -> RequestParser.parseHeaders
 * - parseRequestParams -> RequestParser.parseParams
 * - parseRequestQuery -> RequestParser.parseQuery
 *
 * Route finding utilities:
 * - findRoute -> RouteFinder.findRouteFromRequest
 *
 * Execution utilities:
 * - executeMiddlewareFunctions -> MiddlewareExecutor.executeMiddleware
 * - executeBeforeGroupFunctions -> MiddlewareExecutor.executeBeforeGroup
 * - executeBeforeHandlerFunctions -> MiddlewareExecutor.executeBeforeHandler
 * - executeHandlerFunction -> MiddlewareExecutor.executeHandler
 *
 * Context:
 * - Context -> moved to app/core/Context.ts
 */

// Export string utilities
export { divideString, calculateContentLength } from './string.utils.ts';

// Re-export any remaining utilities here
