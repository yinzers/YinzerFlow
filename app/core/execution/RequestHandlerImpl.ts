import dayjs from 'dayjs';
import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';
import { handleCors } from '@core/utils/cors.ts';
import { log } from '@core/utils/log.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalRouteRegistry } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.js';

/**
 * Handles the complete lifecycle of an HTTP request
 *
 * Flow:
 * 1. Receive parsed context (request + response builders)
 * 2. Match route and execute handlers
 * 3. Build final response in context
 * 4. Context.rawResponse is ready for sending
 */
export class RequestHandlerImpl {
  private readonly setup: InternalSetupImpl;

  constructor(setup: SetupImpl) {
    this.setup = setup;
  }

  /**
   * Process an HTTP request using the provided context
   */
  async handle(context: InternalContextImpl): Promise<void> {
    try {
      // 1. Handle CORS - stop if it's a preflight request
      if (this._handleCors(context)) {
        return void 0;
      }

      // 2. Match route based on context.request.method + context.request.path
      const matchedRoute = await this._matchRoute(context);
      if (!matchedRoute) return void 0;

      // Set route params in the request context
      Object.assign(context.request.params as unknown as Record<string, string>, matchedRoute.params);

      const { handler, options } = matchedRoute;
      const { beforeHooks = [], afterHooks = [] } = options;

      // 3. Run beforeAll hooks - stop if any hook returns a value
      if (await this._handleBeforeAllHooks(context)) {
        return void 0;
      }

      // 4. Run beforeGroup hooks and beforeRoute hooks - stop if any hook returns a value
      // * The before group hooks and beforeRoute hooks are in the same array and ordered on route registration.
      if (await this._handleBeforeHooks(context, beforeHooks)) {
        return void 0;
      }

      // 5. Execute route handler.
      // * We are saving the response to a variable because in this case we might not
      // * send a response to the client until after the after hooks since the after hooks might modify the response.
      let routeResponse: unknown = null;
      try {
        routeResponse = await handler(context);
      } catch (handlerError) {
        throw handlerError;
      }

      // 6. Run afterRoute hooks and afterGroup hooks
      // * The after group hooks and afterRoute hooks are in the same array and ordered on route registration.
      for (const hook of afterHooks) await hook(context);

      // 7. Run afterAll hooks
      const afterAllHooks = this.setup._hooks._afterAll;
      for (const hook of afterAllHooks) {
        // Check if hook should run based on route options
        if (!this._shouldRunHook(hook.options, context.request.path)) {
          continue;
        }
        await hook.handler(context);
      }

      // 8. Build response (set content-type, etc.)
      context._response._setBody(routeResponse);

      // 10. If this was a HEAD request, remove the body and convert it to a GET request.
      // Im waiting to do this until after the after hooks since the after hooks might modify the response, headers, etc.
      if (context.request.method === 'HEAD') {
        context._response._setBody(null);
      }

      // 11. Add default framework headers and parse the body into a string
      // This is done when we call context._response._parseResponseIntoString()
      context._response._parseResponseIntoString();

      return void 0;
    } catch (error) {
      // Use the error handler from setup
      await this.handleError(context, error);
    }
  }

