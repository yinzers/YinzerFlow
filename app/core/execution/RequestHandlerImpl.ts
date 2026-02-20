import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';
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
      // 1. Run beforeRouting hooks (includes CORS if enabled) - stop if any hook returns a value
      if (await this._handleBeforeRoutingHooks(context)) {
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

      // 5. Execute route handler
      const routeResponse = await handler(context);

      // 6. Set body BEFORE after-hooks so it's preserved even if a hook throws
      context._response._setBody(routeResponse);

      // 7. Run afterRoute hooks and afterGroup hooks
      // * The after group hooks and afterRoute hooks are in the same array and ordered on route registration.
      for (const hook of afterHooks) await hook(context);

      // 8. Run afterAll hooks
      const afterAllHooks = this.setup._hooks._afterAll;
      for (const hook of afterAllHooks) {
        if (!this._shouldRunHook(hook.options, context.request.path)) {
          continue;
        }
        await hook.handler(context);
      }

      // 9. If this was a HEAD request, remove the body.
      // Waiting until after hooks since they might modify the response, headers, etc.
      if (context.request.method === 'HEAD') {
        context._response._setBody(null);
      }

      // 10. Add default framework headers and parse the body into a string
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

      // Format the response for sending (same as normal flow)
      context._response._parseResponseIntoString();
    } catch (errorHandlerError) {
      // If the error handler itself fails, fall back to basic response
      this.setup._log.error('Your custom error handler threw an error. Check your onError() handler for bugs: ', errorHandlerError);

      context.response.setStatusCode(500);
      context._response._setBody({
        success: false,
        message: 'Internal Server Error',
      });

      // Format the fallback response too
      context._response._parseResponseIntoString();
    }
  }

  async _handleBeforeRoutingHooks(context: InternalContextImpl): Promise<boolean> {
    const beforeRoutingHooks = this.setup._hooks._beforeRouting;
    for (const hook of beforeRoutingHooks) {
      // Check if hook should run based on route options
      if (!this._shouldRunHook(hook.options, context.request.path)) {
        continue;
      }

      const result = await hook.handler(context);
      if (this._applyHookResponse(result, context)) return true;
    }
    return false;
  }

  async _matchRoute(context: InternalContextImpl): Promise<InternalRouteRegistry | null> {
    const matchedRoute = this.setup._routeRegistry._findRoute(context.request.method, context.request.path);

    if (!matchedRoute) {
      const notFoundResponse = await this.setup._hooks._onNotFound(context);
      context._response._setBody(notFoundResponse);
      context._response._parseResponseIntoString(); // Needed so the YinzerFlow can send the response as a string
      return null; // Signal that no route was found and response is already set
    }

    return matchedRoute;
  }

  async _handleBeforeAllHooks(context: InternalContextImpl): Promise<boolean> {
    const beforeAllHooks = this.setup._hooks._beforeAll;
    for (const hook of beforeAllHooks) {
      // Check if hook should run based on route options
      if (!this._shouldRunHook(hook.options, context.request.path)) {
        continue;
      }

      const result = await hook.handler(context);
      if (this._applyHookResponse(result, context)) return true;
    }
    return false;
  }

  async _handleBeforeHooks(context: InternalContextImpl, hooks: Array<HandlerCallback>): Promise<boolean> {
    for (const hook of hooks) {
      const result = await hook(context);
      if (this._applyHookResponse(result, context)) return true;
    }
    return false;
  }

  /** Apply a hook's return value as the response. Returns true if hook short-circuited. */
  _applyHookResponse(result: unknown, context: InternalContextImpl): boolean {
    if (result === undefined) return false;
    context._response._setBody(result);
    context._response._parseResponseIntoString();
    return true;
  }

  /**
   * Determines if a hook should run based on its options and the current request path
   */
  _shouldRunHook(options: InternalGlobalHookOptions | undefined, requestPath: string): boolean {
    if (!options) {
      return true; // No options means run for all routes
    }

    const { routesToInclude = [], routesToExclude = [] } = options;

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
  _matchesPattern(path: string, pattern: string): boolean {
    // Exact match
    if (pattern === path) {
      return true;
    }

    // Wildcard pattern (e.g., /api/*) — must match segment boundary
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // Keep trailing slash: "/api/" from "/api/*"
      return path.startsWith(prefix) || path === pattern.slice(0, -2);
    }

    // No match
    return false;
  }
}
