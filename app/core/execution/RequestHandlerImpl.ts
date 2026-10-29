import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalGlobalStagesResult, InternalStageRoute } from '@typedefs/internal/InternalRequestHandlerImpl.js';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.js';
import { httpStatusCode } from '@constants/http.ts';
import { canonicalizeRequestPath } from '@core/execution/utils/canonicalizeRequestPath.ts';

/**
 * Handles the complete lifecycle of an HTTP request
 *
 * Flow:
 * 1. Receive parsed context (request + response builders)
 * 2. Derive the canonical path (or reject the request with 400), then match route and execute handlers
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
      // 0. Derive the one path that routing AND hook matching both use, so they can never disagree.
      // Traversal, encoded slashes and malformed encoding are rejected here, before any hook runs.
      if (this._rejectMalformedHead(context, ['host'])) return void 0;

      const canonicalPath = canonicalizeRequestPath(context.request.path);
      if (canonicalPath === null) {
        this._rejectMalformedPath(context);
        return void 0;
      }

      // 1-4. beforeRouting, route lookup, the global rate limiter, beforeAll: every request runs them, matched or not
      const stages = await this._runGlobalBeforeStages({
        context,
        canonicalPath,
        findRoute: () => this.setup._routeRegistry._findRoute(context.request.method, canonicalPath),
        refuseOnStatus: false,
      });
      if (stages.answered) return void 0;

      // 5. No route matched: the not-found handler answers, then afterAll runs on its response
      if (!stages.route) {
        await this._respondNotFound(context, canonicalPath);
        return void 0;
      }

      const { handler, options } = stages.route;
      const { beforeHooks = [], afterHooks = [] } = options;

      // 6. Run beforeGroup hooks and beforeRoute hooks - stop if any hook returns a value
      // * The before group hooks and beforeRoute hooks are in the same array and ordered on route registration.
      if (await this._handleBeforeHooks(context, beforeHooks)) {
        return void 0;
      }

      // 7. Execute route handler
      const routeResponse = await handler(context);

      // 8. Set body BEFORE after-hooks so it's preserved even if a hook throws
      context._response._setBody(routeResponse);

      // 9. Run afterRoute hooks and afterGroup hooks
      // * The after group hooks and afterRoute hooks are in the same array and ordered on route registration.
      for (const hook of afterHooks) await hook(context);

      // 10. afterAll hooks, then the HEAD body strip and the final response string
      await this._finishResponse(context, canonicalPath);

      return void 0;
    } catch (error) {
      // Use the error handler from setup
      await this._handleError(context, error);
    }
  }

  /**
   * Run the global request stages on a WebSocket upgrade request through the same pipeline as an HTTP request
   * (`_runGlobalBeforeStages`): beforeRouting, ws route lookup, the global rate limiter, beforeAll, then the
   * not-found handler and afterAll when no ws route matched. Route-level hooks don't exist for ws routes, and an
   * accepted upgrade has no HTTP response for afterAll to change.
   *
   * A hook refuses the upgrade by returning a value (as for HTTP) or by setting a status code other than 200 without
   * returning one; there is no route handler left to carry that status, so it becomes the answer.
   *
   * @returns true when the upgrade may proceed; false when `context` holds the HTTP response to send instead
   */
  async _handleUpgrade(context: InternalContextImpl, canonicalPath: string, findWsRoute: () => InternalStageRoute | undefined): Promise<boolean> {
    const stages = await this._runGlobalBeforeStages({ context, canonicalPath, findRoute: findWsRoute, refuseOnStatus: true });
    if (stages.answered) {
      this._refuseWithErrorStatus(context);
      return false;
    }
    if (!stages.route) {
      await this._respondNotFound(context, canonicalPath);
      return false;
    }
    return true;
  }

  /**
   * The global stages every request runs before a route handler, matched or not, shared by HTTP requests and WebSocket
   * upgrades so the two can never drift: beforeRouting, route lookup (params filled on a match, left empty otherwise),
   * the global rate limiter, then beforeAll, each hook matched against the canonical path. The lookup runs after
   * beforeRouting, as it always has. `refuseOnStatus` makes a non-200 status set by a hook an answer (upgrades only).
   */
  async _runGlobalBeforeStages<TRoute extends InternalStageRoute>({
    context,
    canonicalPath,
    findRoute,
    refuseOnStatus,
  }: {
    context: InternalContextImpl;
    canonicalPath: string;
    findRoute: () => TRoute | undefined;
    refuseOnStatus: boolean;
  }): Promise<InternalGlobalStagesResult<TRoute>> {
    if ((await this._handleBeforeRoutingHooks(context, canonicalPath)) || (refuseOnStatus && this._answeredByStatus(context))) {
      return { answered: true };
    }

    const route = findRoute();
    if (route) Object.assign(context.request.params as unknown as Record<string, string>, route.params);

    // The limiter sits after the lookup so keyGenerator sees params and beforeRouting state, and before beforeAll and
    // the 404 so unmatched paths are throttled too (with empty params)
    if (await this._handleGlobalRateLimit(context)) return { answered: true };

    if ((await this._handleBeforeAllHooks(context, canonicalPath)) || (refuseOnStatus && this._answeredByStatus(context))) {
      return { answered: true };
    }

    return { answered: false, route };
  }

  /**
   * A hook that answered an upgrade refused it, but returning `null`, `false` or `0` (or setting a 2xx) leaves a 2xx
   * status, and a refused upgrade answered "200 OK" reads as neither success nor refusal. Any 2xx becomes 403.
   */
  _refuseWithErrorStatus(context: InternalContextImpl): void {
    const status = context._response._statusCode;
    if (status < 200 || status > 299) return;
    context.response.setStatusCode(httpStatusCode.forbidden);
    context._response._parseResponseIntoString();
  }

  /** On an upgrade, a hook that set a non-200 status without returning a body refused it: build that response. */
  _answeredByStatus(context: InternalContextImpl): boolean {
    if (context._response._statusCode === httpStatusCode.ok) return false;
    context._response._parseResponseIntoString();
    return true;
  }

  /**
   * Handle errors using the user-defined or default error handler
   * The error handler returns a response object that we apply to the context.
   * Also the error path for a throw during a WebSocket upgrade (YinzerFlow._answerUpgradeError).
   */
  async _handleError(context: InternalContextImpl, error: unknown): Promise<void> {
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

  /**
   * Answer a request whose path cannot be canonicalized with 400, through the normal response path
   * so default headers and the access log behave exactly as for any other response.
   */
  _rejectMalformedPath(context: InternalContextImpl): void {
    context.response.setStatusCode(httpStatusCode.badRequest);
    context._response._setBody({
      success: false,
      message: '400 Bad Request: request path contains a dot segment, an encoded slash or backslash, a NUL, or invalid percent-encoding',
    });
    context._response._parseResponseIntoString();
  }

  /**
   * Answer 400, before any hook runs, to a request head that can't be read one way: a request line that isn't
   * `METHOD SP target SP HTTP/1.x`, or one of `uniqueHeaders` (lower-cased) on more than one line. RFC 9112 §3.2 makes a
   * repeated Host a 400 on every request; a WebSocket upgrade also refuses a repeated Origin. Last-wins would let a
   * front proxy and YinzerFlow read different values. Returns true when it answered.
   */
  _rejectMalformedHead(context: InternalContextImpl, uniqueHeaders: Array<string>): boolean {
    if (!context._request._isRequestLineValid) {
      this._rejectMalformedRequestLine(context);
      return true;
    }
    const repeated = uniqueHeaders.find((name) => context._request._repeatedHeaders.has(name));
    if (repeated === undefined) return false;
    context.response.setStatusCode(httpStatusCode.badRequest);
    context._response._setBody({ success: false, message: `400 Bad Request: more than one ${repeated} header` });
    context._response._parseResponseIntoString();
    return true;
  }

  /** Answer a request line that isn't `METHOD SP target SP HTTP/1.x` with 400, before any hook runs. */
  _rejectMalformedRequestLine(context: InternalContextImpl): void {
    context.response.setStatusCode(httpStatusCode.badRequest);
    context._response._setBody({
      success: false,
      message: '400 Bad Request: the request line must be METHOD, one space, the target, one space, then HTTP/1.0 or HTTP/1.1',
    });
    context._response._parseResponseIntoString();
  }

  async _handleBeforeRoutingHooks(context: InternalContextImpl, canonicalPath: string): Promise<boolean> {
    const beforeRoutingHooks = this.setup._hooks._beforeRouting;
    for (const hook of beforeRoutingHooks) {
      // Check if hook should run based on route options
      if (!this._shouldRunHook(hook.options, canonicalPath)) {
        continue;
      }

      const result = await hook.handler(context);
      if (this._applyHookResponse(result, context)) return true;
    }
    return false;
  }

  /** Run the framework's global rate limiter, if enabled. Returns true when it answered (429). */
  async _handleGlobalRateLimit(context: InternalContextImpl): Promise<boolean> {
    const rateLimitHook = this.setup._globalRateLimitHook;
    if (!rateLimitHook) return false;
    return this._applyHookResponse(await rateLimitHook(context), context);
  }

  /** The not-found handler's response, finished like any other: afterAll hooks run on it. */
  async _respondNotFound(context: InternalContextImpl, canonicalPath: string): Promise<void> {
    const notFoundResponse = await this.setup._hooks._onNotFound(context);
    context._response._setBody(notFoundResponse);
    await this._finishResponse(context, canonicalPath);
  }

  /** Run afterAll hooks, drop the body of a HEAD response, and build the response string YinzerFlow sends. */
  async _finishResponse(context: InternalContextImpl, canonicalPath: string): Promise<void> {
    for (const hook of this.setup._hooks._afterAll) {
      if (!this._shouldRunHook(hook.options, canonicalPath)) continue;
      await hook.handler(context);
    }

    // Waiting until after hooks since they might modify the response, headers, etc.
    if (context.request.method === 'HEAD') {
      context._response._setBody(null);
    }

    // Add default framework headers and parse the body into a string
    context._response._parseResponseIntoString();
  }

  async _handleBeforeAllHooks(context: InternalContextImpl, canonicalPath: string): Promise<boolean> {
    const beforeAllHooks = this.setup._hooks._beforeAll;
    for (const hook of beforeAllHooks) {
      // Check if hook should run based on route options
      if (!this._shouldRunHook(hook.options, canonicalPath)) {
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
    // A HEAD response carries no body, whichever stage answered it (the same strip _finishResponse applies)
    if (context.request.method === 'HEAD') context._response._setBody(null);
    context._response._parseResponseIntoString();
    return true;
  }

  /**
   * Determines if a hook should run based on its options and the request's canonical path.
   * Hook patterns are canonicalized at registration (HookRegistryImpl), so both sides share one form.
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
