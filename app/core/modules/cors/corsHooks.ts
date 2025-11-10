import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalCorsEnabledOptions } from '@typedefs/internal/InternalConfiguration.js';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.js';
import { Cors } from '@core/modules/cors/Cors.ts';

/**
 * Creates a CORS beforeRouting hook
 *
 * This hook handles Cross-Origin Resource Sharing (CORS) before routing.
 * It validates origins, handles preflight requests, and sets appropriate headers.
 *
 * @param config - CORS configuration (must be enabled)
 * @returns HandlerCallback that can be registered with app.beforeRouting()
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 * import { corsHook } from '@core/modules/cors/corsHooks.ts';
 *
 * const app = new YinzerFlow();
 *
 * // Register CORS as a beforeRouting hook
 * app.beforeRouting([
 *   corsHook({
 *     enabled: true,
 *     origin: ['https://example.com', 'https://app.example.com'],
 *     methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *     credentials: true,
 *   })
 * ]);
 * ```
 */
export const corsHook = (config: InternalCorsEnabledOptions): HandlerCallback => {
  const cors = new Cors(config);

  return (context) => cors.handle(context as InternalContextImpl);
};
