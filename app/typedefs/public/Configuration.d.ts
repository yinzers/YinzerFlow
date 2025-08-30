import type { DeepPartial } from '@typedefs/internal/Generics.js';
import type {
  InternalCorsDisabledConfiguration,
  InternalCorsEnabledConfiguration,
  InternalServerConfiguration,
} from '@typedefs/internal/InternalConfiguration.js';

/**
 * User-facing configuration interface where all properties are optional.
 *
 * Users only need to specify what they want to override from defaults.
 * This is created by making the complete internal ServerConfigurationShape
 * partially optional using DeepPartial.
 *
 * ## Configuration Options
 *
 * - **Server Settings**: Port, host, and network configuration
 * - **Logging**: Log levels and custom logger configuration
 * - **CORS**: Cross-origin resource sharing settings
 * - **Performance**: Request handling and timeout settings
 * - **Security**: Headers and security-related options
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 *
 * // Minimal configuration - only specify what you need
 * const app = new YinzerFlow({ port: 3000 });
 *
 * // Basic configuration with logging
 * const app = new YinzerFlow({
 *   port: 8080,
 *   logLevel: 'info',
 *   networkLogs: true
 * });
 *
 * // Full configuration example
 * const app = new YinzerFlow({
 *   port: 9000,
 *   host: '0.0.0.0',
 *   logLevel: 'debug',
 *   networkLogs: true,
 *   autoGracefulShutdown: true,
 *   cors: {
 *     enabled: true,
 *     origin: ['https://example.com', 'https://app.example.com'],
 *     methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *     headers: ['Content-Type', 'Authorization'],
 *     credentials: true
 *   },
 *   logger: {
 *     info: (message, ...args) => console.log(`[APP] ${message}`, ...args),
 *     warn: (message, ...args) => console.warn(`[APP] ${message}`, ...args),
 *     error: (message, ...args) => console.error(`[APP] ${message}`, ...args),
 *     debug: (message, ...args) => console.debug(`[APP] ${message}`, ...args)
 *   }
 * });
 * ```
 *
 * @see {@link InternalServerConfiguration} for complete internal configuration
 * @see {@link DeepPartial} for how optional properties are created
 * @see {@link CorsConfiguration} for CORS configuration options
 */
export type ServerConfiguration = DeepPartial<InternalServerConfiguration>;

/**
 * CORS Configuration Options for Cross-Origin Resource Sharing.
 *
 * Provides fine-grained control over how your server handles requests
 * from different origins (domains, ports, or protocols).
 *
 * ## CORS Modes
 *
 * - **Disabled**: No CORS headers, only same-origin requests allowed
 * - **Enabled**: Full CORS support with configurable options
 *
 * ## Security Considerations
 *
 * - **Origin**: Restrict which domains can access your API
 * - **Credentials**: Control whether cookies/auth headers are sent
 * - **Methods**: Limit which HTTP methods are allowed
 * - **Headers**: Control which request headers are permitted
 *
 * @example
 * ```typescript
 * import { YinzerFlow } from 'yinzerflow';
 *
 * // Disable CORS (default - most secure)
 * const app = new YinzerFlow({
 *   port: 3000,
 *   cors: { enabled: false }
 * });
 *
 * // Enable CORS with basic settings
 * const app = new YinzerFlow({
 *   port: 3000,
 *   cors: {
 *     enabled: true,
 *     origin: '*', // Allow all origins (development only!)
 *     methods: ['GET', 'POST'],
 *     headers: ['Content-Type']
 *   }
 * });
 *
 * // Production-ready CORS configuration
 * const app = new YinzerFlow({
 *   port: 3000,
 *   cors: {
 *     enabled: true,
 *     origin: [
 *       'https://app.example.com',
 *       'https://admin.example.com',
 *       'https://api.example.com'
 *     ],
 *     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
 *     headers: [
 *       'Content-Type',
 *       'Authorization',
 *       'X-Requested-With',
 *       'X-API-Key'
 *     ],
 *     credentials: true, // Allow cookies/auth headers
 *     maxAge: 86400 // Cache preflight for 24 hours
 *   }
 * });
 *
 * // Development CORS (less secure, more permissive)
 * const app = new YinzerFlow({
 *   port: 3000,
 *   cors: {
 *     enabled: true,
 *     origin: true, // Reflect the request origin
 *     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
 *     headers: true, // Allow all headers
 *     credentials: true
 *   }
 * });
 * ```
 *
 * @see {@link InternalCorsDisabledConfiguration} for disabled CORS options
 * @see {@link InternalCorsEnabledConfiguration} for enabled CORS options
 * @see {@link ServerConfiguration} for complete server configuration
 */
export type CorsConfiguration = InternalCorsDisabledConfiguration | InternalCorsEnabledConfiguration;