  /**
   * Handle errors using the user-defined or default error handler
   * The error handler returns a response object that we apply to the context
   */
  private async handleError(context: InternalContextImpl, error: unknown): Promise<void> {
    try {
      // Get the error handler (user-defined or default)
      const errorHandler = this.setup._hooks._onError;

      // Call the error handler - it returns a response object
      const errorResponse = await errorHandler(context, error);

      // Apply the response to the context
      context._response._setBody(errorResponse);

      // Add CORS headers to error responses too
      handleCors(context, this.setup._configuration.cors);

      // Format the response for sending (same as normal flow)
      context._response._parseResponseIntoString();
      context._response._setHeadersIfNotSet({
        Date: dayjs().format('ddd, DD MMM YYYY HH:mm:ss [GMT]'),
        'Content-Length': context._response._stringBody.split('\n\n')[1]?.length.toString() ?? '0',
      });
    } catch (errorHandlerError) {
      // If the error handler itself fails, fall back to basic response
      log.error('Error handler failed, this might be an internal error in the YinzerFlow framework: ', errorHandlerError);

      context.response.setStatusCode(500);
      context._response._setBody({
        success: false,
        message: 'Internal Server Error',
      });

      // Add CORS headers to fallback error responses too
      handleCors(context, this.setup._configuration.cors);

      // Format the fallback response too
      context._response._parseResponseIntoString();
      context._response._setHeadersIfNotSet({
        Date: dayjs().format('ddd, DD MMM YYYY HH:mm:ss [GMT]'),
        'Content-Length': context._response._stringBody.split('\n\n')[1]?.length.toString() ?? '0',
      });
    }
  }

  private _handleCors(context: InternalContextImpl): boolean {
    // 1. Handle CORS before anything else. The cors handler will handle return true if it was a preflight request, otherwise it will return false.
    const corsResult = handleCors(context, this.setup._configuration.cors);

    if (corsResult) {
      context._response._parseResponseIntoString(); // Needed so the YinzerFlow can send the response as a string
      return true; // Signal that we should stop processing
    }

    return false; // Signal that we should continue processing
  }

  private async _matchRoute(context: InternalContextImpl): Promise<InternalRouteRegistry | null> {
    const matchedRoute = this.setup._routeRegistry._findRoute(context.request.method, context.request.path);

    if (!matchedRoute) {
      const notFoundResponse = await this.setup._hooks._onNotFound(context);
      context._response._setBody(notFoundResponse);
      context._response._parseResponseIntoString(); // Needed so the YinzerFlow can send the response as a string
      return null; // Signal that no route was found and response is already set
    }

    return matchedRoute;
  }

  private async _handleBeforeAllHooks(context: InternalContextImpl): Promise<boolean> {
    const beforeAllHooks = this.setup._hooks._beforeAll;
    for (const hook of beforeAllHooks) {
      // Check if hook should run based on route options
      if (!this._shouldRunHook(hook.options, context.request.path)) {
        continue;
      }

      const result = await hook.handler(context);
      if (result !== undefined) {
        context._response._setBody(result);
        context._response._parseResponseIntoString();
        return true; // Signal that we should stop processing
      }
    }
    return false; // Signal that we should continue processing
  }

  private async _handleBeforeHooks(context: InternalContextImpl, hooks: Array<HandlerCallback>): Promise<boolean> {
    for (const hook of hooks) {
      const result = await hook(context);
      if (result !== undefined) {
        context._response._setBody(result);
        context._response._parseResponseIntoString();
        return true; // Signal that we should stop processing
      }
    }
    return false; // Signal that we should continue processing
  }

  /**
   * Determines if a hook should run based on its options and the current request path
   */
  private _shouldRunHook(options: InternalGlobalHookOptions | undefined, requestPath: string): boolean {
    if (!options) {
      return true; // No options means run for all routes
    }

    const { routesToInclude, routesToExclude } = options;

    // If routesToExclude contains the current path, don't run
    if (routesToExclude.some((pattern) => this._matchesPattern(requestPath, pattern))) {
      return false;
    }

    // If routesToInclude is empty, run for all routes (unless excluded above)
    if (routesToInclude.length === 0) {
      return true;
    }

    // If routesToInclude has patterns, only run if current path matches one of them
    return routesToInclude.some((pattern) => this._matchesPattern(requestPath, pattern));
  }

  /**
   * Simple pattern matching for route filtering
   * Supports basic wildcard patterns like /api/* and exact matches
   */
  private _matchesPattern(path: string, pattern: string): boolean {
    // Exact match
    if (pattern === path) {
      return true;
    }

    // Wildcard pattern (e.g., /api/*)
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix);
    }

    // No match
    return false;
  }
}
