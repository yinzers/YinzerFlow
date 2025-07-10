import dayjs from 'dayjs';
import type { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';
import { handleCors } from '@core/utils/cors.ts';
import { log } from '@core/utils/log.ts';

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
      // 1. Handle CORS before anything else. The cors handler will handle return true if it was a preflight request, otherwise it will return false.
      if (handleCors(context, this.setup._configuration.cors)) {
        context._response._parseResponseIntoString(); // Needed so the YinzerFlow can send the response as a string
        return void 0;
      }

      // 2. Match route based on context.request.method + context.request.path
      const matchedRoute = this.setup._routeRegistry._findRoute(context.request.method, context.request.path);
      if (!matchedRoute) {
        const notFoundResponse = await this.setup._hooks._onNotFound(context);
        context._response._setBody(notFoundResponse);
        context._response._parseResponseIntoString(); // Needed so the YinzerFlow can send the response as a string
        return void 0;
      }

      const { handler, options } = matchedRoute;
      const { beforeHooks, afterHooks } = options;

      // 3. Run beforeAll hooks
      const beforeAllHooks = this.setup._hooks._beforeAll;
      for (const hook of beforeAllHooks) await hook.handler(context);

      // 4. Run beforeGroup hooks and beforeRoute hooks
      // * The before group hooks and beforeRoute hooks are in the same array and ordered on route registration.
      for (const hook of beforeHooks) await hook(context);

      // 5. Execute route handler.
      // * We are saving the response to a variable because in this case we might not
      // * send a response to the client until after the after hooks since the after hooks might modify the response.
      const routeResponse = await handler(context);

      // 6. Run afterRoute hooks and afterGroup hooks
      // * The after group hooks and afterRoute hooks are in the same array and ordered on route registration.
      for (const hook of afterHooks) await hook(context);

      // 7. Run afterAll hooks
      const afterAllHooks = this.setup._hooks._afterAll;
      for (const hook of afterAllHooks) await hook.handler(context);

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
    log.error('Request handling error', error);

    try {
      // Get the error handler (user-defined or default)
      const errorHandler = this.setup._hooks._onError;

      // Call the error handler - it returns a response object
      const errorResponse = await errorHandler(context);

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
      log.error('Error handler failed', errorHandlerError);

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
}
