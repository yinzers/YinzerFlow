import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { CookieParserOptions } from '@typedefs/public/CookieParser.js';
import { CookieParser } from '@core/modules/cookieParser/CookieParser.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';

/**
 * Create a global cookie parser hook
 *
 * This middleware parses incoming cookies and makes them available on the context.
 * It also provides cookie helper methods for setting and managing cookies.
 *
 * @param config - Cookie parser configuration
 * @returns Handler callback for cookie parsing
 *
 * @example
 * ```typescript
 * import { cookieParser } from 'yinzerflow';
 *
 * // Basic usage with secret
 * app.use(cookieParser({ secret: process.env.COOKIE_SECRET }));
 *
 * // With default options
 * app.use(cookieParser({
 *   secret: process.env.COOKIE_SECRET,
 *   defaults: {
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: 'strict'
 *   }
 * }));
 *
 * // In your route handler
 * app.get('/api/data', async (ctx) => {
 *   // Access unsigned cookies
 *   const theme = ctx.request.cookies.get('theme');
 *
 *   // Access signed cookies
 *   const sessionId = ctx.request.signedCookies.get('sessionId');
 *
 *   return { theme, sessionId };
 * });
 * ```
 */
export const cookieParserHook =
  <T extends HandlerCallbackGenerics>(config?: CookieParserOptions): HandlerCallback<T> =>
  // Return the hook function
  (context) => {
    // Create cookie parser instance
    const cookieParser = new CookieParser(config);

    // Parse incoming cookies from Cookie header
    const cookieHeader = context.request.headers.cookie;
    const parsedCookies = cookieParser.parse(cookieHeader ?? '');

    // Initialize cookies maps on request
    context.request.cookies = parsedCookies;
    context.request.signedCookies = new Map<string, string>();

    // Parse signed cookies
    if (cookieParser.config.secret) {
      for (const [name, value] of parsedCookies.entries()) {
        if (cookieParser.shouldSign(name)) {
          const unsigned = cookieParser.unsign(name, value);
          if (unsigned !== false) {
            context.request.signedCookies.set(name, unsigned);
          }
        }
      }
    }

    // Attach cookie helpers to context
    context.cookies = {
      set: (name: string, value: string, options?: CookieParserOptions['defaults']): void => {
        // Sign the value if configured
        let cookieValue = value;
        if (cookieParser.shouldSign(name)) {
          cookieValue = cookieParser.sign(name, value);
        }

        // Build Set-Cookie header
        const setCookieHeader = cookieParser.set(name, cookieValue, options);
        context.response.addHeaders({ 'Set-Cookie': setCookieHeader });
      },
      sign: (name: string, value: string): string => {
        if (!cookieParser.config.secret) {
          throw new Error('Cannot sign cookie: no secret configured');
        }
        return cookieParser.sign(name, value);
      },
      unsign: (name: string, signedValue: string): string | false => {
        if (!cookieParser.config.secret) {
          throw new Error('Cannot unsign cookie: no secret configured');
        }
        return cookieParser.unsign(name, signedValue);
      },
    };

    // Continue to next hook/handler
    return void 0;
  };
